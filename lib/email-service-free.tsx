import MeetingSummaryEmailNew from '@/app/components/email/meeting-summary'
import { render } from '@react-email/render'
import nodemailer from 'nodemailer'

interface EmailData {
    userEmail: string
    userName: string
    meetingTitle: string
    summary: string
    actionItems: Array<{
        id: number
        text: string
    }>
    meetingId: string
    meetingDate: string
}

const gmailUser = process.env.GMAIL_USER || process.env.GMAIL
const gmailPassword = process.env.GMAIL_APP_PASSWORD

if (!gmailUser || !gmailPassword) {
    console.warn('Gmail email is not configured: set GMAIL_USER (or GMAIL) and GMAIL_APP_PASSWORD')
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: gmailUser,
        pass: gmailPassword
    }
})

export async function sendMeetingSummaryEmail(data: EmailData) {
    try {
        if (!gmailUser || !gmailPassword) {
            throw new Error('Gmail email is not configured: set GMAIL_USER (or GMAIL) and GMAIL_APP_PASSWORD')
        }

        const emailHtml = await render(
            <MeetingSummaryEmailNew
                userName={data.userName}
                meetingTitle={data.meetingTitle}
                summary={data.summary}
                actionItems={data.actionItems}
                meetingId={data.meetingId}
                meetingDate={data.meetingDate}
            />
        )

        const result = await transporter.sendMail({
            from: `"Meeting Bot" <${gmailUser}>`,
            to: data.userEmail,
            subject: `Meeting Summary Ready - ${data.meetingTitle}`,
            html: emailHtml
        })

        return result
    } catch (error) {
        console.error('error sending email:', error)
        throw error
    }
}