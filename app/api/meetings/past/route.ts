import { prisma } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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
            return NextResponse.json({ error: "user not found" }, { status: 404 })
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

        return NextResponse.json({ meetings: pastMeetings })

    } catch (error) {
        console.error('failed to fetch past meetings:', error)
        return NextResponse.json({ error: 'failed to fetch past meetings', meetings: [] }, { status: 500 })
    }
}