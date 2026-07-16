/**
 * Vane Debug Telegram bot — remote alerts + deep links only.
 * Never accepts signing authority for meaningful value.
 */

const TOKEN = process.env.TELEGRAM_DEBUG_BOT_TOKEN || process.env.TELEGRAM_INTELLIGENCE_BOT_TOKEN;
const API_URL = process.env.API_URL ?? "http://localhost:4000";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

async function tg(method: string, body: Record<string, unknown>) {
  if (!TOKEN) throw new Error("TELEGRAM_DEBUG_BOT_TOKEN not set");
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: boolean; result?: unknown; description?: string }>;
}

function help(): string {
  return [
    "Vane Debug bot",
    "",
    "/inspect <txHash> — pull failure summary + Open in Vane link",
    "/balance <address> — open workspace (watch-only; no custody)",
    "/help — this message",
    "",
    "Signing from chat is never accepted for meaningful value.",
  ].join("\n");
}

async function handleInspect(chatId: number | string, hash: string) {
  const res = await fetch(`${API_URL}/v1/debug/alerts/tx-failure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash: hash, telegramChatId: String(chatId) }),
  });
  const json = (await res.json()) as { message?: string; error?: string };
  const text =
    json.message ??
    json.error ??
    [
      `Inspect: ${hash}`,
      `Web: ${APP_URL}/debug/tx/${hash}`,
      `Desktop: vane://debug/tx/${hash}`,
    ].join("\n");
  await tg("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Review", url: `${APP_URL}/debug/tx/${hash}` },
          { text: "Open in Vane", url: `${APP_URL}/debug/tx/${hash}` },
        ],
      ],
    },
  });
}

async function poll() {
  if (!TOKEN) {
    console.error("[telegram-debug] TELEGRAM_DEBUG_BOT_TOKEN missing — idle");
    setInterval(() => undefined, 60_000);
    return;
  }
  console.log("[telegram-debug] polling…");
  let offset = 0;
  for (;;) {
    try {
      const data = await tg("getUpdates", { offset, timeout: 25 });
      const updates = (data.result as { update_id: number; message?: { chat: { id: number }; text?: string } }[]) ?? [];
      for (const u of updates) {
        offset = u.update_id + 1;
        const text = u.message?.text?.trim() ?? "";
        const chatId = u.message?.chat.id;
        if (!chatId || !text) continue;
        if (text.startsWith("/help") || text === "/start") {
          await tg("sendMessage", { chat_id: chatId, text: help() });
          continue;
        }
        if (text.startsWith("/inspect")) {
          const hash = text.split(/\s+/)[1];
          if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
            await tg("sendMessage", { chat_id: chatId, text: "Usage: /inspect 0x…" });
            continue;
          }
          await handleInspect(chatId, hash.toLowerCase());
          continue;
        }
        if (text.startsWith("/balance")) {
          const addr = text.split(/\s+/)[1] ?? "";
          await tg("sendMessage", {
            chat_id: chatId,
            text: [
              "Watch-only balance checks open in the desktop/workspace.",
              addr ? `Address: ${addr}` : "Provide an address.",
              `${APP_URL}/debug`,
              "vane://debug",
              "",
              "No signing from this chat.",
            ].join("\n"),
          });
          continue;
        }
        const hash = text.match(/0x[a-fA-F0-9]{64}/)?.[0];
        if (hash) {
          await handleInspect(chatId, hash.toLowerCase());
        } else {
          await tg("sendMessage", {
            chat_id: chatId,
            text: `Ask in the desktop app, or paste a tx hash.\n${APP_URL}/debug/chat\nvane://debug/chat`,
          });
        }
      }
    } catch (e) {
      console.error("[telegram-debug]", e instanceof Error ? e.message : e);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

void poll();
