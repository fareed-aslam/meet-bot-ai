import { prisma } from "@/lib/db";
import { processTranscript } from "@/lib/rag";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

function toUpstreamErrorResponse(error: unknown) {
    const err = error as any
    const status: number | undefined = err?.status ?? err?.response?.status
    const code: string | undefined = err?.code ?? err?.error?.code

    if (status === 429 || code === 'insufficient_quota') {
        return {
            status: 429,
            body: {
                error: 'ai_quota_exceeded',
                message:
                    'Transcript processing requires embeddings, but the AI quota is exceeded. Please add billing/credits to your OpenAI account (or switch keys), then retry processing.',
            },
        }
    }

    if (status === 401 || code === 'invalid_api_key') {
        return {
            status: 401,
            body: {
                error: 'ai_auth_failed',
                message:
                    'Transcript processing failed because the AI API key is invalid/missing. Please check `OPENAI_API_KEY` and retry.',
            },
        }
    }

    return {
        status: 500,
        body: { error: 'failed_to_process_transcript' },
    }
}

function isMockAiEnabled() {
    return process.env.MEETBOT_MOCK_AI === 'true'
}

export async function POST(request: NextRequest) {
    const { userId } = await auth()

    if (!userId) {
        return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    const { meetingId, transcript, meetingTitle } = await request.json()

    if (!meetingId || !transcript) {
        return NextResponse.json({ error: 'Missing meetingId or transcrpt' }, { status: 400 })
    }

    if (isMockAiEnabled()) {
        return NextResponse.json({
            success: true,
            message: 'Mock mode enabled: skipping embeddings/vector processing in development.'
        })
    }

    try {
        const meeting = await prisma.meeting.findUnique({
            where: {
                id: meetingId
            },
            select: {
                ragProcessed: true,
                userId: true
            }
        })

        if (!meeting) {
            return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
        }

        if (meeting.userId !== userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        if (meeting.ragProcessed) {
            return NextResponse.json({ success: true, message: 'aldready processed' })
        }

        await processTranscript(meetingId, userId, transcript, meetingTitle)

        await prisma.meeting.update({
            where: {
                id: meetingId
            },
            data: {
                ragProcessed: true,
                ragProcessedAt: new Date()
            }
        })

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('error processing transcript:', error)
        const mapped = toUpstreamErrorResponse(error)
        return NextResponse.json(mapped.body, { status: mapped.status })
    }
}