import { prisma } from "@/lib/db";
import { DEMO_PAST_MEETINGS } from "@/lib/demoMeetings";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

type PastMeetingCard = {
    id: string
    title: string
    description?: string | null
    meetingUrl: string | null
    startTime: Date
    endTime: Date
    attendees?: unknown
    transcriptReady: boolean
    recordingUrl?: string | null
    speakers?: unknown
}

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: "not authed" }, { status: 401 })
        }
        const user = await prisma.user.findUnique({
            where: {
                clerkId: userId
            }
        })

        if (!user) {
            // New users might not exist in Prisma yet; still show demo meetings.
            return NextResponse.json({ meetings: DEMO_PAST_MEETINGS })
        }

        const now = new Date()
        // Backwards-compatible envs:
        // - If MEETBOT_PAST_MEETINGS_STRICT=true => only show webhook-confirmed ended meetings.
        // - Otherwise (default) include meetings ended by time so recently finished meetings show
        //   even if the provider webhook was missed.
        const strictOnly = process.env.MEETBOT_PAST_MEETINGS_STRICT === 'true'
        const includeByEndTime = !strictOnly
            && process.env.MEETBOT_PAST_MEETINGS_INCLUDE_BY_ENDTIME !== 'false'

        const pastMeetings = await prisma.meeting.findMany({
            where: {
                userId: user.id,
                ...(includeByEndTime
                    ? {
                        OR: [
                            { meetingEnded: true },
                            { processed: true },
                            { endTime: { lt: now } }
                        ]
                    }
                    : {
                        OR: [
                            { meetingEnded: true },
                            { processed: true },
                            { endTime: { lt: now } }
                        ]
                    })
            },
            orderBy: {
                endTime: 'desc'
            },
            take: 50
        })

        const mapped: PastMeetingCard[] = pastMeetings.map((m) => ({
            id: m.id,
            title: m.title,
            description: m.description ?? null,
            meetingUrl: m.meetingUrl ?? null,
            startTime: m.startTime,
            endTime: m.endTime,
            attendees: m.attendees ?? undefined,
            transcriptReady: Boolean(m.transcriptReady),
            recordingUrl: m.recordingUrl ?? null,
            speakers: m.speakers ?? undefined
        }))

        const combined: PastMeetingCard[] = [...mapped]
        const existingIds = new Set(combined.map((m) => m.id))
        for (const demo of DEMO_PAST_MEETINGS) {
            if (!existingIds.has(demo.id)) {
                combined.push(demo)
            }
        }

        return NextResponse.json({ meetings: combined })

    } catch (error) {
        console.error('failed to fetch past meetings:', error)
        return NextResponse.json({ error: 'failed to fetch past meetings', meetings: [] }, { status: 500 })
    }
}