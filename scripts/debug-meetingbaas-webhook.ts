import "dotenv/config";

import { prisma } from "../lib/db";

const DEFAULT_WEBHOOK_URL = "http://localhost:3000/api/webhooks/meetingbaas";
const TEST_USER_ID = "user_webhook_test";
const TEST_BOT_ID = "bot_webhook_test";

function isTranscriptTestEnabled() {
  return process.env.MEETINGBAAS_WEBHOOK_TEST_INCLUDE_TRANSCRIPT === "true";
}

function mustGetEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function main() {
  // Ensure env is loaded and DB is configured.
  mustGetEnv("DATABASE_URL");

  const webhookUrl = process.env.MEETINGBAAS_WEBHOOK_TEST_URL || DEFAULT_WEBHOOK_URL;

  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {
      // Keep email null so webhook tests don't send real emails.
      email: null,
      name: "Webhook Test",
    },
    create: {
      id: TEST_USER_ID,
      clerkId: TEST_USER_ID,
      email: null,
      name: "Webhook Test",
    },
  });

  await prisma.meeting.deleteMany({
    where: {
      userId: TEST_USER_ID,
      botId: TEST_BOT_ID,
    },
  });

  const now = new Date();
  const startTime = new Date(now.getTime() - 30 * 60 * 1000);
  const endTime = new Date(now.getTime() - 5 * 60 * 1000);

  const meeting = await prisma.meeting.create({
    data: {
      userId: TEST_USER_ID,
      title: "Webhook Test Meeting",
      description: "Created by scripts/debug-meetingbaas-webhook.ts",
      meetingUrl: "https://meet.google.com/test-test-test",
      startTime,
      endTime,
      isFromCalendar: false,
      botScheduled: true,
      botSent: true,
      botId: TEST_BOT_ID,
      meetingEnded: false,
      transcriptReady: false,
      processed: false,
      ragProcessed: false,
    },
  });

  const payload = {
    event: "complete",
    data: {
      bot_id: TEST_BOT_ID,
      mp4: "https://example.com/recording.mp4",
      speakers: [{ name: "Speaker 1" }],
      ...(isTranscriptTestEnabled()
        ? {
            transcript: [
              {
                speaker: "Alex",
                words: [
                  { word: "We" },
                  { word: "reviewed" },
                  { word: "the" },
                  { word: "dashboard" },
                  { word: "issue" },
                  { word: "and" },
                  { word: "decided" },
                  { word: "to" },
                  { word: "add" },
                  { word: "polling" },
                  { word: "until" },
                  { word: "processed" },
                  { word: "is" },
                  { word: "true." },
                ],
              },
              {
                speaker: "Sam",
                words: [
                  { word: "Action" },
                  { word: "items:" },
                  { word: "deploy" },
                  { word: "the" },
                  { word: "fix" },
                  { word: "to" },
                  { word: "production" },
                  { word: "and" },
                  { word: "remove" },
                  { word: "Vercel" },
                  { word: "protection" },
                  { word: "from" },
                  { word: "the" },
                  { word: "webhook" },
                  { word: "URL." },
                ],
              },
            ],
          }
        : {
            // Default: omit transcript to keep the smoke test fast and cost-free.
          }),
    },
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();

  const updated = await prisma.meeting.findUnique({
    where: { id: meeting.id },
    select: {
      id: true,
      botId: true,
      meetingEnded: true,
      transcriptReady: true,
      processed: true,
      processedAt: true,
      summary: true,
      recordingUrl: true,
    },
  });

  // Keep output machine-readable so it's easy to inspect.
  console.log(
    JSON.stringify(
      {
        createdMeetingId: meeting.id,
        webhookUrl,
        httpStatus: response.status,
        httpBody: responseText,
        dbAfterWebhook: updated,
      },
      null,
      2,
    ),
  );

  if (!response.ok) process.exitCode = 1;
  if (!updated?.meetingEnded || !updated?.processed) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error("debug-meetingbaas-webhook failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
