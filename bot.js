const TelegramBot = require("node-telegram-bot-api");
const fetch = require("node-fetch");

const BOT_TOKEN = process.env.BOT_TOKEN;
const MAILTM = "https://api.mail.tm";

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Store per-user session
const sessions = {};

// ─── Helpers ────────────────────────────────────────────────────────────────

function randomString(len = 10) {
  return Math.random().toString(36).substring(2, 2 + len);
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/ {2,}/g, " ")
    .trim();
}

function detectOtp(text) {
  // Match standalone 4-8 digit numbers
  const match = text.match(/\b(\d{4,8})\b/);
  return match ? match[1] : null;
}

function escapeMarkdown(text) {
  return text.replace(/[_*`[\]()~>#+=|{}.!-]/g, "\\$&");
}

async function getDomain() {
  const res = await fetch(`${MAILTM}/domains?page=1`);
  const data = await res.json();
  return data["hydra:member"][0].domain;
}

async function createAccount(address, password) {
  const res = await fetch(`${MAILTM}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password }),
  });
  return res.json();
}

async function getToken(address, password) {
  const res = await fetch(`${MAILTM}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password }),
  });
  return res.json();
}

async function safeJson(res) {
  const text = await res.text();
  if (!text || text.trim() === "") return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

async function getMessages(token) {
  const res = await fetch(`${MAILTM}/messages?page=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return safeJson(res);
}

async function getMessage(token, id) {
  const res = await fetch(`${MAILTM}/messages/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return safeJson(res);
}

async function deleteAccount(token, accountId) {
  await fetch(`${MAILTM}/accounts/${accountId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── /start ─────────────────────────────────────────────────────────────────

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || "there";

  await bot.sendMessage(
    chatId,
    `👋 *Welcome, ${name}!*\n\n` +
    `📬 I'm your *Temp Mail Bot* — get disposable email addresses instantly!\n\n` +
    `*Commands:*\n` +
    `📧 /newmail — Generate a new temp email\n` +
    `📥 /inbox — Check your inbox\n` +
    `🗑 /delete — Delete current email & session\n` +
    `ℹ️ /myemail — Show your current email\n` +
    `❓ /help — Show this help message`,
    { parse_mode: "Markdown" }
  );
});

// ─── /help ──────────────────────────────────────────────────────────────────

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    `🤖 *Temp Mail Bot — Help*\n\n` +
    `*Commands:*\n` +
    `📧 /newmail — Generate a new disposable email address\n` +
    `📥 /inbox — Check all received emails\n` +
    `🗑 /delete — Delete your current email session\n` +
    `ℹ️ /myemail — Show your active email address\n\n` +
    `_Emails are temporary and will be lost if you /delete or restart._`,
    { parse_mode: "Markdown" }
  );
});

// ─── /newmail ────────────────────────────────────────────────────────────────

bot.onText(/\/newmail/, async (msg) => {
  const chatId = msg.chat.id;

  if (sessions[chatId]) {
    await bot.sendMessage(
      chatId,
      `⚠️ You already have an active email:\n\`${sessions[chatId].email}\`\n\n` +
      `Use /delete first to generate a new one.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  await bot.sendMessage(chatId, "⏳ Generating your temp email...");

  try {
    const domain = await getDomain();

    // Retry up to 3 times in case of duplicate username or empty response
    let account, address, password;
    for (let attempt = 0; attempt < 3; attempt++) {
      const username = randomString(12);
      address = `${username}@${domain}`;
      password = randomString(16);

      try {
        const res = await fetch(`${MAILTM}/accounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, password }),
        });
        const text = await res.text();
        if (!text) continue; // empty response, retry
        account = JSON.parse(text);
        if (account.id) break; // success
      } catch (e) {
        if (attempt === 2) throw e;
      }
    }

    if (!account || !account.id) {
      await bot.sendMessage(chatId, "❌ Failed to create email after 3 attempts. Please try again with /newmail.");
      return;
    }

    const tokenData = await getToken(address, password);

    if (!tokenData.token) {
      await bot.sendMessage(chatId, "❌ Failed to authenticate. Please try /newmail again.");
      return;
    }

    sessions[chatId] = {
      email: address,
      password,
      token: tokenData.token,
      accountId: account.id,
    };

    await bot.sendMessage(
      chatId,
      `✅ *Your Temp Email is Ready!*\n\n` +
      `📧 \`${address}\`\n\n` +
      `👆 Tap to copy! Use this email anywhere.\n\n` +
      `📥 Use /inbox to check for new emails.\n` +
      `🗑 Use /delete to destroy this email.`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error(err);
    await bot.sendMessage(chatId, "❌ Something went wrong. Please try again.");
  }
});

// ─── /myemail ────────────────────────────────────────────────────────────────

bot.onText(/\/myemail/, async (msg) => {
  const chatId = msg.chat.id;

  if (!sessions[chatId]) {
    await bot.sendMessage(chatId, "❌ No active email. Use /newmail to generate one.");
    return;
  }

  await bot.sendMessage(
    chatId,
    `📧 *Your current email:*\n\`${sessions[chatId].email}\``,
    { parse_mode: "Markdown" }
  );
});

// ─── /inbox ──────────────────────────────────────────────────────────────────

bot.onText(/\/inbox/, async (msg) => {
  const chatId = msg.chat.id;

  if (!sessions[chatId]) {
    await bot.sendMessage(chatId, "❌ No active email. Use /newmail first.");
    return;
  }

  await bot.sendMessage(chatId, "🔄 Checking your inbox...");

  try {
    const data = await getMessages(sessions[chatId].token);

    if (!data || !data["hydra:member"]) {
      await bot.sendMessage(chatId, "⚠️ Could not reach mail server. Please try /inbox again in a moment.");
      return;
    }

    const messages = data["hydra:member"];

    if (!messages || messages.length === 0) {
      await bot.sendMessage(
        chatId,
        `📭 *Inbox is empty.*\n\nNo emails received yet for:\n\`${sessions[chatId].email}\`\n\n_Check again with /inbox_`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      `📬 *You have ${messages.length} email(s):*\n\n` +
      messages.map((m, i) =>
        `*${i + 1}.* 📩 From: \`${m.from.address}\`\n` +
        `    📌 Subject: ${escapeMarkdown(m.subject || "(No subject)")}\n` +
        `    🕐 ${new Date(m.createdAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata"
        })}`
      ).join("\n\n") +
      `\n\nReply with /read\\_1, /read\\_2 etc. to read a message`,
      { parse_mode: "Markdown" }
    );

    sessions[chatId].messages = messages;
  } catch (err) {
    console.error(err);
    await bot.sendMessage(chatId, "❌ Failed to fetch inbox. Try again.");
  }
});

// ─── /read_N ─────────────────────────────────────────────────────────────────

bot.onText(/\/read_(\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const index = parseInt(match[1]) - 1;

  if (!sessions[chatId]) {
    await bot.sendMessage(chatId, "❌ No active session. Use /newmail first.");
    return;
  }

  if (!sessions[chatId].messages || !sessions[chatId].messages[index]) {
    await bot.sendMessage(chatId, "❌ Invalid message number. Use /inbox to list messages.");
    return;
  }

  try {
    const msgId = sessions[chatId].messages[index].id;
    const full = await getMessage(sessions[chatId].token, msgId);

    if (!full) {
      await bot.sendMessage(chatId, "⚠️ Could not fetch email. Please try again.");
      return;
    }

    // Fix: full.html can be array of objects like [{type, value}]
    let rawBody = "";
    if (full.text) {
      rawBody = full.text.substring(0, 4000);
    } else if (full.html) {
      const htmlStr = Array.isArray(full.html)
        ? full.html.map(h => (typeof h === "string" ? h : h.value || "")).join(" ")
        : typeof full.html === "string"
          ? full.html
          : "";
      rawBody = stripHtml(htmlStr).substring(0, 4000);
    } else {
      rawBody = "(Empty message)";
    }

    // Detect OTP
    const otp = detectOtp(rawBody);
    const otpLine = otp ? `\n🔐 OTP Detected: ${otp} 👈\n` : "";

    const safeSubject = escapeMarkdown(full.subject || "(No subject)");

    // Send header with Markdown formatting
    await bot.sendMessage(
      chatId,
      `📩 *Email #${index + 1}*\n\n` +
      `*From:* \`${full.from.address}\`\n` +
      `*Subject:* ${safeSubject}\n` +
      `*Date:* ${new Date(full.createdAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata"
      })}` +
      otpLine,
      { parse_mode: "Markdown" }
    );

    // Send body as plain text — links are clickable, no escaping issues
    await bot.sendMessage(
      chatId,
      `─────────────────\n${rawBody}`,
      { disable_web_page_preview: true }
    );
  } catch (err) {
    console.error(err);
    await bot.sendMessage(chatId, "❌ Failed to read message. Try again.");
  }
});

// ─── /delete ─────────────────────────────────────────────────────────────────

bot.onText(/\/delete/, async (msg) => {
  const chatId = msg.chat.id;

  if (!sessions[chatId]) {
    await bot.sendMessage(chatId, "❌ No active email to delete.");
    return;
  }

  try {
    await deleteAccount(sessions[chatId].token, sessions[chatId].accountId);
    delete sessions[chatId];

    await bot.sendMessage(
      chatId,
      `🗑 *Email deleted successfully!*\n\nYour temp email and all its messages have been removed.\n\nUse /newmail to generate a fresh one.`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    delete sessions[chatId];
    await bot.sendMessage(chatId, "🗑 Session cleared. Use /newmail to start fresh.");
  }
});

// ─── Unknown messages ────────────────────────────────────────────────────────

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  if (msg.text && !msg.text.startsWith("/")) {
    bot.sendMessage(
      chatId,
      `💡 Use one of these commands:\n/newmail — Get a temp email\n/inbox — Check emails\n/myemail — Show current email\n/delete — Delete email\n/help — Help`
    );
  }
});

console.log("🤖 Temp Mail Bot is running...");

module.exports = bot;