import { prisma } from "@/lib/db";
import { canUserSendBot, incrementMeetingUsage } from "@/lib/usage";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.json({ error: 'Not authed' }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: {
                clerkId: userId
            },
            select: {
                id: true,
            }
        })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const meetingCheck = await canUserSendBot(user.id)

        if (!meetingCheck.allowed) {
            return NextResponse.json({
                error: meetingCheck.reason,
                upgradeRequired: true
            }, { status: 403 })
        }

        await incrementMeetingUsage(user.id)

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: 'failed to incrmeent usage' }, { status: 500 })
    }
}