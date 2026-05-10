import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

let prisma;

function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is not set");
    }

    return new PrismaClient({
        adapter: new PrismaPg(new Pool({ connectionString })),
    });
}

export const handler = async (event) => {
    prisma = createPrismaClient();
    try {
        console.log('Scheduler run start')
        await syncAllUserCalendars()

        await scheduleBotsForUpcomingMeetings()

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'success' })
        }
    } catch (error) {
        console.error('error:', error)
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'internal server error', details: error.message })
        }
    } finally {
        await prisma.$disconnect()
    }
}

function getMeetingBaasWebhookUrl() {
    if (process.env.WEBHOOK_URL) {
        return process.env.WEBHOOK_URL
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (appUrl) {
        return `${appUrl.replace(/\/$/, '')}/api/webhooks/meetingbaas`
    }

    return null
}

function getIntFromEnv(name, defaultValue) {
    const raw = process.env[name]
    if (!raw) return defaultValue
    const value = Number.parseInt(String(raw), 10)
    return Number.isFinite(value) ? value : defaultValue
}

async function syncAllUserCalendars() {
    const users = await prisma.user.findMany({
        where: {
            calendarConnected: true,
            googleAccessToken: {
                not: null
            }
        }
    })

    for (const user of users) {
        try {
            await syncUserCalendar(user)
        } catch (error) {
            console.error(`sync failed for ${user.id}:`, error.message)
        }
    }
}

async function syncUserCalendar(user) {
    try {
        let accessToken = user.googleAccessToken

        const now = new Date()
        const tokenExpiry = new Date(user.googleTokenExpiry)
        const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000)

        if (tokenExpiry <= tenMinutesFromNow) {
            accessToken = await refreshGoogleToken(user)
            if (!accessToken) {
                return
            }
        }
        const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
            `timeMin=${now.toISOString()}&` +
            `timeMax=${sevenDays.toISOString()}&` +
            `singleEvents=true&orderBy=startTime&showDeleted=true`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        )
        if (!response.ok) {
            if (response.status === 401) {
                await prisma.user.update({
                    where: {
                        id: user.id
                    },
                    data: {
                        calendarConnected: false
                    }
                })
                return
            }
            throw new Error(`Calendar API failed: ${response.status}`)
        }
        const data = await response.json()
        const events = data.items || []
        const existingEvents = await prisma.meeting.findMany({
            where: {
                userId: user.id,
                isFromCalendar: true,
                startTime: {
                    gte: now
                }
            }
        })

        const googleEventIds = new Set()
        for (const event of events) {
            if (event.status === 'cancelled') {
                await handleDeletedEvent(event)
                continue
            }
            googleEventIds.add(event.id)
            await processEvent(user, event)
        }

        const deletedEvents = existingEvents.filter(
            dbEvent => !googleEventIds.has(dbEvent.calendarEventId)
        )

        if (deletedEvents.length > 0) {
            for (const deletedEvent of deletedEvents) {
                await handleDeletedEventFromDB(user, deletedEvent)
            }
        }
    } catch (error) {
        console.error(`calendar error for ${user.id}:`, error.message)
        if (error.message.includes('401') || error.message.includes('403')) {
            await prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    calendarConnected: false
                }
            })
        }
    }
}

async function refreshGoogleToken(user) {
    try {
        if (!user.googleRefreshToken) {
            await prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    calendarConnected: false,
                    googleAccessToken: null
                }
            })
            return null
        }

        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                refresh_token: user.googleRefreshToken,
                grant_type: 'refresh_token'
            })
        })
        const tokens = await response.json()

        if (!tokens.access_token) {
            await prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    calendarConnected: false
                }
            })
            return null
        }

        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                googleAccessToken: tokens.access_token,
                googleTokenExpiry: new Date(Date.now() + (tokens.expires_in * 1000))
            }
        })
        return tokens.access_token
    } catch (error) {
        console.error(`token refresh error for ${user.clerkId}: `, error)
        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                calendarConnected: false
            }
        })
        return null
    }
}

async function handleDeletedEvent(event) {
    try {
        const exsistingMeeting = await prisma.meeting.findUnique({
            where: {
                calendarEventId: event.id
            }
        })
        if (exsistingMeeting) {
            await prisma.meeting.delete({
                where: {
                    calendarEventId: event.id
                }
            })
        }
    } catch (error) {
        console.error('error deleting event:', error.message)
    }
}

async function handleDeletedEventFromDB(dbEvent) {
    await prisma.meeting.delete({
        where: {
            id: dbEvent.id
        }
    })
}

async function processEvent(user, event) {
    const meetingUrl = event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri
    if (!meetingUrl || !event.start?.dateTime) {
        return
    }

    const eventData = {
        calendarEventId: event.id,
        userId: user.id,
        title: event.summary || 'Untitled Meeting',
        description: event.description || null,
        meetingUrl: meetingUrl,
        startTime: new Date(event.start.dateTime),
        endTime: new Date(event.end.dateTime),
        attendees: event.attendees ? JSON.stringify(event.attendees.map(a => a.email)) : null,
        isFromCalendar: true,
        botScheduled: true
    }

    try {
        const exsistingMeeting = await prisma.meeting.findUnique({
            where: {
                calendarEventId: event.id
            }
        })

        if (exsistingMeeting) {
            const changes = []
            if (exsistingMeeting.title !== eventData.title) changes.push('title')
            if (exsistingMeeting.startTime.getTime() !== eventData.startTime.getTime()) changes.push('time')
            if (exsistingMeeting.meetingUrl !== eventData.meetingUrl) changes.push('meeting url')
            if (exsistingMeeting.attendees !== eventData.attendees) changes.push('attendees')

            const updateData = {
                title: eventData.title,
                description: eventData.description,
                meetingUrl: eventData.meetingUrl,
                startTime: eventData.startTime,
                endTime: eventData.endTime,
                attendees: eventData.attendees
            }

            if (!exsistingMeeting.botSent) {
                updateData.botScheduled = eventData.botScheduled
            }
            await prisma.meeting.update({
                where: {
                    calendarEventId: event.id
                },
                data: updateData
            })
        } else {
            await prisma.meeting.create({
                data: eventData
            })
        }
    } catch (error) {
        console.error(`error for ${event.id}:`, error.message)
    }
}

async function scheduleBotsForUpcomingMeetings() {
    const now = new Date()
    const lateJoinMinutes = getIntFromEnv('MEETBOT_SCHEDULER_LATE_JOIN_MINUTES', 60)
    const lookAheadMinutes = getIntFromEnv('MEETBOT_SCHEDULER_LOOKAHEAD_MINUTES', 5)

    const windowStart = new Date(now.getTime() - lateJoinMinutes * 60 * 1000)
    const windowEnd = new Date(now.getTime() + lookAheadMinutes * 60 * 1000)

    const webhookUrl = getMeetingBaasWebhookUrl()
    if (!webhookUrl) {
        throw new Error('Missing WEBHOOK_URL (or NEXT_PUBLIC_APP_URL) required for MeetingBaas webhook callbacks')
    }

    const upcomingMeetings = await prisma.meeting.findMany({
        where: {
            startTime: {
                gte: windowStart,
                lte: windowEnd
            },
            endTime: {
                gt: now
            },
            botScheduled: true,
            botSent: false,
            meetingUrl: {
                not: null
            },

        },
        include: {
            user: true
        }
    })

    console.log(`Eligible meetings: ${upcomingMeetings.length} (window -${lateJoinMinutes}m..+${lookAheadMinutes}m)`) 

    for (const meeting of upcomingMeetings) {
        try {
            const canSchedule = await canUserScheduleMeeting(meeting.user)

            if (!canSchedule.allowed) {
                console.warn(`Skipping bot for meeting ${meeting.id}: ${canSchedule.reason}`)
                continue
            }
            const requestBody = {
                meeting_url: meeting.meetingUrl,
                bot_name: meeting.user.botName || 'AI Noteetaker',
                reserved: false,
                recording_mode: 'speaker_view',
                speech_to_text: { provider: "Default" },
                webhook_url: webhookUrl,
                extra: {
                    meeting_id: meeting.id,
                    user_id: meeting.userId
                }
            }

            if (meeting.user.botImageUrl) {
                requestBody.bot_image = meeting.user.botImageUrl
            }

            const response = await fetch('https://api.meetingbaas.com/bots', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-meeting-baas-api-key': process.env.MEETING_BAAS_API_KEY
                },
                body: JSON.stringify(requestBody)
            })

            if (!response.ok) {
                const bodyText = await response.text().catch(() => '')
                const errText = `meeting baas api req failed: ${response.status}${bodyText ? ` - ${bodyText}` : ''}`
                throw new Error(errText)
            }

            const data = await response.json()

            console.log(`Bot scheduled for meeting ${meeting.id}: ${data.bot_id}`)

            await prisma.meeting.update({
                where: {
                    id: meeting.id
                },
                data: {
                    botSent: true,
                    botId: data.bot_id,
                    botJoinedAt: new Date()
                }
            })

            await incrementMeetingUsage(meeting.userId)
        } catch (error) {
            console.error(`bot failed for ${meeting.title}: `, error?.stack || error)
        }

    }
}

async function canUserScheduleMeeting(user) {
    try {
        if (process.env.MEETBOT_BYPASS_LIMITS === 'true') {
            return { allowed: true }
        }

        const PLAN_LIMITS = {
            free: { meetings: 0 },
            starter: { meetings: 10 },
            pro: { meetings: 30 },
            premium: { meetings: -1 }
        }
        const limits = PLAN_LIMITS[user.currentPlan] || PLAN_LIMITS.free

        if (user.currentPlan === 'free' || user.subscriptionStatus !== 'active') {
            return {
                allowed: false,
                reason: `${user.currentPlan === 'free' ? 'Free plan' : 'Inactive subscription'} - upgrade required`
            }
        }

        if (limits.meetings !== -1 && user.meetingsThisMonth >= limits.meetings) {
            return {
                allowed: false,
                reason: `Monthly limit reached (${user.meetingsThisMonth}/${limits.meetings})`
            }
        }
        return {
            allowed: true
        }
    } catch (error) {
        console.error('error checking meeting limits:', error)
        return {
            allowed: false,
            reason: 'Error chekcing limits '
        }
    }
}

async function incrementMeetingUsage(userId) {
    try {
        await prisma.user.update({
            where: {
                id: userId
            },
            data: {
                meetingsThisMonth: {
                    increment: 1
                }
            }
        })
    } catch (error) {
        console.error('error incrementing meeting usage:', error)
    }
}

// Allow running locally: `node lambda-function/index.js`
// Optional: pass `--continuous` (or set MEETBOT_SCHEDULER_CONTINUOUS=true) to run every 60 seconds.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
    const runOnce = async () => {
        const result = await handler({ source: 'local' })
        if (result?.statusCode && result.statusCode >= 400) {
            process.exitCode = 1
        }
    }

    const continuous = process.env.MEETBOT_SCHEDULER_CONTINUOUS === 'true' || process.argv.includes('--continuous')

    if (continuous) {
        console.log('Starting scheduler loop (every 60s)...')
        runOnce().catch((e) => {
            console.error(e)
            process.exitCode = 1
        })
        setInterval(() => {
            runOnce().catch((e) => console.error(e))
        }, 60_000)
    } else {
        runOnce().catch((e) => {
            console.error(e)
            process.exitCode = 1
        })
    }
}