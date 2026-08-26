// /api/chat.js — Vercel Serverless Function
// API key faqat shu yerda, frontend ko'rmaydi

export default async function handler(req, res) {
  // CORS — faqat o'z domeningizdan
  res.setHeader('Access-Control-Allow-Origin', '*'); // deploy qilgach o'z domeningizni yozing
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages required' });
  }

  // Rate limiting — bir IP dan ko'p so'rov oldini olish
  // (Vercel da oddiy in-memory, production uchun Redis tavsiya)
  
  const SYSTEM_PROMPT = `Ты — AI-ассистент компании Tashcom (ООО «TASHCOM», ИНН 309591399, Ташкент, Узбекистан).
Tashcom занимается оптовым экспортом автомобильных запчастей, деталей и узлов из Узбекистана в страны СНГ: Казахстан, Кыргызстан, Таджикистан, Туркменистан, Россия.
На складе более 5000 позиций. Доставка 3–7 рабочих дней. Только оптовые поставки (B2B).
Документы: экспортная декларация, инвойс, CMR, сертификаты происхождения — всё берёт Tashcom.
Оплата: SWIFT, наличная валюта, тенге, сумы.
Адрес: ул. Беларок 49, Сергелийский р-н, Ташкент.
Контакты: Telegram @tashcom_export.
Отвечай кратко, профессионально, на том языке на котором пишет пользователь.
Если спрашивают цену или наличие — скажи что уточнишь у менеджера и предложи оставить заявку.
Не придумывай цены. Будь дружелюбным.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY, // Vercel Environment Variable
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // tez va arzon model
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: messages.slice(-8) // oxirgi 8 xabar
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Anthropic error:', err);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Xato yuz berdi.';
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
