// /api/chat.js — Secure AI Chat Backend
// Rate limiting + IP check + Input validation

// In-memory rate limiter (Vercel serverless)
const ipRequests = new Map();
const RATE_LIMIT = 20;      // max so'rovlar
const RATE_WINDOW = 60000;  // 1 daqiqa (ms)
const MAX_MSG_LENGTH = 500; // max xabar uzunligi
const MAX_HISTORY = 8;      // max tarix

function getRealIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
    || req.headers['x-real-ip'] 
    || req.socket?.remoteAddress 
    || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const key = ip;
  
  if (!ipRequests.has(key)) {
    ipRequests.set(key, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  
  const data = ipRequests.get(key);
  
  // Window tugagan — reset
  if (now > data.resetAt) {
    ipRequests.set(key, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  
  // Limit oshgan
  if (data.count >= RATE_LIMIT) return false;
  
  data.count++;
  return true;
}

// Old map ni tozalash (memory leak oldini olish)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of ipRequests.entries()) {
    if (now > val.resetAt) ipRequests.delete(key);
  }
}, 300000); // har 5 daqiqada

const SYSTEM_PROMPT = `Ты — AI-ассистент компании Tashcom (ООО «TASHCOM», ИНН 309591399, Ташкент).
Tashcom занимается оптовым экспортом автозапчастей для GM Uzbekistan (Cobalt, Nexia, Gentra, Damas) из Узбекистана в СНГ.
На складе более 5000 позиций. Доставка 3–7 рабочих дней. Только B2B (оптовые поставки).
Документы: экспортная декларация, инвойс, CMR, сертификаты — берём на себя.
Оплата: SWIFT, наличная валюта, тенге, сумы.
Адрес: ул. Беларок 49, Сергелийский р-н, Ташкент.
Контакты: Telegram @tashcom_export.

ВАЖНО: Отвечай ТОЛЬКО на темы автозапчастей, экспорта, доставки, таможни, логистики.
На другие темы (политика, спорт, развлечения) отвечай: "Я специализируюсь только на автозапчастях."
Отвечай кратко (2-3 предложения). Язык — как у пользователя (рус/узб).`;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://tashcomuz.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limiting
  const ip = getRealIP(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ 
      error: 'Слишком много запросов. Подождите минуту.',
      retry_after: 60
    });
  }

  // Input validation
  const { messages } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  // Max history
  const safeMessages = messages.slice(-MAX_HISTORY).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, MAX_MSG_LENGTH)
  }));

  if (!safeMessages.length) {
    return res.status(400).json({ error: 'Empty messages' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not configured');
    return res.status(500).json({ error: 'Service unavailable' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: safeMessages
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Anthropic error:', response.status, err);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Произошла ошибка. Напишите: @tashcom_export';
    
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Chat error:', error.message);
    return res.status(500).json({ error: 'Server error' });
  }
}
