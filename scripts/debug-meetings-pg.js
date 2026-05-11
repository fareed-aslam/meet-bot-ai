const { Pool } = require('pg')

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }
  const pool = new Pool({ connectionString })
  try {
    const now = new Date()
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const res = await pool.query(
      `SELECT m.id, m.title, m."startTime" as start_time, m."endTime" as end_time, m."meetingUrl" as meeting_url, m."botScheduled" as bot_scheduled, m."botSent" as bot_sent, m."botId" as bot_id, m."meetingEnded" as meeting_ended, m."transcriptReady" as transcript_ready, m.processed, m."emailSent" as email_sent, m."ragProcessed" as rag_processed, m."processedAt" as processed_at, m."ragProcessedAt" as rag_processed_at, m.attendees, m."userId" as user_id, m.transcript, m.summary, u.email as user_email, u.name as user_name
       FROM "Meeting" m
       LEFT JOIN "User" u ON u.id = m."userId"
       WHERE m."endTime" >= now() - interval '7 days'
       ORDER BY m."endTime" DESC`,
      []
    )

    console.log(JSON.stringify(res.rows, null, 2))
  } finally {
    await pool.end()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
