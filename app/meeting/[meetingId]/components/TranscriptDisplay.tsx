'use client'

interface TranscriptWord {
    word: string
    start: number
    end: number
}

interface TranscriptSegment {
    words: TranscriptWord[]
    offset: number
    speaker: string
}

interface TranscriptDisplayProps {
    transcript: unknown
}

function normalizeTranscript(input: unknown): TranscriptSegment[] {
    const candidate: unknown = (() => {
        if (typeof input === 'string') {
            try {
                return JSON.parse(input)
            } catch {
                return input
            }
        }
        return input
    })()

    if (typeof candidate === 'string') {
        const words = candidate
            .split(/\s+/)
            .map((w) => w.trim())
            .filter(Boolean)
            .map((word) => ({ word, start: 0, end: 0 }))

        return words.length
            ? [{ speaker: 'Transcript', offset: 0, words }]
            : []
    }

    if (!Array.isArray(candidate)) return []

    return candidate
        .map((segmentLike: any): TranscriptSegment => {
            const speaker = typeof segmentLike?.speaker === 'string' ? segmentLike.speaker : 'Speaker'
            const offset = typeof segmentLike?.offset === 'number' ? segmentLike.offset : 0
            const words: TranscriptWord[] = Array.isArray(segmentLike?.words)
                ? segmentLike.words
                      .map((w: any): TranscriptWord | null => {
                          const word = typeof w?.word === 'string' ? w.word : ''
                          if (!word) return null
                          const start = typeof w?.start === 'number' ? w.start : 0
                          const end = typeof w?.end === 'number' ? w.end : start
                          return { word, start, end }
                      })
                      .filter((w: TranscriptWord | null): w is TranscriptWord => w !== null)
                : []

            return { speaker, offset, words }
        })
        .filter((s) => s.words.length > 0)
}

export default function TranscriptDisplay({ transcript }: TranscriptDisplayProps) {
    const segments = normalizeTranscript(transcript)

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)

        return `${minutes}:${secs.toString().padStart(2, '0')}`

    }

    const getSpeakerSegmentTime = (segment: TranscriptSegment) => {
        const startTime = segment.offset
        const endTime = segment.words[segment.words.length - 1]?.end ?? segment.offset

        return `${formatTime(startTime)} - ${formatTime(endTime)}`
    }

    const getSegmentText = (segment: TranscriptSegment) => {
        return segment.words.map(word => word.word).join(' ')
    }

    if (segments.length === 0) {
        return (
            <div className='bg-card rounded-lg p-6 border border-border text-center'>
                <p className='text-muted-foreground'>
                    No transcript available
                </p>
            </div>
        )
    }

    return (
        <div className="bg-card rounded-lg p-6 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">
                Meeting transcript
            </h3>

            <div className="space-y-4 max-h-96 overflow-y-auto">
                {segments.map((segment, index) => (
                    <div key={index} className="pb-4 border-b border-border last:border-b-0">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="font-medium text-foreground">
                                {segment.speaker}
                            </span>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                {getSpeakerSegmentTime(segment)}
                            </span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed pl-4">
                            {getSegmentText(segment)}
                        </p>
                    </div>
                ))}
            </div>

        </div>
    )
}