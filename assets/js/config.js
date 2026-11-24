/* ============================================================
   تنظیمات سراسری دیتاتایم
   ============================================================
   ⚠️ مدل امنیتی — این را حتماً بخوانید:

   هر مقداری که در این فایل باشد، در مرورگر همه‌ی بازدیدکنندگان دیده می‌شود
   (DevTools → Sources). GitHub Actions Secrets هم این را تغییر نمی‌دهد؛
   چون خروجی build باز هم یک فایل استاتیک عمومی است.

   پس در این فایل فقط چیزهایی می‌گذاریم که «از اساس عمومی‌اند»:
   • SUPABASE_URL و SUPABASE_ANON_KEY : طبق طراحی Supabase عمومی‌اند؛
     امنیت واقعی از سیاست‌های RLS می‌آید.
   • NOTIFY_FUNCTION_URL / PUBLISH_FUNCTION_URL : آدرس عمومی توابع؛
     تابع notify خودش JWT را بررسی می‌کند و تابع publish احراز هویت
     مدیر را داخل خودش انجام می‌دهد.

   و این‌ها هرگز وارد ریپو نمی‌شوند (فقط در Secrets توابع Supabase):
   • TELEGRAM_BOT_TOKEN  ·  GITHUB_TOKEN  ·  SUPABASE_SERVICE_ROLE_KEY
   • رمز پنل مدیریت = یک کاربر واقعی در Authentication Supabase
   ============================================================ */
window.DT_CONFIG = {
  SITE_NAME: "دیتاتایم",
  SITE_URL: "https://amirsaeedidev.github.io/datatime-landing",

  /* --- Supabase (عمومی طبق طراحی) --- */
  SUPABASE_URL: "",        // مثال: "https://xxxx.supabase.co"
  SUPABASE_ANON_KEY: "",   // کلید anon از Settings → API

  /* --- تابع اعلان تلگرام ---
     آدرس تابع notify: https://<ref>.supabase.co/functions/v1/notify */
  NOTIFY_FUNCTION_URL: "",

  /* --- تابع انتشار مقاله (پنل وب) ---
     آدرس تابع telegram-webhook: https://<ref>.supabase.co/functions/v1/telegram-webhook
     احراز هویت داخل خود تابع با توکن ورود مدیر انجام می‌شود. */
  PUBLISH_FUNCTION_URL: "",

  /* --- وب‌هوک فرم (اختیاری) --- */
  FORM_ENDPOINT: ""
};
