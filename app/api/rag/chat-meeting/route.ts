import { chatWithMeeting } from "@/lib/rag";
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
                answer:
                    'I can’t answer right now because the AI quota is exceeded. Please add billing/credits to your OpenAI account (or switch keys), then try again.',
            },
        }
    }

    if (status === 401 || code === 'invalid_api_key') {
        return {
            status: 401,
            body: {
                error: 'ai_auth_failed',
                answer:
                    'I can’t answer right now because the AI API key is invalid/missing. Please check `OPENAI_API_KEY` and try again.',
            },
        }
    }

    return {
        status: 500,
        body: { error: 'failed_to_process_question' },
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

    const { meetingId, question } = await request.json()

    if (!meetingId || !question) {
        return NextResponse.json({ error: 'Missing meetingId or question' }, { status: 400 })
    }

    if (isMockAiEnabled()) {
        return NextResponse.json({
            answer: `Mock AI response (no OpenAI credits needed): I received your question: "${question}" for meeting "${meetingId}".`,
            sources: []
        })
    }

    try {
        const response = await chatWithMeeting(userId, meetingId, question)

        return NextResponse.json(response)
    } catch (error) {
        console.error('Error in chat:', error)
        const mapped = toUpstreamErrorResponse(error)
        return NextResponse.json(mapped.body, { status: mapped.status })
    }
}