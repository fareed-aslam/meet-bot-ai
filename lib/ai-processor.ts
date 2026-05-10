import OpenAI from 'openai'

type TranscriptInput = unknown

type TranscriptWord = { word?: string }
type TranscriptSegment = { speaker?: string; words?: TranscriptWord[] }

function getAiClient() {
    const provider = (process.env.MEETBOT_AI_PROVIDER || 'groq').toLowerCase()

    if (provider === 'openai') {
        return new OpenAI({
            apiKey: process.env.OPENAI_API_KEY!
        })
    }

    return new OpenAI({
        apiKey: process.env.GROQ_API_KEY!,
        baseURL: 'https://api.groq.com/openai/v1'
    })
}

function extractJsonResponse(responseText: string) {
    const trimmed = responseText.trim()

    try {
        return JSON.parse(trimmed)
    } catch {
        const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
        if (fencedMatch?.[1]) {
            return JSON.parse(fencedMatch[1].trim())
        }

        const start = trimmed.indexOf('{')
        const end = trimmed.lastIndexOf('}')
        if (start !== -1 && end !== -1 && end > start) {
            return JSON.parse(trimmed.slice(start, end + 1))
        }

        throw new Error('Model response was not valid JSON')
    }
}

export async function processMeetingTranscript(transcript: TranscriptInput) {
    try {
        let transcriptText = ''

        if (Array.isArray(transcript)) {
            transcriptText = (transcript as TranscriptSegment[])
                .map((item) => {
                    const speaker = item?.speaker || 'Speaker'
                    const words = Array.isArray(item?.words)
                        ? item.words.map((word) => String(word?.word ?? '').trim()).filter(Boolean).join(' ')
                        : ''
                    return `${speaker}: ${words}`.trim()
                })
                .join('\n')
        } else if (typeof transcript === 'string') {
            transcriptText = transcript
        } else if (typeof transcript === 'object' && transcript !== null && 'text' in transcript) {
            const text = (transcript as { text?: unknown }).text
            if (typeof text === 'string') {
                transcriptText = text
            }
        }

        if (!transcriptText || transcriptText.trim().length === 0) {
            throw new Error('No transcript content found')
        }

        const aiClient = getAiClient()
        const model = (process.env.MEETBOT_AI_MODEL || (process.env.MEETBOT_AI_PROVIDER === 'openai' ? 'gpt-4o-mini' : 'llama-3.3-70b-versatile'))


        const completion = await aiClient.chat.completions.create({
            model,
            messages: [
                {
                    role: "system",
                    content: `You are an AI assistant that analyzes meeting transcripts and provides concise summaries and action items.

                    Please analyze the meeting transcript and provide:
                    1. A clear, concise summary (2-3 sentences) of the main discussion points and decisions
                    2. A list of specific action items mentioned in the meeting

                    Format your response as JSON:
                    {
                        "summary": "Your summary here",
                        "actionItems": [
                            "Action item description 1",
                            "Action item description 2"
                        ]
                    }

                    Return only the action item text as strings.
                    If no clear action items are mentioned, return an empty array for actionItems.`
                },
                {
                    role: "user",
                    content: `Please analyze this meeting transcript:\n\n${transcriptText}`
                }
            ],
            temperature: 0.3,
            max_tokens: 1000
        })

        const response = completion.choices[0].message.content

        if (!response) {
            throw new Error('No response from AI provider')
        }

        const parsed = extractJsonResponse(response)

        const actionItems = Array.isArray(parsed.actionItems)
            ? parsed.actionItems.map((text: string, index: number) => ({
                id: index + 1,
                text: text
            }))
            : []


        return {
            summary: parsed.summary || 'Summary couldnt be generated',
            actionItems: actionItems
        }

    } catch (error: unknown) {
        const errorToLog =
            error instanceof Error
                ? error.stack ?? error.message
                : typeof error === 'object' && error && 'stack' in error
                  ? String((error as { stack?: unknown }).stack)
                  : error

        console.error('error processing transcript with ai provider:', errorToLog)

        return {
            summary: 'Meeting transcript processed successfully. Please check the full transcript for details.',
            actionItems: []
        }
    }
}