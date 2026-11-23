# دیتاتایم — سایت معرفی + پنل مدیریت + بلاگ + ربات تلگرام

سایت معرفی اپلیکیشن مدیریت مجموعه **دیتاتایم** با طراحی Liquid Glass خاکستری به سبک iOS،
همراه با پنل مدیریت نمایندگان و کدهای تخفیف، آمار بازدید، بلاگ سئوشده و ربات تلگرام
برای اعلان درخواست‌ها و انتشار مقاله از تلگرام.

## ساختار پروژه

```
├── index.html                        صفحه اصلی (فرم + کد تخفیف + FAQ + سئو)
├── admin.html                        پنل مدیریت (noindex)
├── 404.html                          صفحه‌ی خطای ۴۰۴ سفارشی
├── robots.txt · sitemap.xml · llms.txt
├── blog/
│   ├── index.html                    لیست مقالات (ثابت + داینامیک)
│   └── *.html                        مقالات (دستی یا منتشرشده از تلگرام)
├── supabase/
│   └── functions/telegram-webhook/   ربات انتشار مقاله از تلگرام
└── assets/
    ├── css/style.css                 استایل مشترک
    ├── img/favicon.svg · og-cover.svg
    └── js/
        ├── config.js                 تنظیمات (Supabase / تلگرام / وب‌هوک)
        ├── store.js                  لایه‌ی داده (localStorage / Supabase)
        ├── track.js                  ثبت بازدید صفحات
        ├── notify.js                 اعلان‌های تلگرام (سمت سایت)
        └── admin.js                  منطق پنل مدیریت
```

## انتشار سایت

`Settings → Pages → Deploy from a branch → main / (root)`
سپس: `https://amirsaeedidev.github.io/datatime-landing/`

## پنل مدیریت

آدرس: `/admin.html` — بار اول یک رمز انتخاب می‌کنید (ذخیره سمت مرورگر).

| بخش | توضیح |
|---|---|
| داشبورد | بازدید امروز/۷روز، نمودار ۷ روزه، پرفروش‌ترین نمایندگان |
| نمایندگان | افزودن/حذف با کد تخفیف اختصاصی (پیشنهاد خودکار کد) |
| فروش‌ها | همه‌ی درخواست‌ها + کد تخفیف + نماینده‌ی صاحب کد + خروجی CSV |
| بازدیدها | نمایش هر صفحه (امروز / مجموع ۳۰ روز) |
| مقالات | فهرست مقالات منتشرشده از تلگرام |
| تنظیمات | تست ربات تلگرام، پشتیبان JSON، پاک‌سازی داده |

## 🤖 اتصال ربات تلگرام

### بخش ۱) اعلان درخواست‌های فرم (۵ دقیقه — نیازی به Supabase ندارد)

1. در تلگرام به [@BotFather](https://t.me/BotFather) پیام بدهید: `/newbot` → نام و یوزرنیم بدهید → توکن را بگیرید.
2. به ربات خودتان `/start` بفرستید (تا بتواند به شما پیام دهد).
3. Chat ID خود را بگیرید: به [@userinfobot](https://t.me/userinfobot) پیام بدهید یا
   آدرس `https://api.telegram.org/bot<TOKEN>/getUpdates` را باز کنید.
4. در `assets/js/config.js` مقدار `TELEGRAM_BOT_TOKEN` و `TELEGRAM_CHAT_ID` را پر کنید.

از این پس هر درخواست فرم (نام، تلفن، نوع مجموعه، کد تخفیف و نماینده‌ی صاحب کد)
همان لحظه در تلگرام شما ظاهر می‌شود. برای تست: پنل → تنظیمات → «ارسال پیام تست».

### بخش ۲) انتشار مقاله از تلگرام (نیازمند Supabase)

مقاله را در تلگرام می‌نویسید؛ ربات آن را به فایل HTML سئوشده تبدیل می‌کند،
مستقیم روی همین ریپو commit می‌کند (سایت خودکار آپدیت می‌شود)، sitemap را به‌روز می‌کند
و رکوردش را در دیتابیس ثبت می‌کند تا در لیست بلاگ و پنل ادمین دیده شود.

> ## ⚠️ مهم: دو محیط متفاوت، دو نوع دستور
>
> | محیط | چه چیزی در آن اجرا می‌شود |
> |---|---|
> | **SQL Editor** (داخل سایت supabase.com) | فقط و فقط کد SQL (که با `create table` شروع می‌شود) |
> | **Terminal / PowerShell** (روی کامپیوتر خودتان) | دستوراتی که با `supabase` شروع می‌شوند |
>
> اگر `supabase login` را در SQL Editor بگذارید همین خطای `syntax error at or near "supabase"` را می‌گیرید،
> چون آن یک دستور ترمینال است نه SQL!

**قدم ۱ — ربات و پروژه:** ربات بخش ۱ کافی است. یک پروژه‌ی رایگان در
[supabase.com](https://supabase.com) بسازید و بازش کنید.

**قدم ۲ — اجرای SQL (در SQL Editor):** از منوی چپ پروژه، **SQL Editor** را باز کنید و
فقط این بلوک را Run کنید (هیچ چیز دیگری اضافه نکنید):

```sql
create table if not exists agents (
  id text primary key, name text not null, phone text,
  code text not null, created_at timestamptz default now()
);
create table if not exists sales (
  id text primary key, agent_id text, agent_name text, code text,
  valid boolean default false, customer text, phone text, type text,
  msg text, date text, ts bigint
);
create table if not exists views (
  id text primary key, path text, date text, ts bigint
);
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  title text not null, slug text unique not null, cat text,
  excerpt text, url text, date text, created_at timestamptz default now()
);

alter table agents   enable row level security;
alter table sales    enable row level security;
alter table views    enable row level security;
alter table articles enable row level security;

create policy "public agents"   on agents   for all using (true) with check (true);
create policy "public sales"    on sales    for all using (true) with check (true);
create policy "public views"    on views    for all using (true) with check (true);
create policy "public articles" on articles for all using (true) with check (true);
```

**قدم ۳ — توکن گیت‌هاب:** در GitHub → Settings → Developer settings →
Fine-grained tokens یک توکن با دسترسی **Contents: Read and write** فقط روی همین ریپو بسازید.

**قدم ۴ — دیپلوی تابع:** یکی از دو روش زیر (نتیجه یکی است):

#### روش A) از داشبورد Supabase — بدون ترمینال ⭐ ساده‌تر

1. در پروژه، از منوی چپ **Edge Functions** را باز کنید.
2. روی **Create a function** بزنید؛ نام آن را دقیقاً `telegram-webhook` بگذارید.
3. گزینه‌ی **Verify JWT** را **خاموش** کنید (مهم — چون تلگرام با توکن Supabase کار نمی‌کند).
4. کل محتوای فایل `supabase/functions/telegram-webhook/index.ts` از همین ریپو را
   کپی کرده و جایگزین کد پیش‌فرض تابع کنید → Deploy.
5. در همان صفحه، بخش **Secrets** تابع را باز کنید و این ۶ مقدار را اضافه کنید:

   | نام Secret | مقدار |
   |---|---|
   | `GITHUB_TOKEN` | توکنی که در قدم ۳ ساختید |
   | `GITHUB_REPO` | `amirsaeedidev/datatime-landing` |
   | `SITE_URL` | `https://amirsaeedidev.github.io/datatime-landing` |
   | `TELEGRAM_BOT_TOKEN` | توکن ربات از BotFather |
   | `ADMIN_IDS` | عدد Chat ID شما (از @userinfobot) |
   | `WEBHOOK_SECRET` | یک رمز دلخواه مثلاً `dt-secret-8f3k2` |

   > `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` به‌صورت خودکار در تابع موجودند؛ کاری ندارید.

6. آدرس تابع را از همان صفحه کپی کنید؛ چیزی شبیه:
   `https://xxxxx.supabase.co/functions/v1/telegram-webhook`

#### روش B) با CLI — در ترمینال (PowerShell / Terminal)

نصب CLI (یک‌بار برای همیشه):

```bash
npm install -g supabase
```

سپس در ترمینال (نه SQL Editor!):

```bash
supabase login
supabase link --project-ref <REF>

supabase secrets set \
  GITHUB_TOKEN=ghp_xxxxxxxx \
  GITHUB_REPO=amirsaeedidev/datatime-landing \
  SITE_URL=https://amirsaeedidev.github.io/datatime-landing \
  TELEGRAM_BOT_TOKEN=123456:ABC-DEF \
  ADMIN_IDS=123456789 \
  WEBHOOK_SECRET=yek-ramz-tasadofi

supabase functions deploy telegram-webhook --no-verify-jwt
```

**قدم ۵ — وصل کردن Webhook تلگرام:**

این آدرس را در **مرورگر** باز کنید (جای `<...>` را پر کنید):

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<آدرس-تابع-از-قدم-۴>&secret_token=<WEBHOOK_SECRET>
```

باید پاسخ `{"ok":true,...}` ببینید.

**قدم ۶ — کلیدهای عمومی سایت:** در `assets/js/config.js` مقدار
`SUPABASE_URL` و `SUPABASE_ANON_KEY` (از Settings → API پروژه) را پر کنید
تا پنل و لیست مقالات داینامیک حالت ابری بگیرند.

**تست نهایی:** به ربات خودتان `/start` بفرستید — باید راهنما را ببینید. تمام! 🎉

### نحوه‌ی نوشتن مقاله در تلگرام

```
عنوان مقاله
slug: address-maghale (اختیاری)
دسته: نوبت‌دهی (اختیاری)
---
متن مقاله…

## تیتر بخش
### تیتر کوچک
- آیتم لیست
> نقل‌قول
**متن پررنگ**
[متن لینک](https://example.com)
```

بعد از ارسال، ربات فایل را می‌سازد و لینک مقاله را برایتان می‌فرستد (~۱ دقیقه تا لایو شدن).

دستورهای ربات: `/help` · `/list` (۱۰ مقاله‌ی آخر) · `/delete <slug>`

## ⚠ حالت دمو در برابر حالت واقعی

| حالت | رفتار |
|---|---|
| **دمو (بدون Supabase)** | داده در localStorage مرورگر همان کاربر؛ درخواست‌های کاربران دیگر به پنل شما نمی‌رسد |
| **ابری (با Supabase)** | داده‌ی همه‌ی کاربران در دیتابیس مشترک؛ پنل همه‌چیز را می‌بیند |

## نکات امنیتی

- توکن ربات در `config.js` سمت کلاینت دیده می‌شود؛ فقط قابلیت «ارسال پیام» دارد.
  برای انتشار مقاله، توکن فقط در Secret تابع سروری نگه داشته می‌شود.
- رمز پنل سمت کلاینت است؛ آدرس پنل را محرمانه نگه دارید (noindex + robots.txt فعال است).
- سیاست‌های RLS بالا برای شروع ساده‌اند؛ برای سخت‌گیری بیشتر، نوشتن را فقط با service role بگذارید.

## افزودن مقاله‌ی دستی (بدون تلگرام)

1. یکی از فایل‌های `blog/*.html` را کپی و محتوا/متاتگ‌ها را عوض کنید.
2. کارت آن را به `blog/index.html` و بخش مقالات `index.html` اضافه کنید.
3. آدرس را به `sitemap.xml` اضافه و lastmod را به‌روز کنید.

## چک‌لیست سئو پیاده‌شده

- ✅ Title/Description یکتا + Canonical در همه‌ی صفحات
- ✅ Open Graph + Twitter Card کامل
- ✅ JSON-LD: Organization · WebSite · SoftwareApplication · Blog · Article · BreadcrumbList · **FAQPage**
- ✅ sitemap.xml (به‌روزرسانی خودکار با هر مقاله‌ی تلگرامی) + robots.txt
- ✅ llms.txt برای موتورهای جستجوی هوش مصنوعی (GEO)
- ✅ یک H1 منحصربه‌فرد + سلسله‌مراتب H2/H3 + Breadcrumb در همه‌ی صفحات
- ✅ لینک‌سازی داخلی: کارت‌های امکانات → مقالات، FAQ → مقالات، مقالات → هم + فرم
- ✅ `lang="fa"` + `dir="rtl"` + aria-hidden برای آیکون‌های تزئینی
- ✅ بدون تصویر raster؛ همه‌چیز SVG سبک (Core Web Vitals بالا) + صفحه ۴۰۴ سفارشی

> نکته: `og-cover.svg` برای پشتیبانی کامل شبکه‌های اجتماعی بهتر است به PNG 1200×630 تبدیل شود.

## فونت

[Vazirmatn](https://github.com/rastikerdar/vazirmatn) از CDN — بدون build و وابستگی.
