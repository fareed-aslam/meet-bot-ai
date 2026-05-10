import { sendMeetingSummaryEmail as sendViaGmail } from '@/lib/email-service-free'
import { sendMeetingSummaryEmail as sendViaResend } from '@/lib/email-service'

type EmailData = Parameters<typeof sendViaResend>[0]

export async function sendMeetingSummaryEmail(data: EmailData) {
    if (process.env.RESEND_API_KEY) {
        return sendViaResend(data)
    }

    return sendViaGmail(data)
}
