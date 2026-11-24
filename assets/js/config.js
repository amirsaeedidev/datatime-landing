/* ============================================================
   تنظیمات سراسری دیتاتایم
   ============================================================
   ⚠️ مدل امنیتی — این را حتماً بخوانید:

   هر مقداری که در این فایل باشد، در مرورگر همه‌ی بازدیدکنندگان دیده می‌شود
   (DevTools → Sources). GitHub Actions Secrets هم این را تغییر نمی‌دهد؛
   چون خروجی build باز هم یک فایل استاتیک عمومی است.

   پس در این فایل فقط چیزهایی می‌گذاریم که «از اساس عمومی‌اند»:
   • SUPABASE_URL و SUPABASE_ANON_KEY : طبق طراحی Supabase عمومی‌اند؛
     امنیت واقعی از سیاست‌های RLS می‌آید (نوشتن: همه، خواندن: فقط مدیر).
   • NOTIFY_FUNCTION_URL            : آدرس عمومی تابع؛ خودش JWT را بررسی می‌کند.

   و این‌ها هرگز وارد ریپو نمی‌شوند:
   • TELEGRAM_BOT_TOKEN  → فقط در Secrets تابع‌های Supabase
   • GITHUB_TOKEN        → فقط در Secrets تابع Supabase
   • SUPABASE_SERVICE_ROLE_KEY → به‌صورت خودکار در توابع موجود است
   • رمز پنل مدیریت       → یک کاربر واقعی در Authentication Supabase
   ============================================================ */
window.DT_CONFIG = {
  SITE_NAME: "دیتاتایم",
  SITE_URL: "https://amirsaeedidev.github.io/datatime-landing",

  /* --- Supabase (عمومی طبق طراحی) --- */
  SUPABASE_URL: "",        // مثال: "https://xxxx.supabase.co"
  SUPABASE_ANON_KEY: "",   // کلید anon از Settings → API

  /* --- تابع اعلان تلگرام (سمت سرور) ---
     آدرس تابع notify که در Supabase Deploy می‌کنید:
     https://<ref>.supabase.co/functions/v1/notify
     توکن ربات در آن تابع (Secret) نگه داشته می‌شود، نه این‌جا. */
  NOTIFY_FUNCTION_URL: "",

  /* --- وب‌هوک فرم (اختیاری) --- */
  FORM_ENDPOINT: ""
};
