import OpenAI from 'openai'

type Vector = number[]

function normalizeText(text: string) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function hashToken(token: string, dimensions: number) {
    let hash = 0
    for (let index = 0; index < token.length; index += 1) {
        hash = (hash * 31 + token.charCodeAt(index)) >>> 0
    }
    return hash % dimensions
}

function createLocalEmbedding(text: string, dimensions = 384): Vector {
    const vector = new Array(dimensions).fill(0)
    const tokens = normalizeText(text).split(' ').filter(Boolean)

    for (const token of tokens) {
        const position = hashToken(token, dimensions)
        vector[position] += 1
    }

    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
    return vector.map((value) => value / magnitude)
}

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

export async function createEmbedding(text: string) {
    return createLocalEmbedding(text)
}

export async function createManyEmbeddings(texts: string[]) {
    return texts.map((text) => createLocalEmbedding(text))
}

export async function chatWithAI(systemPrompt: string, userQuestion: string) {
    const provider = (process.env.MEETBOT_AI_PROVIDER || 'groq').toLowerCase()

    if (provider === 'mock') {
        return 'Mock AI is enabled. Please disable MEETBOT_AI_PROVIDER=mock to use the live provider.'
    }

    const client = getAiClient()
    const model = process.env.MEETBOT_AI_MODEL || (provider === 'openai' ? 'gpt-4o-mini' : 'llama-3.3-70b-versatile')

    const response = await client.chat.completions.create({
        model,
        messages: [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: userQuestion
            }
        ],
        temperature: 0.7,
        max_tokens: 500
    })

    return response.choices[0].message.content || 'sorry, I could not generate a response.'
}