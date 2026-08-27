// /api/chat.js — Vercel Serverless Function
// API key faqat shu yerda, frontend ko'rmaydi

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages required' });
  }

  const SYSTEM_PROMPT = `Ты — AI-ассистент компании Tashcom (ООО «TASHCOM», ИНН 309591399, Ташкент, Узбекистан).
Tashcom занимается оптовым экспортом автомобильных запчастей, деталей и узлов из Узбекистана в страны СНГ: Казахстан, Кыргызстан, Таджикистан, Туркменистан, Россия.
На складе более 5000 позиций. Доставка 3–7 рабочих дней. Только оптовые поставки (B2B).
Документы: экспортная декларация, инвойс, CMR, сертификаты происхождения — всё берёт Tashcom.
Оплата: SWIFT, наличная валюта, тенге, сумы.
Адрес: ул. Беларок 49, Сергелийский р-н, Ташкент.
Контакты: Telegram @tashcom_export.

ВАЖНО: Отвечай ТОЛЬКО на темы связанные с автозапчастями, экспортом, доставкой, таможней, логистикой, автомобилями.
На вопросы не по теме (спорт, политика, знаменитости, погода) отвечай: "Я специализируюсь только на автозапчастях и экспорте. Задайте вопрос по нашей теме."
Отвечай кратко (2-4 предложения), профессионально, на языке пользователя (русский или узбекский).
Если спрашивают цену или наличие — скажи что менеджер уточнит и предложи оставить заявку на сайте.
Не придумывай цены.`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set');
    return res.status(500).json({ error: 'API key not configured' });
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
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: messages.slice(-8)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', JSON.stringify(data));
      return res.status(500).json({ error: 'AI error', detail: data.error?.message });
    }

    const reply = data.content?.[0]?.text || 'Xato yuz berdi.';
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Chat fetch error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

