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
                const response = await fetch(`/api/meetings/${meetingId}`)
                if (response.ok) {
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
                }
            } catch (error) {
                console.error('error fetching meeting:', error)
            } finally {
                setLoading(false)
            }
        }
        if (isLoaded) {
            fetchMeetingData()
        }
    }, [meetingId, userId, isLoaded])

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
        const recoverSummary = async () => {
            if (!isLoaded || !userChecked || !isOwner || summaryRecoveryAttempted || !meetingData) {
                return
            }

            if (!meetingData.transcript || meetingData.processed) {
                return
            }

            setSummaryRecoveryAttempted(true)

            try {
                const response = await fetch(`/api/meetings/${meetingId}/reprocess`, {
                    method: 'POST'
                })

                if (!response.ok) {
                    console.error('summary recovery failed:', await response.text())
                    return
                }

                const refreshed = await fetch(`/api/meetings/${meetingId}`)
                if (refreshed.ok) {
                    const data = await refreshed.json()
                    setMeetingData(data)
                    if (data.actionItems && data.actionItems.length > 0) {
                        setLocalActionItems(data.actionItems)
                    }
                }
            } catch (error) {
                console.error('summary recovery error:', error)
            }
        }

        recoverSummary()
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