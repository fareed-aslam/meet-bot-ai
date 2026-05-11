import { useChatCore } from "@/app/hooks/chat/useChatCore"
import { useAuth } from "@clerk/nextjs"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"

type TranscriptWord = { word?: string }
type TranscriptSegment = { speaker?: string; words?: TranscriptWord[] }

type ActionItem = {
    id: number
    text: string
}

export interface MeetingData {
    id: string
    title: string
    description?: string
    startTime: string
    endTime: string
    meetingEnded?: boolean
    transcriptReady?: boolean
    transcript?: unknown
    summary?: string
    actionItems?: ActionItem[]
    processed: boolean
    processedAt?: string
    recordingUrl?: string
    emailSent: boolean
    emailSentAt?: string
    userId?: string
    user?: {
        name?: string
        email?: string
    }
    ragProcessed?: boolean
}

export function useMeetingDetail() {
    const params = useParams()
    const meetingId = params.meetingId as string
    const { userId, isLoaded } = useAuth()

    const [isOwner, setIsOwner] = useState(false)
    const [userChecked, setUserChecked] = useState(false)

    const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary')
    const [localActionItems, setLocalActionItems] = useState<ActionItem[]>([])
    const [summaryRecoveryAttempted, setSummaryRecoveryAttempted] = useState(false)

    const [meetingData, setMeetingData] = useState<MeetingData | null>(null)
    const [loading, setLoading] = useState(true)
    const [processingError, setProcessingError] = useState<string | null>(null)
    const [reprocessLoading, setReprocessLoading] = useState(false)

    const chat = useChatCore({
        apiEndpoint: '/api/rag/chat-meeting',
        getRequestBody: (input) => (
            {
                meetingId, question: input
            }
        )
    })

    const handleSendMessage = async () => {
        if (!chat.chatInput.trim() || !isOwner) {
            return
        }
        await chat.handleSendMessage()
    }

    const handleSuggestionClick = (suggestion: string) => {
        if (!isOwner) {
            return
        }

        chat.handleSuggestionClick(suggestion)
    }

    const handleInputChange = (value: string) => {
        if (!isOwner) {
            return
        }

        chat.handleInputChange(value)
    }

    useEffect(() => {
        const fetchMeetingData = async () => {
            try {
                const response = await fetch(`/api/meetings/${meetingId}`, { cache: 'no-store' })
                if (!response.ok) {
                    setProcessingError(`Failed to load meeting (HTTP ${response.status}).`)
                    return
                }

                const data = await response.json()
                setMeetingData(data)

                if (isLoaded) {
                    const ownerStatus = userId === data.userId
                    setIsOwner(ownerStatus)
                    setUserChecked(true)
                }

                if (data.actionItems && data.actionItems.length > 0) {
                    setLocalActionItems(data.actionItems)
                } else {
                    setLocalActionItems([])
                }
            } catch (error) {
                console.error('error fetching meeting:', error)
                setProcessingError('Failed to load meeting. Please refresh and try again.')
            } finally {
                setLoading(false)
            }
        }
        if (isLoaded) {
            fetchMeetingData()
        }
    }, [meetingId, userId, isLoaded])

    const triggerReprocess = async () => {
        if (!meetingId) return
        setReprocessLoading(true)
        setProcessingError(null)

        try {
            const response = await fetch(`/api/meetings/${meetingId}/reprocess`, {
                method: 'POST'
            })

            if (!response.ok) {
                const text = await response.text().catch(() => '')
                setProcessingError(text || `Reprocess failed (HTTP ${response.status}).`)
                return
            }

            const refreshed = await fetch(`/api/meetings/${meetingId}`, { cache: 'no-store' })
            if (refreshed.ok) {
                const data = await refreshed.json()
                setMeetingData(data)
                if (data.actionItems && data.actionItems.length > 0) {
                    setLocalActionItems(data.actionItems)
                }
            }
        } catch (error) {
            console.error('reprocess error:', error)
            setProcessingError('Reprocess failed due to a network/server error. Please try again.')
        } finally {
            setReprocessLoading(false)
        }
    }

    // Poll meeting status until it's processed so the UI doesn't get stuck
    // on the "Processing meeting with AI" screen after the webhook finishes.
    useEffect(() => {
        if (!isLoaded || !meetingId || loading) {
            return
        }

        if (!meetingData || meetingData.processed) {
            return
        }

        let cancelled = false
        const intervalId = window.setInterval(async () => {
            try {
                const response = await fetch(`/api/meetings/${meetingId}`, { cache: 'no-store' })
                if (!response.ok) {
                    setProcessingError(`Failed to refresh meeting status (HTTP ${response.status}).`)
                    return
                }
                const data = await response.json()
                if (cancelled) {
                    return
                }
                setMeetingData(data)
                setProcessingError(null)
                if (data.actionItems && data.actionItems.length > 0) {
                    setLocalActionItems(data.actionItems)
                }
                if (data.processed) {
                    window.clearInterval(intervalId)
                }
            } catch (error) {
                console.error('error polling meeting status:', error)
                setProcessingError('Failed to refresh meeting status. Please check your connection.')
            }
        }, 5000)

        return () => {
            cancelled = true
            window.clearInterval(intervalId)
        }
    }, [isLoaded, meetingId, loading, meetingData])

    useEffect(() => {
        const processTranscript = async () => {
            try {
                const meetingResponse = await fetch(`/api/meetings/${meetingId}`)
                if (!meetingResponse.ok) {
                    return
                }
                const meeting = await meetingResponse.json()

                if (meeting.transcript && !meeting.ragProcessed && userId == meeting.userId) {
                    let transcriptText = ''
                    if (typeof meeting.transcript === 'string') {
                        transcriptText = meeting.transcript
                    } else if (Array.isArray(meeting.transcript)) {
                        transcriptText = (meeting.transcript as TranscriptSegment[])
                            .map((segment) => {
                                const words = Array.isArray(segment.words)
                                    ? segment.words.map((word) => String(word?.word ?? '').trim()).filter(Boolean).join(' ')
                                    : ''
                                return `${segment.speaker || 'Speaker'}: ${words}`.trim()
                            })
                            .join('\n')
                    }

                    await fetch('/api/rag/process', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            meetingId,
                            transcript: transcriptText,
                            meetingTitle: meeting.title
                        })
                    })
                }
            } catch (error) {
                console.error('error checking RAG processing:', error)

            }
        }
        if (isLoaded && userChecked) {
            processTranscript()
        }
    }, [meetingId, userId, isLoaded, userChecked])

    useEffect(() => {
        const recoverSummary = () => {
            if (!isLoaded || !userChecked || !isOwner || summaryRecoveryAttempted || !meetingData) {
                return
            }

            if (!meetingData.transcript || meetingData.processed) {
                return
            }

            // Don't immediately reprocess when a transcript arrives because the webhook
            // might still be running in the background (otherwise we can double-charge AI).
            const recoveryDelayMs = 90_000
            const timeoutId = window.setTimeout(async () => {
                setSummaryRecoveryAttempted(true)

                try {
                    const latest = await fetch(`/api/meetings/${meetingId}`, { cache: 'no-store' })
                    if (!latest.ok) {
                        return
                    }
                    const latestData = await latest.json()
                    if (latestData.processed) {
                        setMeetingData(latestData)
                        return
                    }

                    await triggerReprocess()
                } catch (error) {
                    console.error('summary recovery error:', error)
                }
            }, recoveryDelayMs)

            return () => window.clearTimeout(timeoutId)
        }

        return recoverSummary()
    }, [isLoaded, userChecked, isOwner, meetingData, meetingId, summaryRecoveryAttempted])


    const deleteActionItem = async (id: number) => {
        if (!isOwner) {
            return
        }

        setLocalActionItems(prev => prev.filter(item => item.id !== id))

    }

    const addActionItem = async () => {
        if (!isOwner) {
            return
        }
        try {
            const response = await fetch(`/api/meetings/${meetingId}`)
            if (response.ok) {
                const data = await response.json()
                setMeetingData(data)
                setLocalActionItems(data.actionItems || [])
            }
        } catch (error) {
            console.error('error refetching meeting data: ', error)
        }
    }

    const displayActionItems = localActionItems.length > 0
        ? localActionItems.map((item) => ({
            id: item.id,
            text: item.text
        }))
        : []


    const meetingInfoData = meetingData ? {
        title: meetingData.title,
        date: new Date(meetingData.startTime).toLocaleDateString(),
        time: `${new Date(meetingData.startTime).toLocaleTimeString()} - ${new Date(meetingData.endTime).toLocaleTimeString()}`,
        userName: meetingData.user?.name || "User"
    } : {
        title: "loading...",
        date: "loading...",
        time: "loading...",
        userName: "loading...",
    }

    return {
        meetingId,
        isOwner,
        userChecked,
        activeTab,
        setActiveTab,
        localActionItems,
        setLocalActionItems,
        meetingData,
        setMeetingData,
        loading,
        setLoading,
        processingError,
        reprocessLoading,
        triggerReprocess,
        chatInput: chat.chatInput,
        setChatInput: chat.setChatInput,
        messages: chat.messages,
        setMessages: chat.setMessages,
        showSuggestions: chat.showSuggestions,
        setShowSuggestions: chat.setShowSuggestions,
        isLoading: chat.isLoading,
        setIsLoading: chat.setIsLoading,
        handleSendMessage,
        handleSuggestionClick,
        handleInputChange,
        deleteActionItem,
        addActionItem,
        displayActionItems,
        meetingInfoData
    }

}