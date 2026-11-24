/* ============================================================
   تابع notify — اعلان تلگرامی درخواست‌های سایت
   ------------------------------------------------------------
   توکن ربات فقط این‌جا (در Secret) نگه داشته می‌شود، نه در کد سایت.
   جریان:
     فرم سایت → ثبت در جدول sales → POST به این تابع با { saleId }
     → خواندن رکورد با service role → ساخت پیام → ارسال به تلگرام

   Deploy از داشبورد:
     Edge Functions → Create a function → نام: notify
     ⚠ Verify JWT را روشن بگذارید (پیش‌فرض) — چون سایت با کلید عمومی
       صدا می‌زند و Supabase آن را تأیید می‌کند.

   Secrets لازم:
     TELEGRAM_BOT_TOKEN  — توکن ربات از BotFather
     TELEGRAM_CHAT_ID    — Chat ID مقصد اعلان‌ها
   (SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY خودکار موجودند)
   ============================================================ */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPA_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

const supa = SUPA_URL && SERVICE_KEY ? createClient(SUPA_URL, SERVICE_KEY) : null;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function esc(s: unknown): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendTelegram(text: string) {
  if (!BOT_TOKEN || !CHAT_ID) {
    throw new Error("TELEGRAM_BOT_TOKEN یا TELEGRAM_CHAT_ID تنظیم نشده است.");
  }
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("Telegram: " + t.slice(0, 200));
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  try {
    const { saleId, test } = await req.json();

    /* --- پیام تست از پنل مدیریت --- */
    if (test) {
      await sendTelegram("✅ پیام تست از پنل مدیریت دیتاتایم — اعلان‌ها برقرار است.");
      return json({ ok: true });
    }

    /* --- اعلان یک درخواست ثبت‌شده --- */
    if (!saleId) return json({ ok: false, error: "saleId required" }, 400);
    if (!supa) return json({ ok: false, error: "db not configured" }, 500);

    const { data: sale, error } = await supa
      .from("sales").select("*").eq("id", String(saleId)).maybeSingle();
    if (error) throw error;
    if (!sale) return json({ ok: false, error: "not found" }, 404);

    const lines = [
      "🔔 <b>درخواست جدید در سایت دیتاتایم</b>",
      "",
      "👤 نام: " + esc(sale.customer),
      "📞 تلفن: " + esc(sale.phone),
      "🏷 مجموعه: " + esc(sale.type || "—"),
    ];
    if (sale.code) {
      lines.push(
        "🎁 کد تخفیف: " + esc(sale.code) +
        (sale.valid ? " — نماینده: " + esc(sale.agent_name) + " ✓" : " — نامعتبر ✗"),
      );
    } else {
      lines.push("🎁 کد تخفیف: بدون کد");
    }
    if (sale.msg) lines.push("📝 توضیحات: " + esc(sale.msg));

    await sendTelegram(lines.join("\n"));
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
