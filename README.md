# Tashcom — Auto Parts Export Website

## Loyiha tuzilmasi
```
tashcom-vercel/
├── public/
│   └── index.html          ← Sayt (frontend)
├── api/
│   ├── chat.js             ← AI chat (Claude Haiku)
│   ├── zayavka.js          ← Zayavka → Telegram
│   ├── webhook.js          ← Telegram bot (24/7 AI)
│   └── setup-webhook.js    ← Webhook sozlash
├── vercel.json
└── package.json
```

## Deploy qilish

### 1. GitHub ga yuklash
```bash
git init
git add .
git commit -m "initial deploy"
git push
```

### 2. Vercel ga ulash
vercel.com → New Project → GitHub repo → Deploy

### 3. Environment Variables
Vercel Dashboard → Settings → Environment Variables:
```
ANTHROPIC_API_KEY    = [Anthropic console dan oling]
TELEGRAM_BOT_TOKEN   = [BotFather dan oling]
TELEGRAM_CHAT_ID     = [Sizning Telegram ID]
```

### 4. Telegram Webhook (1 marta)
```
https://sizning-domen.vercel.app/api/setup-webhook
```
