// /api/zayavka.js — Secure Telegram Sender
// Rate limiting + validation + spam protection

const ipZayavka = new Map();
const ZAV_LIMIT = 5;       // max 5 zayavka
const ZAV_WINDOW = 3600000; // 1 soat

function getRealIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || 'unknown';
}

function checkZayavkaLimit(ip) {
  const now = Date.now();
  if (!ipZayavka.has(ip)) {
    ipZayavka.set(ip, { count: 1, resetAt: now + ZAV_WINDOW });
    return true;
  }
  const data = ipZayavka.get(ip);
  if (now > data.resetAt) {
    ipZayavka.set(ip, { count: 1, resetAt: now + ZAV_WINDOW });
    return true;
  }
  if (data.count >= ZAV_LIMIT) return false;
  data.count++;
  return true;
}

// Spam so'zlarini tekshirish
function isSpam(text) {
  const spamWords = ['http://', 'https://', 'telegram.me', 't.me', 'bitcoin', 'crypto', 'casino'];
  const lower = text.toLowerCase();
  return spamWords.some(w => lower.includes(w));
}

// Telefon raqam validatsiya
function isValidPhone(phone) {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return /^\+?[0-9]{7,15}$/.test(cleaned);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://tashcomuz.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit
  const ip = getRealIP(req);
  if (!checkZayavkaLimit(ip)) {
    return res.status(429).json({ error: 'Слишком много заявок. Попробуйте через час.' });
  }

  const { name, company, phone, country, message } = req.body || {};

  // Validation
  if (!name || !phone || !country || !message) {
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  }
  if (name.length > 100 || phone.length > 30 || message.length > 3000) {
    return res.status(400).json({ error: 'Данные слишком длинные' });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: 'Неверный формат телефона' });
  }
  if (isSpam(message) || isSpam(name)) {
    return res.status(400).json({ error: 'Недопустимое содержимое' });
  }

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TOKEN || !CHAT_ID) {
    console.error('Telegram env vars not set');
    return res.status(500).json({ error: 'Service unavailable' });
  }

  const text = `📦 *НОВАЯ ЗАЯВКА — TASHCOM*
━━━━━━━━━━━━━━━━━━
👤 *Имя:* ${name}
🏢 *Компания:* ${company || '—'}
📞 *Телефон:* ${phone}
🌍 *Страна:* ${country}
📝 *Запрос:*
${message.slice(0, 2000)}
━━━━━━━━━━━━━━━━━━
🌐 *IP:* ${ip}
🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })}`;

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text,
          parse_mode: 'Markdown'
        })
      }
    );

    if (!tgRes.ok) {
      const err = await tgRes.json().catch(() => ({}));
      console.error('Telegram error:', err);
      return res.status(500).json({ error: 'Delivery failed' });
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Zayavka error:', error.message);
    return res.status(500).json({ error: 'Server error' });
  }
}
