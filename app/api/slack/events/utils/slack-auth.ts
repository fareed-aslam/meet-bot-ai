import { prisma } from "@/lib/db"

export async function authorizeSlack(source: { teamId?: string }) {
    try {
        const teamId = source.teamId?.trim()

        if (!teamId) {
            throw new Error('No team ID provided')
        }
        const installation = await prisma.slackInstallation.findUnique({
            where: {
                teamId
            }
        })

        if (!installation || !installation.active) {
            if (process.env.DEBUG_SLACK_AUTH === 'true') {
                const connectionString = process.env.DATABASE_URL
                if (connectionString) {
                    try {
                        const url = new URL(connectionString)
                        console.log('[slack-auth] db target:', `${url.hostname}${url.pathname}`)
                    } catch {
                        console.log('[slack-auth] db target: <unparseable DATABASE_URL>')
                    }
                } else {
                    console.log('[slack-auth] DATABASE_URL not set')
                }
            }

            console.error('installaion not found or inactive for the team:', teamId)
            throw new Error(`installation not found for team: ${teamId}`)
        }

        return {
            botToken: installation.botToken,
            teamId: installation.teamId
        }
    } catch (error) {
        console.error('auth error:', error)
        throw error
    }
}