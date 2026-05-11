import { Pinecone } from '@pinecone-database/pinecone'

import { requireEnv } from '@/lib/env'

let cachedIndex: ReturnType<Pinecone['index']> | null = null

function getIndex() {
    if (cachedIndex) return cachedIndex

    const { PINECONE_API_KEY, PINECONE_INDEX_NAME } = requireEnv([
        'PINECONE_API_KEY',
        'PINECONE_INDEX_NAME',
    ] as const)

    const pinecone = new Pinecone({
        apiKey: PINECONE_API_KEY,
    })

    cachedIndex = pinecone.index(PINECONE_INDEX_NAME)
    return cachedIndex
}

export async function saveManyVectors(vectors: Array<{
    id: string
    embedding: number[]
    metadata: any
}>) {
    const index = getIndex()

    const upsertData = vectors.map(v => ({
        id: v.id,
        values: v.embedding,
        metadata: v.metadata
    }))

    await index.upsert({
        records: upsertData,
    })
}

export async function searchVectors(
    embedding: number[],
    filter: any = {},
    topK: number = 5
) {
    const index = getIndex()

    const result = await index.query({
        vector: embedding,
        filter,
        topK,
        includeMetadata: true
    })

    return result.matches || []
}
