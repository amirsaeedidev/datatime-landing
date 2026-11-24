# دیتاتایم — سایت معرفی + پنل مدیریت + بلاگ + ربات تلگرام

سایت معرفی اپلیکیشن مدیریت مجموعه **دیتاتایم** با طراحی Liquid Glass خاکستری به سبک iOS،
همراه با پنل مدیریت نمایندگان و کدهای تخفیف، آمار بازدید، بلاگ سئوشده و ربات تلگرام
برای اعلان درخواست‌ها و انتشار مقاله از تلگرام.

## 🔐 مدل امنیتی — این را اول بخوانید

**قانون طلایی:** هر چیزی که مرورگر لازم داشته باشد، در نهایت در کدِ ارسال‌شده به کاربر است و
با DevTools دیده می‌شود. GitHub Actions Secrets هم این را عوض نمی‌کند، چون خروجی build باز هم
یک فایل استاتیک عمومی است. پس مقادیر حساس باید اصلاً به مرورگر نروند:

| مقدار | کجا نگه داشته می‌شود | چرا |
|---|---|---|
| `SUPABASE_URL` و `SUPABASE_ANON_KEY` | `assets/js/config.js` (عمومی) | طبق طراحی Supabase عمومی‌اند؛ امنیت از RLS می‌آید |
| `NOTIFY_FUNCTION_URL` | `assets/js/config.js` (عمومی) | آدرس عمومی تابع؛ خودش JWT را بررسی می‌کند |
| `TELEGRAM_BOT_TOKEN` | **فقط** Secrets توابع Supabase (داشبورد) | تا کسی نتواند ربات را هک/اسپم کند |
| `GITHUB_TOKEN` | **فقط** Secrets تابع `telegram-webhook` | دسترسی نوشتن روی ریپو |
| `SUPABASE_SERVICE_ROLE_KEY` | به‌صورت خودکار در توابع | دور از مرورگر |
| رمز پنل مدیریت | یک کاربر واقعی در Authentication | ورود با Supabase Auth |

### کد تابع روی گیت‌هاب امن است؟

بله ✅ — فایل `supabase/functions/*/index.ts` هیچ توکنی داخلش ندارد؛ همه‌ی مقادیر حساس را
زمان اجرا از `Deno.env` (Secrets سرور Supabase) می‌خواند. پس اینکه کد روی ریپوی عمومی باشد
مشکلی ایجاد نمی‌کند. چیزهایی که هرگز وارد ریپو نمی‌شوند:

- `TELEGRAM_BOT_TOKEN` · `GITHUB_TOKEN` · `SUPABASE_SERVICE_ROLE_KEY`

این‌ها فقط در **Supabase → Edge Functions → [تابع] → Secrets** ثبت می‌شوند — این همان
«environment variable امن سمت سرور» است. GitHub Environment Secrets فقط برای اجرای
GitHub Actions کاربرد دارد و در معماری ما (استقرار از داشبورد) جایی ندارد.

> ⚠ اگر قبلاً توکن ربات را در `config.js` یا هر جای دیگری از ریپو گذاشته‌اید، همین حالا در
> BotFather دستور `/revoke` بزنید و توکن جدید بگیرید.

## ساختار پروژه

```
├── index.html                        صفحه اصلی (فرم + کد تخفیف + FAQ + سئو)
├── admin.html                        پنل مدیریت (noindex)
├── 404.html · robots.txt · sitemap.xml · llms.txt
├── blog/                             لیست مقالات + مقالات
├── supabase/
│   ├── verify.sql                    بررسی سلامت دیتابیس
│   └── functions/
│       ├── telegram-webhook/         ربات انتشار مقاله از تلگرام (Verify JWT خاموش)
│       └── notify/                   اعلان درخواست‌ها به تلگرام (Verify JWT روشن)
└── assets/
    ├── css/style.css · img/favicon.svg · img/og-cover.svg
    └── js/config.js · store.js · track.js · notify.js · admin.js
```

## انتشار سایت

`Settings → Pages → Deploy from a branch → main / (root)` →
`https://amirsaeedidev.github.io/datatime-landing/`

## پنل مدیریت

آدرس: `/admin.html`

- **حالت ابری:** ورود با ایمیل + رمزِ یک کاربر Supabase (Authentication → Users → Add user).
  خواندن داده‌ها فقط برای کاربر احراز هویت‌شده مجاز است (RLS).
- **حالت دمو:** رمز محلی در مرورگر — فقط برای تست.

| بخش | توضیح |
|---|---|
| داشبورد | بازدید امروز/۷روز، نمودار ۷ روزه، پرفروش‌ترین نمایندگان |
| نمایندگان | افزودن/حذف با کد تخفیف اختصاصی |
| فروش‌ها | همه‌ی درخواست‌ها + کد تخفیف + نماینده‌ی صاحب کد + خروجی CSV |
| بازدیدها | نمایش هر صفحه (امروز / مجموع ۳۰ روز) |
| مقالات | فهرست مقالات منتشرشده از تلگرام |
| تنظیمات | تست اعلان تلگرام، پشتیبان JSON، پاک‌سازی داده |

## 🗄 راه‌اندازی Supabase (یک‌بار)

در [supabase.com](https://supabase.com) پروژه‌ی رایگان بسازید و در **SQL Editor** فقط این بلوک را Run کنید:

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

-- اگر سیاست‌های قدیمی را ساخته‌اید، اول پاک کنید:
drop policy if exists "public agents"        on agents;
drop policy if exists "public sales"         on sales;
drop policy if exists "public views"         on views;
drop policy if exists "public articles"      on articles;
drop policy if exists "agents_select_public" on agents;
drop policy if exists "agents_insert_auth"   on agents;
drop policy if exists "agents_update_auth"   on agents;
drop policy if exists "agents_delete_auth"   on agents;
drop policy if exists "agents_write_auth"    on agents;
drop policy if exists "sales_insert_public"  on sales;
drop policy if exists "sales_select_auth"    on sales;
drop policy if exists "views_insert_public"  on views;
drop policy if exists "views_select_auth"    on views;
drop policy if exists "articles_select_public" on articles;

-- نمایندگان: خواندن عمومی (برای اعتبارسنجی کد تخفیف)؛ نوشتن فقط مدیر
-- ⚠ در Postgres هر سیاست فقط یک عملیات می‌پذیرد؛ پس سه سیاست جدا می‌سازیم:
create policy "agents_select_public" on agents
  for select to anon, authenticated using (true);
create policy "agents_insert_auth" on agents
  for insert to authenticated with check (true);
create policy "agents_update_auth" on agents
  for update to authenticated using (true) with check (true);
create policy "agents_delete_auth" on agents
  for delete to authenticated using (true);

-- درخواست‌ها: ثبت عمومی؛ خواندن فقط مدیر
create policy "sales_insert_public" on sales
  for insert to anon, authenticated with check (true);
create policy "sales_select_auth" on sales
  for select to authenticated using (true);

-- بازدیدها: ثبت عمومی؛ خواندن فقط مدیر
create policy "views_insert_public" on views
  for insert to anon, authenticated with check (true);
create policy "views_select_auth" on views
  for select to authenticated using (true);

-- مقالات: خواندن عمومی؛ نوشتن فقط با service role (بدون سیاست نوشتن)
create policy "articles_select_public" on articles
  for select to anon, authenticated using (true);
```

**بررسی صحت اجرا:** فایل [`supabase/verify.sql`](supabase/verify.sql) را در SQL Editor اجرا کنید
و خروجی هر بخش را با «مورد انتظار» داخل آن مقایسه کنید.

**ساخت کاربر مدیر:** داشبورد → Authentication → Users → **Add user** → ایمیل و رمز (گزینه‌ی
Auto Confirm را فعال کنید). با همین ایمیل/رمز وارد پنل می‌شوید.

**تنظیمات سایت:** در `assets/js/config.js` مقادیر `SUPABASE_URL` و `SUPABASE_ANON_KEY`
(از Settings → API) را پر کنید.

## 🤖 ربات تلگرام

### ۱) ساخت ربات و اعلان درخواست‌ها

1. [@BotFather](https://t.me/BotFather) → `/newbot` → توکن را بگیرید.
2. به ربات `/start` بفرستید.
3. Chat ID خود را از [@userinfobot](https://t.me/userinfobot) بگیرید.
4. در داشبورد Supabase: **Edge Functions → Create a function** → نام: `notify` →
   **Verify JWT را روشن بگذارید** → کل محتوای `supabase/functions/notify/index.ts`
   را جایگزین کد پیش‌فرض کنید → Deploy.
5. در همان صفحه بخش **Secrets** تابع را باز کنید و اضافه کنید:
   `TELEGRAM_BOT_TOKEN` و `TELEGRAM_CHAT_ID`.
6. آدرس تابع را در `assets/js/config.js` به‌صورت `NOTIFY_FUNCTION_URL` بگذارید.
7. تست: پنل → تنظیمات → «ارسال پیام تست».

از این پس هر درخواست فرم، همان لحظه در تلگرام شما می‌رسد — بدون اینکه توکن ربات در کد سایت باشد.

### ۲) انتشار مقاله از تلگرام

مقاله را در تلگرام می‌نویسید؛ ربات فایل HTML سئوشده می‌سازد، روی همین ریپو commit می‌کند
(سایت خودکار آپدیت می‌شود)، sitemap را به‌روز می‌کند و رکورد آن را در دیتابیس ثبت می‌کند.

> ⚠ **دو محیط متفاوت:** SQL Editor فقط کد SQL می‌پذیرد؛ دستوراتی که با `supabase` شروع
> می‌شوند (مثل `supabase login`) در **ترمینال** اجرا می‌شوند. اگر `supabase login` را در
> SQL Editor بگذارید همین خطای `syntax error at or near "supabase"` را می‌گیرید.

**قدم ۱ — توکن گیت‌هاب:** GitHub → Settings → Developer settings → Fine-grained tokens →
دسترسی **Contents: Read and write** فقط روی همین ریپو.

**قدم ۲ — استقرار تابع:**

#### روش A) از داشبورد Supabase — بدون ترمینال ⭐

1. **Edge Functions → Create a function** → نام دقیق: `telegram-webhook`
2. **Verify JWT را خاموش کنید** ⚠️ (تلگرام توکن Supabase نمی‌فرستد)
3. کل محتوای `supabase/functions/telegram-webhook/index.ts` را جایگزین کنید → Deploy
4. در بخش **Secrets** همین تابع، این ۶ مقدار را اضافه کنید:

   | نام Secret | مقدار |
   |---|---|
   | `GITHUB_TOKEN` | توکن گیت‌هاب |
   | `GITHUB_REPO` | `amirsaeedidev/datatime-landing` |
   | `SITE_URL` | `https://amirsaeedidev.github.io/datatime-landing` |
   | `TELEGRAM_BOT_TOKEN` | توکن ربات |
   | `ADMIN_IDS` | عدد Chat ID شما |
   | `WEBHOOK_SECRET` | یک رمز دلخواه مثل `dt-secret-8f3k2` |

   > `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` خودکار در تابع موجودند.

#### روش B) با CLI — در ترمینال (PowerShell / Terminal)

```bash
npm install -g supabase          # یک‌بار
supabase login
supabase link --project-ref <REF>

supabase secrets set \
  GITHUB_TOKEN=ghp_xxx \
  GITHUB_REPO=amirsaeedidev/datatime-landing \
  SITE_URL=https://amirsaeedidev.github.io/datatime-landing \
  TELEGRAM_BOT_TOKEN=123:ABC \
  ADMIN_IDS=123456789 \
  WEBHOOK_SECRET=dt-secret-8f3k2

supabase functions deploy telegram-webhook --no-verify-jwt
```

**قدم ۳ — وصل کردن Webhook تلگرام:** این آدرس را در **مرورگر** باز کنید:

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<آدرس-تابع>&secret_token=<WEBHOOK_SECRET>
```

باید `{"ok":true,...}` ببینید. سپس به ربات `/start` بفرستید — باید راهنما را جواب بدهد.

### 🔧 عیب‌یابی: setWebhook پاسخ false داد

این آدرس را در مرورگر باز کنید تا علت دقیق را ببینید:

```
https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

مقدار `last_error_message` و `url` را چک کنید. شایع‌ترین علت‌ها:

| خطا | علت | راه‌حل |
|---|---|---|
| `429 Too Many Requests` | درخواست‌های پشت‌سرهم | چند ثانیه صبر کنید و فقط یک‌بار اجرا کنید |
| `401 Unauthorized` | توکن ربات اشتباه یا فاصله/کاراکتر اضافی | توکن را از BotFather دوباره کپی کنید |
| `400 bad webhook: An HTTPS URL must be provided` | آدرس تابع `http` است یا ناقص | آدرس کامل `https://<ref>.supabase.co/functions/v1/telegram-webhook` |
| `400 bad webhook: specified URL is invalid` | غلط املایی در ref یا مسیر | آدرس را از صفحه‌ی تابع در داشبورد کپی کنید |
| `secret_token` نامعتبر | استفاده از حروف فارسی، فاصله یا کاراکتر خاص | فقط `A-Z a-z 0-9 _ -` استفاده کنید |
| آدرس تابع در مرورگر 401 می‌دهد | Verify JWT روشن مانده | برای `telegram-webhook` خاموش، برای `notify` روشن |

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

دستورهای ربات: `/help` · `/list` (۱۰ مقاله‌ی آخر) · `/delete <slug>`

## ⚠ حالت دمو در برابر حالت واقعی

| حالت | رفتار |
|---|---|
| **دمو (بدون Supabase)** | داده در localStorage مرورگر همان کاربر؛ درخواست‌های کاربران دیگر به پنل شما نمی‌رسد |
| **ابری (با Supabase)** | داده‌ی همه‌ی کاربران در دیتابیس مشترک؛ پنل همه‌چیز را می‌بیند |

## نکات امنیتی

- توکن ربات فقط در Secret تابع سروری نگه داشته می‌شود؛ کد سایت فقط تابع را صدا می‌زند.
- رمز پنل در حالت ابری، واقعی است (Supabase Auth)؛ در حالت دمو سمت مرورگر است.
- آدرس پنل را محرمانه نگه دارید (noindex + robots.txt فعال است).
- سیاست‌های RLS خواندن داده‌های مشتری را فقط برای مدیرِ واردشده باز می‌کنند.

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
