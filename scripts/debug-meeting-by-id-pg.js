const { Pool } = require('pg')

async function main() {
  const meetingId = process.argv[2]
  if (!meetingId) {
    console.error('Usage: node scripts/debug-meeting-by-id-pg.js <meetingId>')
    process.exit(2)
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }

  const pool = new Pool({ connectionString })
  try {
    const res = await pool.query(
      `SELECT
        m.id,
        m.title,
        m."startTime" as start_time,
        m."endTime" as end_time,
        m."botId" as bot_id,
        m."meetingEnded" as meeting_ended,
        m."transcriptReady" as transcript_ready,
        (m.transcript is not null) as has_transcript,
        m.processed,
        m."processedAt" as processed_at,
        m.summary,
        m."emailSent" as email_sent,
        m."emailSentAt" as email_sent_at,
        m."ragProcessed" as rag_processed,
        m."ragProcessedAt" as rag_processed_at,
        m."userId" as user_id,
        u.email as user_email,
        u."clerkId" as user_clerk_id
      FROM "Meeting" m
      LEFT JOIN "User" u ON u.id = m."userId"
      WHERE m.id = $1
      LIMIT 1`,
      [meetingId]
    )

    if (res.rows.length === 0) {
      console.log(JSON.stringify({ meetingId, found: false }, null, 2))
      return
    }

    const row = res.rows[0]
    const summary = row.summary
    const summaryPreview = typeof summary === 'string'
      ? summary.slice(0, 220) + (summary.length > 220 ? '…' : '')
      : null

    console.log(JSON.stringify({
      found: true,
      ...row,
      summary_preview: summaryPreview,
      summary_length: typeof summary === 'string' ? summary.length : 0,
    }, null, 2))
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
