import { chatWithMeeting } from "@/lib/rag";
import { MissingEnvError } from "@/lib/env";
import { isDemoMeetingId } from "@/lib/demoMeetings";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import actionItemsJson from '@/scripts/data/action-items.json'
import summaryJson from '@/scripts/data/summaries.json'
import transcript1 from '@/scripts/data/transcripts/transcript1.json'
import transcript2 from '@/scripts/data/transcripts/transcript2.json'
import transcript3 from '@/scripts/data/transcripts/transcript3.json'
import titlesJson from '@/scripts/data/title.json'

type TranscriptWord = { word?: string }
type TranscriptSegment = { speaker?: string; words?: TranscriptWord[] }

type UpstreamError = {
    status?: number
    response?: { status?: number }
    code?: string
    error?: { code?: string }
    name?: string
    message?: string
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

    const pineconeName = (error as any)?.name
    const pineconeMessage = (error as any)?.message
    if (
        pineconeName === 'PineconeBadRequestError' &&
        typeof pineconeMessage === 'string' &&
        pineconeMessage.includes('Vector dimension') &&
        pineconeMessage.includes('does not match the dimension of the index')
    ) {
        return {
            status: 500,
            body: {
                error: 'rag_misconfigured',
                answer:
                    'Vector search is misconfigured: the embedding dimension does not match the Pinecone index dimension. Fix by setting MEETBOT_EMBEDDING_DIMENSIONS to match the index (e.g. 1536) and ensuring PINECONE_INDEX_NAME points to that index, then redeploy.',
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

function transcriptToText(transcript: unknown) {
    if (!transcript) return ''
    if (typeof transcript === 'string') return transcript
    if (!Array.isArray(transcript)) return ''

    return (transcript as TranscriptSegment[])
        .map((segment) => {
            const words = Array.isArray(segment.words)
                ? segment.words
                    .map((w) => String(w?.word ?? '').trim())
                    .filter(Boolean)
                    .join(' ')
                : ''
            return `${segment.speaker || 'Speaker'}: ${words}`.trim()
        })
        .filter(Boolean)
        .join('\n')
}

function getDemoMeetingContent(meetingId: string) {
    const titles = titlesJson as Array<{ title: string; description: string }>
    const summary = String((summaryJson as { summary?: string }).summary ?? '')
    const actionItems = actionItemsJson as Array<{ id: number; text: string }>

    const match = meetingId === 'demo-meeting-1'
        ? { idx: 0, transcript: transcript1 as unknown }
        : meetingId === 'demo-meeting-2'
            ? { idx: 1, transcript: transcript2 as unknown }
            : meetingId === 'demo-meeting-3'
                ? { idx: 2, transcript: transcript3 as unknown }
                : null

    if (!match) return null

    const title = titles[match.idx]?.title ?? 'Demo Meeting'
    const transcriptText = transcriptToText(match.transcript)

    return {
        title,
        summary,
        actionItems,
        transcriptText,
    }
}

function answerDemoQuestion(meetingId: string, question: string) {
    const content = getDemoMeetingContent(meetingId)
    if (!content) {
        return {
            answer: `I couldn't find demo content for meeting "${meetingId}".`,
            sources: [],
        }
    }

    const q = question.toLowerCase()
    const actionItemsText = content.actionItems.length
        ? content.actionItems.map((item) => `• ${item.text}`).join('\n')
        : 'No action items were provided.'

    if (q.includes('action item') || q.includes('next step') || q.includes('todo')) {
        return {
            answer: `Here are the key action items from "${content.title}":\n\n${actionItemsText}`,
            sources: [],
        }
    }

    if (q.includes('follow-up email') || q.includes('follow up email') || q.includes('write a follow') || q.includes('email')) {
        return {
            answer: `Subject: Follow-up from ${content.title}\n\nHi team,\n\nQuick recap from our meeting:\n${content.summary || '(No summary available)'}\n\nAction items:\n${actionItemsText}\n\nThanks,\n`,
            sources: [],
        }
    }

    if (q.includes('summary') || q.includes('summarize')) {
        return {
            answer: content.summary || `No summary is available for "${content.title}".`,
            sources: [],
        }
    }

    if (q.includes('transcript') || q.includes('what was said') || q.includes('what did') || q.includes('discussion')) {
        const excerpt = content.transcriptText.slice(0, 900)
        return {
            answer: excerpt
                ? `Here’s an excerpt from the transcript of "${content.title}":\n\n${excerpt}${content.transcriptText.length > 900 ? '…' : ''}`
                : `No transcript text is available for "${content.title}".`,
            sources: [],
        }
    }

    return {
        answer: `Based on the demo meeting "${content.title}":\n\n${content.summary || '(No summary available)'}\n\nIf you want, ask specifically for “action items” or “write a follow-up email”.`,
        sources: [],
    }
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

    if (isDemoMeetingId(meetingId)) {
        return NextResponse.json(answerDemoQuestion(meetingId, question))
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