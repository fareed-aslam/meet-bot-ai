import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processMeetingTranscript } from "@/lib/ai-processor";
import { processTranscript } from "@/lib/rag";
import { sendMeetingSummaryEmail } from "@/lib/email";

type TranscriptWord = { word?: string }
type TranscriptSegment = { speaker?: string; words?: TranscriptWord[] }

export async function POST(request: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
    try {
        const { userId } = await auth()
        if (!userId) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })

        const { meetingId } = await params

        const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, include: { user: true } })
        if (!meeting) return NextResponse.json({ error: 'meeting not found' }, { status: 404 })

        if (meeting.user.clerkId !== userId) return NextResponse.json({ error: 'not authorized' }, { status: 403 })

        if (!meeting.transcript) return NextResponse.json({ error: 'no transcript available to reprocess' }, { status: 400 })

        // run AI processing
        const processed = await processMeetingTranscript(meeting.transcript)

        const transcriptText = Array.isArray(meeting.transcript)
            ? (meeting.transcript as TranscriptSegment[])
                .map((segment) => {
                    const words = Array.isArray(segment.words)
                        ? segment.words.map((word) => String(word?.word ?? '').trim()).filter(Boolean).join(' ')
                        : ''
                    return `${segment.speaker || 'Speaker'}: ${words}`.trim()
                })
                .join('\n')
            : String(meeting.transcript)

        await prisma.meeting.update({
            where: { id: meeting.id },
            data: {
                summary: processed.summary,
                actionItems: processed.actionItems,
                processed: true,
                processedAt: new Date(),
                ragProcessed: false,
                ragProcessedAt: null
            }
        })

        // send email to owner and optionally attendees
        try {
            const shouldEmailAttendees = process.env.MEETBOT_EMAIL_ATTENDEES === 'true'
            const attendeeEmails = shouldEmailAttendees && meeting.attendees ? JSON.parse(String(meeting.attendees)) : []

            const recipients = Array.from(new Set([
                meeting.user.email,
                ...(Array.isArray(attendeeEmails) ? attendeeEmails : [])
            ].filter(Boolean)))

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
                } catch (e) {
                    console.error('reprocess email failed for', recipient, e)
                }
            }

            if (atLeastOneEmailSent) {
                await prisma.meeting.update({ where: { id: meeting.id }, data: { emailSent: true, emailSentAt: new Date() } })
            }
        } catch (e) {
            console.error('reprocess email sending error', e)
        }

        try {
            await processTranscript(meeting.id, meeting.userId, transcriptText, meeting.title)

            await prisma.meeting.update({
                where: { id: meeting.id },
                data: {
                    ragProcessed: true,
                    ragProcessedAt: new Date()
                }
            })
        } catch (ragError) {
            console.error('reprocess rag indexing failed:', ragError)
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('reprocess error:', error)
        return NextResponse.json({ error: 'failed to reprocess meeting' }, { status: 500 })
    }
}
