// /api/zayavka.js — Telegram xabar yuborish (backend orqali)
// Token frontend da ko'rinmaydi

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, company, phone, country, message } = req.body;

  // Validation
  if (!name || !phone || !country || !message) {
    return res.status(400).json({ error: 'Barcha maydonlar to\'ldirilishi shart' });
  }

  // Spam oldini olish — oddiy tekshiruv
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Xabar juda uzun' });
  }

  const text =
`📦 *НОВАЯ ЗАЯВКА — TASHCOM*
━━━━━━━━━━━━━━━━━━
👤 *Имя:* ${name}
🏢 *Компания:* ${company || '—'}
📞 *Телефон:* ${phone}
🌍 *Страна:* ${country}
📝 *Запрос:*
${message}
━━━━━━━━━━━━━━━━━━
🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })}`;

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text,
          parse_mode: 'Markdown'
        })
      }
    );

    if (!tgRes.ok) {
      const err = await tgRes.json();
      console.error('Telegram error:', err);
      return res.status(500).json({ error: 'Telegram error' });
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Zayavka error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
