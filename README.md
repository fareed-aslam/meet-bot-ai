# Meet Bot — Open‑Source Meeting Intelligence Platform

Meet Bot is a full‑stack meeting intelligence SaaS that automatically joins your Zoom / Google Meet / Microsoft Teams calls, generates transcripts, AI summaries + action items, and powers an RAG chat experience across your meeting history.

It also supports a Slack integration (OAuth + posting summaries/action items into channels), plus Jira/Asana/Trello action‑item sync. Billing is handled via Stripe subscriptions, with authentication through Clerk.

## Screenshot

Add your screenshot to `public/readme/hero.png` and it will render here:

![Meet Bot Hero](<img width="1493" height="875" alt="image" src="https://github.com/user-attachments/assets/6f088d54-fa2f-4aac-b6f4-e64921fb2a27" />
)

## Features

- Automatic bot deployment to Zoom, Google Meet, and Microsoft Teams
- Transcription with speaker diarization (via meeting bot provider webhook)
- AI meeting summaries + action items (OpenAI)
- Email summary after each meeting (Resend / SMTP)
- Google Calendar connection + real-time calendar sync
- Upcoming meetings dashboard with toggle controls for bot attendance
- RAG pipeline:
	- Chat with a specific meeting
	- Chat across all meetings
	- Semantic search powered by Pinecone
- Shareable meeting links
- Slack integration:
	- OAuth install
	- Post summaries/action items into channels
	- (Optional) Slack “ask across meetings” flow through API
- Action item integrations: Jira, Asana, Trello
- 3-tier Stripe subscription management (Starter/Pro/Premium) + webhooks
- Bot personalization: custom name + profile image
- Modern responsive UI with dark theme support

## Tech Stack

This repository currently uses:

- Next.js 16 (App Router) + React 19
- TypeScript
- Tailwind CSS v4 + shadcn/ui components
- Clerk authentication
- Neon Postgres + Prisma ORM (Prisma Client generated into `lib/generated`)
- OpenAI API for summaries + embeddings
- Pinecone vector database for RAG
- Stripe subscriptions + webhook processing
- AWS S3 (audio recordings + image uploads)
- AWS Lambda (automation/scheduling helpers)

## Repository Layout

The app lives in this folder:

- `meet-bot/` — Next.js web app + API routes
	- `app/` — UI + App Router routes
	- `app/api/` — serverless API endpoints (auth, integrations, webhooks, usage, RAG)
	- `lib/` — core services (db, AI processing, RAG, integrations)
	- `prisma/` — Prisma schema
	- `scripts/` — dev scripts (seed data)
	- `lambda-function/` — Lambda package for scheduling/automation (zipped for deployment)
	- `lambda-chat/` — Lambda package for chat-related automation/reset (zipped for deployment)

## How It Works (High Level)

1. **Auth & user profile**
	 - Users sign in with Clerk.
	 - A `User` row is created/updated in Postgres via Prisma.

2. **Connect calendar**
	 - User connects Google Calendar.
	 - Calendar events become `Meeting` records.

3. **Schedule bots**
	 - Upcoming meetings can be toggled for bot attendance.
	 - A scheduler (Lambda + EventBridge in production) triggers bot deployment.

4. **Meeting completes → webhook**
	 - Your meeting-bot provider posts a “meeting complete” webhook.
	 - The webhook handler stores transcript + recording URL, then:
		 - Summarizes + extracts action items
		 - Sends email to the user
		 - Chunks transcript and upserts embeddings into Pinecone

5. **Chat (RAG)**
	 - “Chat Meeting” uses Pinecone chunks for that meeting.
	 - “Chat All” searches across all meeting chunks.

## Key Endpoints

These are the core endpoints you’ll care about:

- Meeting complete webhook: `POST /api/webhooks/meetingbaas`
- Stripe webhook: `POST /api/webhooks/stripe`
- Clerk webhook: `POST /api/webhooks/clerk`
- RAG:
	- `POST /api/rag/process`
	- `POST /api/rag/chat-meeting`
	- `POST /api/rag/chat-all`
- Slack:
	- `GET /api/slack/oauth`
	- `POST /api/slack/post-meeting`

## Local Development

### Prerequisites

- Node.js 20+
- A Postgres database (Neon recommended)
- Accounts/keys for Clerk, OpenAI, Pinecone, Stripe, Slack, Google OAuth

### Install

From the repository root:

```bash
cd meet-bot
npm install
```

### Environment Variables

Create a `.env` file in `meet-bot/`.

Minimum variables to boot the app locally:

- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Feature-specific variables:

- **Google OAuth / Calendar**
	- `GOOGLE_CLIENT_ID`
	- `GOOGLE_CLIENT_SECRET`
	- `GOOGLE_REDIRECT_URI`

- **OpenAI**
	- `OPENAI_API_KEY`
	- `MEETBOT_MOCK_AI` — set to `true` to bypass OpenAI/Pinecone calls in dev

- **Pinecone (RAG)**
	- `PINECONE_API_KEY`
	- `PINECONE_INDEX_NAME`

- **Slack**
	- `SLACK_CLIENT_ID`
	- `SLACK_CLIENT_SECRET`
	- `SLACK_SIGNING_SECRET`
	- `NEXT_PUBLIC_SLACK_CLIENT_ID`

- **Stripe**
	- `STRIPE_SECRET_KEY`
	- `STRIPE_PUBLISHABLE_KEY`
	- `STRIPE_WEBHOOK_SECRET`
	- `PRICE_ID_9`, `PRICE_ID_29`, `PRICE_ID_99`

- **Email**
	- `RESEND_API_KEY` (recommended)
	- or SMTP: `GMAIL` + `GMAIL_APP_PASSWORD`

- **AWS S3**
	- `AWS_REGION`
	- `AWS_ACCESS_KEY_ID`
	- `AWS_SECRET_ACCESS_KEY`
	- `S3_BUCKET_NAME`

- **App URL**
	- `NEXT_PUBLIC_APP_URL` (used when building redirect URLs)

### Database (Prisma)

Prisma schema: `prisma/schema.prisma`.

Typical first-time setup:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

If you prefer a quick schema sync without migrations (dev only):

```bash
npx prisma db push
```

### Run the App

```bash
npm run dev
```

Open http://localhost:3000

## Webhooks & Local Tunneling

Some integrations require a public URL in development (Stripe, Slack, meeting provider).

- Use a tunnel (ngrok or Cloudflare Tunnel)
- Set `NEXT_PUBLIC_APP_URL` to the public URL
- Update the provider dashboard to point webhooks to your tunnel URL

## Usage Limits / Plans

Plans are:

- `free` (locked in production)
- `starter` (10 meetings/mo, 30 chat/day)
- `pro` (30 meetings/mo, 100 chat/day)
- `premium` (unlimited)

Stripe webhook updates `currentPlan` + `subscriptionStatus` when subscriptions change.

## AWS Lambda Packages

This repo includes two Lambda folders with prebuilt zip artifacts:

- `lambda-function/` (scheduler/automation)
	- output zip: `lambda-scheduler-updated.zip`
- `lambda-chat/` (chat reset/automation)
	- output zip: `lambda-chat-reset.zip`

Notes:

- These Lambdas use Prisma v7 with the Postgres driver adapter (`@prisma/adapter-pg` + `pg`).
- Deploy via AWS Console (zip upload) or your preferred IaC.

## Seeding Demo Data (Optional)

There’s a dev seed script at `scripts/seed-meetings.ts` that inserts sample meetings/transcripts.

It’s TypeScript and uses path aliases, so the easiest way to run it is:

```bash
npx tsx scripts/seed-meetings.ts
```

If you don’t have `tsx`, install it as a dev dependency.

## Security Notes (Important)

- Never commit `.env` files.
- If any secrets were ever pasted into chat, logs, or public repos, assume they are compromised and rotate them immediately.
- Webhooks (Stripe/Clerk) must be validated using their signing secrets.

## Contributing

- Issues and PRs are welcome.
- Please include reproduction steps and screenshots where relevant.

## License

Add your license here (MIT/Apache-2.0/etc.).
