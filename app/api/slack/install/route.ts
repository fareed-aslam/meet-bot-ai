import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const returnTo = searchParams.get('return')

    const { userId } = await auth()

    const redirectUri = process.env.SLACK_REDIRECT_URL as string

    const stateParams = new URLSearchParams()
    if (returnTo) stateParams.set('return', returnTo)
    if (userId) stateParams.set('uid', userId)
    const state = stateParams.toString()

    const slackInstallUrl = `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=app_mentions:read,channels:read,channels:history,groups:history,groups:read,chat:write,im:history,im:read,im:write,mpim:history,mpim:read,mpim:write,users:read,users:read.email&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`

    return NextResponse.redirect(slackInstallUrl)
}