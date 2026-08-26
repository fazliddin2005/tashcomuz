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
│   └── setup-webhook.js    ← Webhook ro'yxatdan o'tkazish
├── vercel.json
├── package.json
└── .env.example
```

## Deploy qilish

### 1. GitHub ga yuklash
```bash
git init
git add .
git commit -m "Tashcom initial deploy"
git remote add origin https://github.com/USERNAME/tashcom.git
git push -u origin main
```

### 2. Vercel ga ulash
1. vercel.com → "New Project" → GitHub repo tanlang
2. "Deploy" bosing

### 3. Environment Variables (Vercel Dashboard → Settings → Env Vars)
```
ANTHROPIC_API_KEY    = sk-ant-...
TELEGRAM_BOT_TOKEN   = 8832279048:AAGTRH0Z4kc1IMN_S2Ys8T9b0saNmXCvNW4
TELEGRAM_CHAT_ID     = 1519856274
```

### 4. Telegram Webhook ulash (DEPLOY DAN KEYIN 1 MARTA)
Brauzerda oching:
```
https://sizning-domen.vercel.app/api/setup-webhook
```
✅ degan javob kelsa — bot 24/7 ishlaydi!

## Ishlash tartibi
- **Sayt chat** → `/api/chat` → Claude Haiku → javob
- **Zayavka formasi** → `/api/zayavka` → Telegram sizga
- **@tashcombot ga yozsa** → `/api/webhook` → Claude Haiku → foydalanuvchiga javob + sizga bildiruv
