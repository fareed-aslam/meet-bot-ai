import { prisma } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import actionItemsJson from '@/scripts/data/action-items.json'
import summaryJson from '@/scripts/data/summaries.json'
import transcript1 from '@/scripts/data/transcripts/transcript1.json'
import transcript2 from '@/scripts/data/transcripts/transcript2.json'
import transcript3 from '@/scripts/data/transcripts/transcript3.json'
import titlesJson from '@/scripts/data/title.json'

type ActionItem = {
    id: number
    text: string
}

const getDemoMeetingDetail = (meetingId: string) => {
    if (!meetingId.startsWith('demo-meeting-')) {
        return null
    }

    const titles = titlesJson as Array<{ title: string; description: string }>
    const actionItems = actionItemsJson as ActionItem[]
    const summary = String((summaryJson as { summary?: string }).summary ?? '')
    const now = new Date()
    const start = new Date(now.getTime() - 30 * 60 * 1000)
    const end = new Date(now.getTime() - 5 * 60 * 1000)

    const pick = (id: string) => {
        if (id === 'demo-meeting-1') return { idx: 0, transcript: transcript1 as unknown }
        if (id === 'demo-meeting-2') return { idx: 1, transcript: transcript2 as unknown }
        if (id === 'demo-meeting-3') return { idx: 2, transcript: transcript3 as unknown }
        return null
    }

    const match = pick(meetingId)
    if (!match) {
        return null
    }

    return {
        id: meetingId,
        title: titles[match.idx]?.title ?? 'Demo Meeting',
        description: titles[match.idx]?.description,
        meetingUrl: 'https://meet.google.com/cmj-qnof-roh',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        meetingEnded: true,
        transcriptReady: true,
        transcript: match.transcript,
        recordingUrl: 'https://meetingbot1.s3.eu-north-1.amazonaws.com/test-audio.mp3',
        summary,
        actionItems,
        processed: true,
        processedAt: end.toISOString(),
        emailSent: true,
        emailSentAt: end.toISOString(),
        ragProcessed: true,
        userId: 'demo-user',
        user: {
            id: 'demo-user',
            name: 'Demo User',
            email: 'demo@example.com',
            clerkId: 'demo-user'
        },
        isOwner: false
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ meetingId: string }> }
) {
    try {
        const { userId: clerkUserId } = await auth()

        const { meetingId } = await params

        const meeting = await prisma.meeting.findUnique({
            where: {
                id: meetingId
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        clerkId: true
                    }
                }
            }
        })

        if (!meeting) {
            const demo = getDemoMeetingDetail(meetingId)
            if (demo) {
                return NextResponse.json(demo, {
                    headers: {
                        'Cache-Control': 'no-store, max-age=0'
                    }
                })
            }

            return NextResponse.json({ error: 'meeting not found' }, { status: 404 })
        }

        const responseData = {
            ...meeting,
            isOwner: clerkUserId === meeting.user?.clerkId
        }

        return NextResponse.json(responseData, {
            headers: {
                'Cache-Control': 'no-store, max-age=0'
            }
        })
    } catch (error) {
        console.error('api error:', error)
        return NextResponse.json({ error: 'failed to fetch meeting' }, { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ meetingId: string }> }
) {
    try {
        const { userId } = await auth()

        if (!userId) {
            return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
        }

        const { meetingId } = await params

        const meeting = await prisma.meeting.findUnique({
            where: {
                id: meetingId
            },
            include: {
                user: true
            }
        })

        if (!meeting) {
            return NextResponse.json({ error: 'meeting not found' }, { status: 404 })
        }

        if (meeting.user.clerkId !== userId) {
            return NextResponse.json({ error: 'not authorized to delete this meeting' }, { status: 403 })
        }

        await prisma.meeting.delete({
            where: {
                id: meetingId
            }
        })

        return NextResponse.json({
            success: true,
            message: 'meeting deleted succesfully'
        })

    } catch (error) {
        console.error('failed to delere meeting', error)
        return NextResponse.json({ error: 'failed to delete meeting' }, { status: 500 })
    }
}