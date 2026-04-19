import { prisma } from "@/lib/db";
import { chatWithAllMeetings } from "@/lib/rag";
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
        body: {
            error: 'failed_to_process_question',
            answer:
                'I encountered an error while searching your meetings. Please try again in a moment.',
        },
    }
}

function isMockAiEnabled() {
    return process.env.MEETBOT_MOCK_AI === 'true'
}

export async function POST(request: NextRequest) {
    try {
        const { question, userId: slackUserId } = await request.json()

        if (!question) {
            return NextResponse.json({ error: 'missing question' }, { status: 400 })
        }

        if (isMockAiEnabled()) {
            return NextResponse.json({
                answer: `Mock AI response (no OpenAI credits needed): I received your question: "${question}".`,
                sources: []
            })
        }

        let targetUserId = slackUserId

        if (!slackUserId) {
            const { userId: clerkUserId } = await auth()
            if (!clerkUserId) {
                return NextResponse.json({ error: 'not logged in' }, { status: 401 })
            }

            targetUserId = clerkUserId
        } else {
            const user = await prisma.user.findUnique({
                where: {
                    id: slackUserId
                },
                select: {
                    clerkId: true
                }
            })

            if (!user) {
                return NextResponse.json({ error: 'user not found' }, { status: 404 })
            }

            targetUserId = user.clerkId
        }

        const response = await chatWithAllMeetings(targetUserId, question)

        return NextResponse.json(response)
    } catch (error) {
        console.error('error in chat:', error)
        const mapped = toUpstreamErrorResponse(error)
        return NextResponse.json(mapped.body, { status: mapped.status })
    }
}