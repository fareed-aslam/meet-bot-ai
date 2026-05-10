import { processMeetingTranscript } from "@/lib/ai-processor";
import { prisma } from "@/lib/db";
import { sendMeetingSummaryEmail } from "@/lib/email";
import { Prisma } from "@/lib/generated/client";
import { processTranscript } from "@/lib/rag";
import { incrementMeetingUsage } from "@/lib/usage";
import { NextRequest, NextResponse } from "next/server";

function parseAttendeeEmails(attendees: unknown): string[] {
    if (!attendees) return []
    try {
        const parsed = typeof attendees === 'string' ? JSON.parse(attendees) : attendees
        if (Array.isArray(parsed)) {
            return parsed.map((e) => String(e).trim()).filter(Boolean)
        }
    } catch {
        // ignore
    }
    return []
}

function isLikelyEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

type TranscriptWord = { word?: string }
type TranscriptSegment = { speaker?: string; words?: TranscriptWord[] }

type MeetingBaasWebhookData = {
    bot_id?: string
    transcript?: unknown
    extra?: { meeting_id?: string | number }
    mp4?: string | null
    speakers?: unknown
}

type MeetingBaasWebhookPayload = {
    event?: string
    data?: MeetingBaasWebhookData
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
    if (value === undefined || value === null) return Prisma.DbNull

    try {
        const json = JSON.stringify(value)
        if (json === undefined) return Prisma.DbNull
        return JSON.parse(json) as Prisma.InputJsonValue
    } catch {
        // Last resort: store a string representation rather than failing the webhook.
        return String(value) as unknown as Prisma.InputJsonValue
    }
}

function errorForLog(error: unknown): unknown {
    if (error instanceof Error) return error.stack ?? error.message
    if (typeof error === 'object' && error && 'stack' in error) {
        return String((error as { stack?: unknown }).stack)
    }
    return error
}

function transcriptToText(transcript: unknown): string {
    if (!transcript) return ''

    if (Array.isArray(transcript)) {
        return (transcript as TranscriptSegment[])
            .map((item) => {
                const speaker = item?.speaker || 'Speaker'
                const words = Array.isArray(item?.words)
                    ? item.words.map((w) => String(w?.word ?? '').trim()).filter(Boolean).join(' ')
                    : ''
                return `${speaker}: ${words}`.trim()
            })
            .filter(Boolean)
            .join('\n')
    }

    return String(transcript)
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text()
        if (!rawBody || rawBody.trim().length === 0) {
            return NextResponse.json({ error: 'empty request body' }, { status: 400 })
        }

        let webhook: MeetingBaasWebhookPayload
        try {
            webhook = JSON.parse(rawBody) as MeetingBaasWebhookPayload
        } catch (parseError: unknown) {
            console.error('invalid webhook json payload:', errorForLog(parseError))
            return NextResponse.json({ error: 'invalid json payload' }, { status: 400 })
        }
        if (webhook.event === 'complete') {
            const webhookData = webhook.data

            if (!webhookData) {
                return NextResponse.json({ error: 'missing data in payload' }, { status: 400 })
            }

            let meeting = null
            if (webhookData.bot_id) {
                meeting = await prisma.meeting.findFirst({
                    where: { botId: webhookData.bot_id },
                    include: { user: true }
                })
            }

            // Fallback: some provider responses may omit bot_id but include our extra.meeting_id
            if (!meeting && webhookData.extra?.meeting_id) {
                try {
                    meeting = await prisma.meeting.findUnique({
                        where: { id: String(webhookData.extra.meeting_id) },
                        include: { user: true }
                    })
                    if (meeting) {
                        console.warn('Matched meeting by extra.meeting_id fallback', meeting.id)
                    }
                } catch {
                    // ignore
                }
            }

            if (!meeting) {
                console.error('meeting not found for bot id or extra.meeting_id:', webhookData.bot_id, webhookData.extra?.meeting_id)
                return NextResponse.json({ error: 'meeting not found' }, { status: 404 })
            }

            await incrementMeetingUsage(meeting.userId)

            await prisma.meeting.update({
                where: {
                    id: meeting.id
                },
                data: {
                    meetingEnded: true,
                    transcriptReady: Boolean(webhookData.transcript),
                    transcript: toPrismaJson(webhookData.transcript),
                    recordingUrl: webhookData.mp4 || null,
                    speakers: toPrismaJson(webhookData.speakers)
                }
            })

            // Avoid leaving the UI in a permanent "Processing" state if the provider completes
            // without returning a transcript payload.
            if (!webhookData.transcript && !meeting.processed) {
                await prisma.meeting.update({
                    where: {
                        id: meeting.id
                    },
                    data: {
                        processed: true,
                        processedAt: new Date(),
                        summary: 'Transcript not available for this meeting yet. If you expected one, verify the bot was admitted and your webhook URL is reachable.',
                        actionItems: []
                    }
                })

                return NextResponse.json({
                    success: true,
                    message: 'meeting marked complete (no transcript payload)',
                    meetingId: meeting.id
                })
            }

            if (webhookData.transcript && !meeting.processed) {
                try {
                    const processed = await processMeetingTranscript(webhookData.transcript)

                    const transcriptText = transcriptToText(webhookData.transcript)

                    try {
                        const shouldEmailAttendees = process.env.MEETBOT_EMAIL_ATTENDEES === 'true'
                        const attendeeEmails = shouldEmailAttendees ? parseAttendeeEmails(meeting.attendees) : []

                        const recipients = Array.from(new Set([
                            meeting.user.email,
                            ...attendeeEmails
                        ].map((e) => String(e).trim()).filter((e) => isLikelyEmail(e))))

                        let atLeastOneEmailSent = false
                        for (const recipient of recipients) {
                            try {
                                await sendMeetingSummaryEmail({
                                    userEmail: recipient,
                                    userName: meeting.user.name || 'User',
                                    meetingTitle: meeting.title,
                                    summary: processed.summary,
                                    actionItems: processed.actionItems,
                                    meetingId: meeting.id,
                                    meetingDate: meeting.startTime.toLocaleDateString()
                                })
                                atLeastOneEmailSent = true
                            } catch (recipientError) {
                                    console.error(`failed to send meeting email to ${recipient}:`, errorForLog(recipientError))
                            }
                        }

                        if (atLeastOneEmailSent) {
                            await prisma.meeting.update({
                                where: {
                                    id: meeting.id
                                },
                                data: {
                                    emailSent: true,
                                    emailSentAt: new Date()
                                }
                            })
                        }
                    } catch (emailError) {
                        console.error('failed to send the email:', errorForLog(emailError))
                    }

                    await prisma.meeting.update({
                        where: {
                            id: meeting.id
                        },
                        data: {
                            summary: processed.summary,
                            actionItems: processed.actionItems,
                            processed: true,
                            processedAt: new Date(),
                            ragProcessed: true,
                            ragProcessedAt: new Date()
                        }
                    })

                    try {
                        await processTranscript(meeting.id, meeting.userId, transcriptText, meeting.title)
                    } catch (ragError) {
                        console.error('failed to index transcript for RAG:', errorForLog(ragError))
                    }


                } catch (processingError) {
                    console.error('failed to process the transcript:', errorForLog(processingError))

                    await prisma.meeting.update({
                        where: {
                            id: meeting.id
                        },
                        data: {
                            processed: true,
                            processedAt: new Date(),
                            summary: 'processing failed. please check the transcript manually.',
                            actionItems: []
                        }
                    })
                }
            }

            return NextResponse.json({
                success: true,
                message: 'meeting processed succesfully',
                meetingId: meeting.id
            })
        }
        return NextResponse.json({
            success: true,
            message: 'webhook recieved but no action needed bro'
        })
    } catch (error) {
        console.error('webhook processing errir:', error)
        return NextResponse.json({ error: 'internal server error' }, { status: 500 })
    }
}