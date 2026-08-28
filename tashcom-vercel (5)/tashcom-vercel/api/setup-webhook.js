// /api/setup-webhook.js
// Deploy qilgandan keyin BIR MARTA shu endpointga GET qiling:
// https://sizning-domen.vercel.app/api/setup-webhook
// Bu Telegram ga webhook URL ni ro'yxatdan o'tkazadi

export default async function handler(req, res) {
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const DOMAIN = process.env.VERCEL_URL || req.headers.host;

  const webhookUrl = `https://${DOMAIN}/api/webhook`;

  try {
    const r = await fetch(
      `https://api.telegram.org/bot${TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message'],
          drop_pending_updates: true
        })
      }
    );
    const data = await r.json();

    if (data.ok) {
      return res.status(200).json({
        success: true,
        message: `✅ Webhook muvaffaqiyatli o'rnatildi!`,
        webhook_url: webhookUrl,
        telegram_response: data
      });
    } else {
      return res.status(400).json({ success: false, error: data });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
