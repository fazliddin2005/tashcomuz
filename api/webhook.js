// /api/webhook.js — Tashcom Telegram Bot (24/7)
// Features: scope filter, FAQ, AI zayavka, operator handoff

const SYSTEM_PROMPT = `Ты — AI-ассистент компании Tashcom. Специализация: оптовый экспорт автомобильных запчастей из Узбекистана в страны СНГ.

СТРОГИЕ ПРАВИЛА:
1. Отвечай ТОЛЬКО на вопросы связанные с: автозапчастями, экспортом/импортом, доставкой, таможней, оптовой торговлей, логистикой, автомобилями.
2. На любой вопрос НЕ по теме (политика, спорт, знаменитости, развлечения, медицина и т.д.) отвечай ТОЛЬКО: "Я специализируюсь только на автозапчастях и экспорте. Задайте вопрос по нашей теме или выберите из FAQ 👇"
3. Никогда не отвечай на вопросы о Роналду, Трампе, погоде, рецептах, и подобном.

О КОМПАНИИ:
- Tashcom (ООО, ИНН 309591399) — Ташкент, ул. Беларок 49, Сергелийский р-н
- Экспорт в: Казахстан, Кыргызстан, Таджикистан, Туркменистан, Россия
- Склад: 5000+ позиций, только оптовые поставки (B2B)
- Доставка: 3–7 рабочих дней
- Документы: экспортная декларация, инвойс, CMR, сертификаты происхождения
- Оплата: SWIFT, наличная валюта, тенге, сумы
- Telegram: @tashcom_export

СБОР ЗАЯВКИ:
Если пользователь хочет заказать или оставить заявку, собери по очереди:
1. Имя и название компании
2. Список запчастей (название, артикул если есть, количество)  
3. Страна и город доставки
4. Контактный телефон/WhatsApp
После получения всех данных скажи: "ЗАЯВКА_ГОТОВА:[данные]" точно в таком формате.

ПЕРЕДАЧА ОПЕРАТОРУ:
Если пользователь пишет что хочет говорить с человеком/оператором/менеджером, ответь: "ОПЕРАТОР_НУЖЕН"

Отвечай кратко (2-4 предложения). Язык — как у пользователя (рус/узб).`;

// Session storage (in-memory, Vercel serverless)
const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      history: [],
      awaitingZayavka: false,
      operatorMode: false,
      zayavkaData: {}
    });
  }
  return sessions.get(chatId);
}

// Telegram helpers
async function tgSend(chatId, text, token, extra = {}) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...extra })
  });
}

async function tgAction(chatId, token) {
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' })
  });
}

// FAQ inline keyboard
function getFAQKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🌍 Qaysi davlatlarga yetkazasiz?', callback_data: 'faq_countries' }],
      [{ text: '📦 Omborda nima bor?', callback_data: 'faq_stock' }],
      [{ text: '⏱ Yetkazib berish muddati?', callback_data: 'faq_delivery' }],
      [{ text: '📄 Hujjatlar qanday?', callback_data: 'faq_docs' }],
      [{ text: '💳 Qanday to\'lov usullari?', callback_data: 'faq_payment' }],
      [{ text: '📋 Zaявка qoldirish', callback_data: 'start_zayavka' }],
      [{ text: '👨‍💼 Operator bilan gaplashish', callback_data: 'need_operator' }]
    ]
  };
}

// FAQ answers
const FAQ_ANSWERS = {
  faq_countries: `🌍 *Eksport yo'nalishlari:*\n\n🇰🇿 Qozog'iston (Almaty, Shymkent, Astana)\n🇰🇬 Qirg'iziston (Bishkek, O'sh)\n🇹🇯 Tojikiston (Dushanbe, Xo'jand)\n🇹🇲 Turkmaniston (Ashxabod)\n🇷🇺 Rossiya (Sibir, Ural)\n\nBoshqa davlatlar — alohida kelishuv asosida.`,
  faq_stock: `📦 *Ombor assortimenti:*\n\n✅ 5000+ pozitsiya doimo zaxirada\n⚙️ Dvigatel detallari\n🔩 Transmissiya uzellari\n🛞 Tormoz tizimi\n🔧 Osma qismlari\n💡 Elektr jihozlar\n🏗️ Kuzov qismlari\n🚚 Yuk avto ehtiyot qismlari\n\nFaqat ulgurji (B2B) savdo.`,
  faq_delivery: `⏱ *Yetkazib berish muddati:*\n\n📍 Toshkent ichida: 1 kun\n🇰🇿🇰🇬🇹🇯 Qo'shni davlatlar: 3–5 ish kuni\n🇷🇺 Rossiya: 5–7 ish kuni\n\nHar bir jo'natma GPS monitoring va Telegram orqali kuzatiladi.`,
  faq_docs: `📄 *Hujjatlar paketi:*\n\n✅ Eksport deklaratsiyasi\n✅ Invoice (hisobvaraq)\n✅ CMR (xalqaro yuk xati)\n✅ Kelib chiqish sertifikati\n✅ Spetsifikatsiya\n\nBarcha bojxona rasmiylashtiruvi *biz zimmasida*.`,
  faq_payment: `💳 *To'lov usullari:*\n\n🏦 SWIFT bank o'tkazmasi\n💵 Naqd valyuta (USD, EUR)\n🇰🇿 Qozog'iston tenges\n🇺🇿 O'zbek so'mi\n📱 Boshqa usullar — kelishuv asosida\n\nAvans 30-50%, qoldig'i yuk jo'natilganda.`
};

// Get AI reply
async function getAIReply(session, userMessage, apiKey) {
  session.history.push({ role: 'user', content: userMessage });
  const messages = session.history.slice(-12);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
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
      messages
    })
  });

  const data = await res.json();
  const reply = data.content?.[0]?.text || 'Xatolik yuz berdi. Qaytadan urinib ko\'ring.';
  session.history.push({ role: 'assistant', content: reply });
  if (session.history.length > 24) session.history.splice(0, 2);
  return reply;
}

// Notify manager
async function notifyManager(type, info, token, managerChatId) {
  let text = '';
  if (type === 'zayavka') {
    text = `📦 *YANGI ZAЯВKA (bot orqali)*\n━━━━━━━━━━━━━━━━━━\n${info}\n━━━━━━━━━━━━━━━━━━\n🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })}`;
  } else if (type === 'operator') {
    text = `🔔 *OPERATOR SO'RALDI*\n${info}\nIltimos, mijoz bilan bog'laning!`;
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: managerChatId, text, parse_mode: 'Markdown' })
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const MANAGER_ID = process.env.TELEGRAM_CHAT_ID;
  const API_KEY = process.env.ANTHROPIC_API_KEY;

  try {
    const update = req.body;

    // ── CALLBACK QUERY (inline button bosildi) ──
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      const data = cq.data;
      const session = getSession(chatId);

      // Answer callback
      await fetch(`https://api.telegram.org/bot${TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cq.id })
      });

      if (FAQ_ANSWERS[data]) {
        await tgSend(chatId, FAQ_ANSWERS[data], TOKEN);
        return res.status(200).json({ ok: true });
      }

      if (data === 'start_zayavka') {
        session.awaitingZayavka = true;
        session.zayavkaStep = 1;
        session.zayavkaData = {};
        await tgSend(chatId,
          `📋 *Zaявka qoldirish*\n\nSizga 4 ta savol beraman.\n\n*1-qadam:* Ismingiz va kompaniya nomini yozing.\n_(Masalan: Alisher, Avto+ MChJ)_`, TOKEN);
        return res.status(200).json({ ok: true });
      }

      if (data === 'need_operator') {
        session.operatorMode = true;
        const info = `👤 Foydalanuvchi: @${cq.from.username || 'anonim'} (ID: ${chatId})`;
        await notifyManager('operator', info, TOKEN, MANAGER_ID);
        await tgSend(chatId,
          `👨‍💼 *Operator bilan ulanish*\n\nSo'rovingiz qabul qilindi! Menegerimiz tez orada siz bilan bog'lanadi.\n\nYoki to'g'ridan-to'g'ri yozing: @tashcom_export`, TOKEN);
        return res.status(200).json({ ok: true });
      }

      return res.status(200).json({ ok: true });
    }

    // ── MESSAGE ──
    const message = update?.message;
    if (!message) return res.status(200).json({ ok: true });

    const chatId = message.chat.id;
    const username = message.from?.username || 'anonim';
    const firstName = message.from?.first_name || '';
    const text = message.text;
    if (!text) return res.status(200).json({ ok: true });

    const session = getSession(chatId);

    // ── /start ──
    if (text === '/start') {
      session.history = [];
      session.awaitingZayavka = false;
      session.operatorMode = false;
      await tgSend(chatId,
`👋 *Salom, ${firstName}! Tashcom botiga xush kelibsiz!*

🚛 Biz O'zbekistondan MDH davlatlariga avtomobil ehtiyot qismlari eksport qilamiz.

Quyidagi tugmalardan birini tanlang yoki savol bering:`,
        TOKEN,
        { reply_markup: getFAQKeyboard() }
      );
      return res.status(200).json({ ok: true });
    }

    // ── /menu ──
    if (text === '/menu' || text === '/faq') {
      await tgSend(chatId, '📋 *Ko\'p beriladigan savollar:*', TOKEN, { reply_markup: getFAQKeyboard() });
      return res.status(200).json({ ok: true });
    }

    // ── /reset ──
    if (text === '/reset') {
      sessions.delete(chatId);
      await tgSend(chatId, '🔄 Suhbat yangilandi!', TOKEN, { reply_markup: getFAQKeyboard() });
      return res.status(200).json({ ok: true });
    }

    // ── OPERATOR MODE: xabarni managerga yo'naltirish ──
    if (session.operatorMode) {
      const fwd = `📨 *Mijoz xabari (operator rejimi)*\n👤 @${username} (${chatId}):\n${text}`;
      await notifyManager('operator', fwd, TOKEN, MANAGER_ID);
      await tgSend(chatId, '✅ Xabaringiz menegerga yuborildi. Tez orada javob berishadi.', TOKEN);
      return res.status(200).json({ ok: true });
    }

    // ── ZAYAVKA STEPS ──
    if (session.awaitingZayavka) {
      const step = session.zayavkaStep;

      if (step === 1) {
        session.zayavkaData.name = text;
        session.zayavkaStep = 2;
        await tgSend(chatId,
          `✅ Rahmat!\n\n*2-qadam:* Qanday zapchastlar kerak?\n_(Nomi, artikul (bo'lsa), miqdori)_\n\n_Masalan: Тормозной диск Toyota Camry — 20 dona_`, TOKEN);
      } else if (step === 2) {
        session.zayavkaData.parts = text;
        session.zayavkaStep = 3;
        await tgSend(chatId,
          `✅ Qabul qilindi!\n\n*3-qadam:* Yetkazib berish davlati va shahri?`, TOKEN);
      } else if (step === 3) {
        session.zayavkaData.location = text;
        session.zayavkaStep = 4;
        await tgSend(chatId,
          `✅ Zo'r!\n\n*4-qadam:* Telefon raqamingiz yoki WhatsApp?`, TOKEN);
      } else if (step === 4) {
        session.zayavkaData.phone = text;
        session.awaitingZayavka = false;
        session.zayavkaStep = 0;

        const zInfo =
`👤 *Ism/Kompaniya:* ${session.zayavkaData.name}
📦 *Zapchastlar:* ${session.zayavkaData.parts}
🌍 *Joylashuv:* ${session.zayavkaData.location}
📞 *Telefon:* ${session.zayavkaData.phone}
🤖 Kanal: Telegram bot (@${username})`;

        await notifyManager('zayavka', zInfo, TOKEN, MANAGER_ID);

        await tgSend(chatId,
          `✅ *Zaявkangiz qabul qilindi!*\n\nMenegerimiz 2 soat ichida siz bilan bog\'lanadi.\n\nRahmat, ${session.zayavkaData.name.split(' ')[0]}! 🤝`, TOKEN);
      }
      return res.status(200).json({ ok: true });
    }

    // ── Operator so'rash (text orqali) ──
    const operatorWords = ['оператор', 'менеджер', 'человек', 'живой', 'позвони', 'operator', 'menejer', 'odam', 'jonli', 'qo\'ng\'iroq'];
    if (operatorWords.some(w => text.toLowerCase().includes(w))) {
      session.operatorMode = true;
      const info = `👤 @${username} (ID: ${chatId}) — "${text}"`;
      await notifyManager('operator', info, TOKEN, MANAGER_ID);
      await tgSend(chatId,
        `👨‍💼 *Operator bilan ulanish*\n\nSo'rovingiz qabul qilindi! Menegerimiz tez orada bog'lanadi.\n\nTo'g'ridan-to'g'ri: @tashcom_export`, TOKEN);
      return res.status(200).json({ ok: true });
    }

    // ── Zayavka so'rash (text orqali) ──
    const zayavkaWords = ['заявк', 'zayavka', 'заказ', 'zakaz', 'buyurtma', 'хочу заказ', 'нужно заказ'];
    if (zayavkaWords.some(w => text.toLowerCase().includes(w))) {
      session.awaitingZayavka = true;
      session.zayavkaStep = 1;
      session.zayavkaData = {};
      await tgSend(chatId,
        `📋 *Zaявka qoldirish*\n\n*1-qadam:* Ismingiz va kompaniya nomini yozing.`, TOKEN);
      return res.status(200).json({ ok: true });
    }

    // ── AI REPLY ──
    await tgAction(chatId, TOKEN);
    const reply = await getAIReply(session, text, API_KEY);

    // ЗАЯВКА_ГОТОВА ni tekshirish (AI o'zi yig'sa)
    if (reply.includes('ЗАЯВКА_ГОТОВА:')) {
      const zData = reply.split('ЗАЯВКА_ГОТОВА:')[1]?.trim();
      const info = `🤖 AI orqali yig'ilgan:\n${zData}\n👤 @${username} (${chatId})`;
      await notifyManager('zayavka', info, TOKEN, MANAGER_ID);
      const cleanReply = reply.split('ЗАЯВКА_ГОТОВА:')[0].trim();
      await tgSend(chatId, cleanReply || '✅ Zaявkangiz qabul qilindi! Meneger tez orada bog\'lanadi.', TOKEN);
      return res.status(200).json({ ok: true });
    }

    // ОПЕРАТОР_НУЖЕН ni tekshirish
    if (reply.includes('ОПЕРАТОР_НУЖЕН')) {
      session.operatorMode = true;
      const info = `👤 @${username} (${chatId}) — AI orqali yo'naltirildi`;
      await notifyManager('operator', info, TOKEN, MANAGER_ID);
      await tgSend(chatId,
        `👨‍💼 Menegerimizga ulayapman. Tez orada bog'lanishadi!\n\nYoki: @tashcom_export`, TOKEN);
      return res.status(200).json({ ok: true });
    }

    // Oddiy AI javob
    await tgSend(chatId, reply, TOKEN);

    // FAQ tugmalarini ba'zan ko'rsatish
    if (session.history.length % 4 === 0) {
      await tgSend(chatId, '💡 *Tez-tez beriladigan savollar:*', TOKEN, { reply_markup: getFAQKeyboard() });
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).json({ ok: true });
  }
}
