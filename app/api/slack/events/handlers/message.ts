import { prisma } from "@/lib/db";
import { isDuplicateEvent } from "../utils/isduplicate";

export async function handleMessage({ message, say, client }: any) {
  try {
    if (
      message.subtype === "bot_message" ||
      !("user" in message) ||
      !("text" in message)
    ) {
      return;
    }

    if (message.user && message.user.startsWith("B")) {
      return;
    }
    const authTest = await client.auth.test();

    if (message.user == authTest.user_id) {
      return;
    }

    const text = message.text || "";

    if (text.includes(`<@${authTest.user_id}>`)) {
      return;
    }

    const eventId = `message-${message.channel}-${message.user}`;
    const eventTs = message.ts;

    if (isDuplicateEvent(eventId, eventTs)) {
      return;
    }

    const slackUserId = message.user;

    if (!slackUserId) {
      return;
    }

    const teamId = authTest.team_id as string | undefined;

    const cleanText = text.replace(/<@[^>]+>/g, "").trim();

    if (!cleanText) {
      await say(
        "👋 Hi! Ask me anything about your meetings. For example:\n· What were the key decisions in yesterday's meeting?\n· Summarize yesterday's meeting action items\n· Who attended the product planning session?",
      );
      return;
    }

    let user = await prisma.user.findFirst({
      where: {
        slackUserId,
      },
    });

    let userEmail: string | undefined;
    if (!user) {
      const userInfo = await client.users.info({ user: slackUserId });
      userEmail = userInfo.user?.profile?.email;

      if (userEmail) {
        user = await prisma.user.findFirst({
          where: {
            email: userEmail,
          },
        });
      }
    }

    if (!user) {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
      const connectUrl = appUrl ? `${appUrl}/integrations?setup=slack` : "";

      await say({
        text: "Account not found",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: userEmail
                ? `Hi! I can’t find a Meetbot account for *${userEmail}*.`
                : `Hi! I can’t find a Meetbot account linked to your Slack user.`,
            },
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: connectUrl
                  ? `If you already have an account, connect Slack here: ${connectUrl}`
                  : "Please sign up (or connect Slack in the web app), then try again.",
              },
            ],
          },
        ],
      });
      return;
    }

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        slackUserId: slackUserId,
        slackTeamId: teamId || null,
        slackConnected: true,
      },
    });
    await say("🤖 Searching through your meetings...");

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/rag/chat-all`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: cleanText,
          userId: user.id,
        }),
      },
    );

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const messageFromApi =
        data?.answer || data?.message || data?.error || null;
      await say(
        messageFromApi ||
          "I couldn’t search your meetings right now. Please try again.",
      );
      return;
    }

    if (data.answer) {
      const answer = data.answer;

      await say({
        text: "Meeting Assistant Response",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `🤖 *Meeting Assistant*\n\n${answer}`,
            },
          },
          {
            type: "divider",
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `💡 Ask me about meetings, decisions, action items or participants`,
              },
            ],
          },
        ],
      });
    } else {
      await say(
        "sorry, i encountered an error searching through your meetings",
      );
    }
  } catch (error) {
    console.error("app mention handler error:", error);
    await say("sory, something went wrong. please try again");
  }
}
