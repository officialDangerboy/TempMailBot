# 📬 Temp Mail Telegram Bot

A Telegram bot that generates disposable email addresses using the Mail.tm API. Hosted free on Render.

---

## ⚡ Features

- `/newmail` — Generate a random disposable email
- `/inbox` — Check received emails
- `/read_1`, `/read_2` — Read specific emails
- `/myemail` — Show current email address
- `/delete` — Delete email and session
- `/help` — Show all commands

---

## 🚀 Deploy to Render (Free)

### Step 1 — Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Choose a name and username for your bot
4. Copy the **Bot Token** — you'll need it!

---

### Step 2 — Push to GitHub

1. Create a new **GitHub repository** (public or private)
2. Upload all these files to it:
   - `server.js`
   - `bot.js`
   - `package.json`
   - `.env.example` (rename to `.env` locally but DO NOT upload `.env`)

---

### Step 3 — Deploy on Render

1. Go to [https://render.com](https://render.com) and sign up (free)
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Set these settings:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment:** `Node`
5. Under **Environment Variables**, add:
   - Key: `BOT_TOKEN`
   - Value: _(paste your BotFather token)_
6. Click **Deploy**!

---

### Step 4 — Test Your Bot

1. Open Telegram
2. Search for your bot by its username
3. Send `/start` — it's live! 🎉

---

## 📁 Project Structure

```
tempmail-bot/
├── server.js        ← Express server (required by Render)
├── bot.js           ← All Telegram bot logic
├── package.json     ← Dependencies
└── .env.example     ← Example env file
```

---

## ⚠️ Notes

- Session data is stored in memory — restarts will clear all sessions
- Render's free tier may sleep after 15 mins of inactivity (bot will restart on next message)
- Do NOT commit your `.env` file or real `BOT_TOKEN` to GitHub

---

## 🛠 Tech Stack

- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- [Mail.tm API](https://api.mail.tm)
- [Express.js](https://expressjs.com)
- [Render](https://render.com)
