import { chatWithMeeting } from "@/lib/rag";
import { MissingEnvError } from "@/lib/env";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

type UpstreamError = {
    status?: number
    response?: { status?: number }
    code?: string
    error?: { code?: string }
}

function toUpstreamErrorResponse(error: unknown) {
    if (error instanceof MissingEnvError) {
        return {
            status: 500,
            body: {
                error: 'server_misconfigured',
                missing: error.missing,
                answer:
                    'Server configuration is missing required environment variables. Please update Vercel project env vars and redeploy.',
            },
        }
    }

    const err = error as UpstreamError
    const status: number | undefined = err?.status ?? err?.response?.status
    const code: string | undefined = err?.code ?? err?.error?.code

    if (status === 429 || code === 'insufficient_quota') {
        return {
            status: 429,
            body: {
                error: 'ai_quota_exceeded',
                answer:
                    'I can’t answer right now because the AI provider quota is exceeded. Please add billing/credits or switch the provider/key, then try again.',
            },
        }
    }

    if (status === 401 || code === 'invalid_api_key') {
        return {
            status: 401,
            body: {
                error: 'ai_auth_failed',
                answer:
                    'I can’t answer right now because the AI API key is invalid/missing. Please check the configured AI key and try again.',
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
        console.error('Error in chat-meeting:', {
            name: (error as any)?.name,
            message: (error as any)?.message,
            stack: (error as any)?.stack,
        })
        const mapped = toUpstreamErrorResponse(error)
        return NextResponse.json(mapped.body, { status: mapped.status })
    }
}