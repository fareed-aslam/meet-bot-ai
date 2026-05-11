export type DemoPastMeeting = {
    id: string
    title: string
    description?: string | null
    startTime: Date
    endTime: Date
    meetingUrl: string | null
    transcriptReady: boolean
    recordingUrl?: string | null
    attendees?: unknown
}

import titlesJson from '@/scripts/data/title.json'

const titles = titlesJson as Array<{ title: string; description: string }>

const DEMO_MEETING_URL = 'https://meet.google.com/cmj-qnof-roh'
const DEMO_RECORDING_URL = 'https://meetingbot1.s3.eu-north-1.amazonaws.com/test-audio.mp3'

const demoNow = new Date()
const demoStart = new Date(demoNow.getTime() - 30 * 60 * 1000)
const demoEnd = new Date(demoNow.getTime() - 5 * 60 * 1000)

export const DEMO_PAST_MEETINGS: DemoPastMeeting[] = [
    {
        id: 'demo-meeting-1',
        title: titles[0]?.title ?? 'Quarterly Performance Review',
        description: titles[0]?.description ?? 'To discuss achievements, feedback, growth areas.',
        meetingUrl: DEMO_MEETING_URL,
        startTime: demoStart,
        endTime: demoEnd,
        transcriptReady: true,
        recordingUrl: DEMO_RECORDING_URL,
        attendees: JSON.stringify(['Arjun', 'Jake'])
    },
    {
        id: 'demo-meeting-2',
        title: titles[1]?.title ?? 'Strategic Hiring and Budget Planning Meeting',
        description: titles[1]?.description ?? 'Discussion about urgent hiring needs, salary ranges.',
        meetingUrl: DEMO_MEETING_URL,
        startTime: demoStart,
        endTime: demoEnd,
        transcriptReady: true,
        recordingUrl: DEMO_RECORDING_URL,
        attendees: JSON.stringify(['Arjun', 'Jake', 'Taylor'])
    },
    {
        id: 'demo-meeting-3',
        title: titles[2]?.title ?? 'Q4 Product Roadmap Planning and Prioritization',
        description: titles[2]?.description ?? 'Discussion on prioritizing mobile optimization, analytics enhancements.',
        meetingUrl: DEMO_MEETING_URL,
        startTime: demoStart,
        endTime: demoEnd,
        transcriptReady: true,
        recordingUrl: DEMO_RECORDING_URL,
        attendees: JSON.stringify(['Arjun', 'Jake', 'Sam', 'Morgan'])
    }
]

export const isDemoMeetingId = (meetingId?: string | null) => {
    if (!meetingId) return false
    return meetingId.startsWith('demo-meeting-')
}
