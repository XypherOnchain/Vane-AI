import { Bot, InlineKeyboard } from "grammy";
import {
  askAgent,
  createAlert,
  createReport,
  extractAddress,
  fetchRadar,
  fetchToken,
  formatScanCard,
  helpText,
} from "./format.js";
import { formatUsd, shortAddress } from "@vane/shared";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}

const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
const bot = new Bot(token);

function scanKeyboard(address: string) {
  return new InlineKeyboard()
    .url("Open Scan", `${webUrl}/token/${address}`)
    .url("Graph", `${webUrl}/graph/${address}`)
    .row()
    .text("Refresh", `refresh:${address}`)
    .text("Watch cluster", `watch:${address}`);
}

async function replyScan(ctx: { reply: Function; chat?: { id: number } }, address: string) {
  const scan = await fetchToken(address);
  if (!scan) {
    await ctx.reply(`No intelligence yet for \`${address}\`. Indexing may still be running.`, {
      parse_mode: "Markdown",
    });
    return;
  }
  await ctx.reply(formatScanCard(scan), {
    parse_mode: "Markdown",
    link_preview_options: { is_disabled: true },
    reply_markup: scanKeyboard(scan.address),
  });
}

bot.command("start", async (ctx) => {
  await ctx.reply(helpText(), { parse_mode: "Markdown" });
});

bot.command("help", async (ctx) => {
  await ctx.reply(helpText(), { parse_mode: "Markdown" });
});

bot.command("commands", async (ctx) => {
  await ctx.reply(
    [
      "/vane /graph /wallet /dev /cluster",
      "/watch /ask /report /new /trending",
      "/help /commands",
    ].join("\n"),
  );
});

bot.command("vane", async (ctx) => {
  const addr = extractAddress(ctx.match || ctx.message?.text || "");
  if (!addr) return ctx.reply("Usage: /vane <token address>");
  await replyScan(ctx, addr);
});

bot.command("graph", async (ctx) => {
  const addr = extractAddress(ctx.match || "");
  if (!addr) return ctx.reply("Usage: /graph <token address>");
  await ctx.reply(`Open graph: ${webUrl}/graph/${addr}`);
});

bot.command("wallet", async (ctx) => {
  const addr = extractAddress(ctx.match || "");
  if (!addr) return ctx.reply("Usage: /wallet <address>");
  const answer = await askAgent(`Wallet DNA for ${addr}`, addr);
  await ctx.reply(answer?.answer ?? "Wallet not found", {
    parse_mode: "Markdown",
    reply_markup: new InlineKeyboard().url("Open", `${webUrl}/wallet/${addr}`),
  });
});

bot.command("dev", async (ctx) => {
  const addr = extractAddress(ctx.match || "");
  if (!addr) return ctx.reply("Usage: /dev <token>");
  const answer = await askAgent(`Who is the developer and previous launches? ${addr}`, addr);
  await ctx.reply(answer?.answer ?? "Not found", { parse_mode: "Markdown" });
});

bot.command("cluster", async (ctx) => {
  const addr = extractAddress(ctx.match || "");
  if (!addr) return ctx.reply("Usage: /cluster <token>");
  const answer = await askAgent(`Is this token bundled? ${addr}`, addr);
  await ctx.reply(answer?.answer ?? "Not found", {
    parse_mode: "Markdown",
    reply_markup: new InlineKeyboard().url("Evidence graph", `${webUrl}/graph/${addr}`),
  });
});

bot.command("watch", async (ctx) => {
  const addr = extractAddress(ctx.match || "");
  if (!addr) return ctx.reply("Usage: /watch <token>");
  await createAlert({
    kind: "cluster_sell",
    tokenAddress: addr,
    telegramChatId: String(ctx.chat.id),
  });
  await ctx.reply(`Watching cluster sells for \`${addr}\`. Vane will notify this chat.`, {
    parse_mode: "Markdown",
  });
});

bot.command("ask", async (ctx) => {
  const q = (ctx.match || "").trim();
  if (!q) return ctx.reply("Usage: /ask <question> (include an address when possible)");
  const answer = await askAgent(q, extractAddress(q) ?? undefined);
  await ctx.reply(answer?.answer ?? "No answer", { parse_mode: "Markdown" });
});

bot.command("report", async (ctx) => {
  const addr = extractAddress(ctx.match || "");
  if (!addr) return ctx.reply("Usage: /report <token>");
  const report = await createReport(addr);
  if (!report) return ctx.reply("Token not found");
  await ctx.reply(`Shareable report: ${report.url}`);
});

bot.command("new", async (ctx) => {
  const items = (await fetchRadar()) as {
    symbol?: string;
    address?: string;
    ageMinutes?: number;
    marketCapUsd?: number;
    vaneScore?: number;
  }[];
  const lines = items
    .slice(0, 8)
    .map(
      (t, i) =>
        `${i + 1}. $${t.symbol} · ${formatUsd(t.marketCapUsd ?? 0)} · ${t.ageMinutes}m · score ${t.vaneScore}\n\`${t.address}\``,
    );
  await ctx.reply(`*Radar — newest*\n\n${lines.join("\n\n")}`, {
    parse_mode: "Markdown",
    reply_markup: new InlineKeyboard().url("Open Radar", `${webUrl}/radar`),
  });
});

bot.command("trending", async (ctx) => {
  const items = (await fetchRadar()) as {
    symbol?: string;
    address?: string;
    volumeUsd?: number;
    vaneScore?: number;
  }[];
  const sorted = [...items].sort((a, b) => (b.volumeUsd ?? 0) - (a.volumeUsd ?? 0));
  const lines = sorted
    .slice(0, 8)
    .map(
      (t, i) =>
        `${i + 1}. $${t.symbol} · vol ${formatUsd(t.volumeUsd ?? 0)} · score ${t.vaneScore}\n\`${t.address}\``,
    );
  await ctx.reply(`*Radar — trending by volume*\n\n${lines.join("\n\n")}`, {
    parse_mode: "Markdown",
  });
});

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (data.startsWith("refresh:")) {
    const addr = data.slice("refresh:".length);
    await ctx.answerCallbackQuery({ text: "Refreshing…" });
    await replyScan(ctx, addr);
    return;
  }
  if (data.startsWith("watch:")) {
    const addr = data.slice("watch:".length);
    await createAlert({
      kind: "cluster_sell",
      tokenAddress: addr,
      telegramChatId: String(ctx.chat?.id ?? ""),
    });
    await ctx.answerCallbackQuery({ text: "Cluster watch on" });
    await ctx.reply(`Watching ${shortAddress(addr)}`);
  }
});

bot.on("message:text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) return;
  const addr = extractAddress(ctx.message.text);
  if (addr) {
    await replyScan(ctx, addr);
    return;
  }
  if (/^vane\b/i.test(ctx.message.text) || ctx.message.text.includes("@")) {
    const answer = await askAgent(ctx.message.text);
    if (answer) await ctx.reply(answer.answer, { parse_mode: "Markdown" });
  }
});

bot.catch((err) => {
  console.error("Bot error", err);
});

console.log("Vane Telegram bot starting…");
bot.start({
  onStart: (info) => console.log(`Bot @${info.username} online`),
});

// Periodic alert evaluation → notify chats
setInterval(async () => {
  try {
    const res = await fetch(`${process.env.API_URL ?? "http://localhost:4000"}/v1/alerts/evaluate`, {
      method: "POST",
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      fired: { message: string; telegramChatId?: string }[];
    };
    for (const f of data.fired) {
      if (!f.telegramChatId) continue;
      await bot.api.sendMessage(f.telegramChatId, f.message);
    }
  } catch {
    /* api may be down during boot */
  }
}, 60_000);
