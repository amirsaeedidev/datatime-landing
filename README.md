# دیتاتایم — سایت معرفی + پنل مدیریت + بلاگ

سایت معرفی اپلیکیشن مدیریت مجموعه **دیتاتایم** با طراحی Liquid Glass خاکستری به سبک iOS،
همراه با پنل مدیریت نمایندگان و کدهای تخفیف، آمار بازدید و بلاگ سئوشده.

## ساختار پروژه

```
├── index.html                        صفحه اصلی (فرم درخواست + کد تخفیف)
├── admin.html                        پنل مدیریت (noindex)
├── 404.html                          صفحه‌ی خطای ۴۰۴ سفارشی
├── robots.txt                        قواعد خزش (پنل بسته، بقیه باز)
├── sitemap.xml                       نقشه‌ی سایت
├── blog/
│   ├── index.html                    لیست مقالات
│   ├── taghvim-jalali-nobat-dehi.html
│   └── eshtebat-mali-salon-zibaei.html
└── assets/
    ├── css/style.css                 استایل مشترک
    ├── img/favicon.svg · og-cover.svg
    └── js/
        ├── config.js                 تنظیمات (Supabase / وب‌هوک)
        ├── store.js                  لایه‌ی داده (localStorage / Supabase)
        ├── track.js                  ثبت بازدید صفحات
        └── admin.js                  منطق پنل مدیریت
```

## انتشار

`Settings → Pages → Deploy from a branch → main / (root)`
سپس: `https://amirsaeedidev.github.io/datatime-landing/`

- پنل مدیریت: `https://amirsaeedidev.github.io/datatime-landing/admin.html`
- بار اول ورود، یک رمز انتخاب می‌کنید (سمت کلاینت ذخیره می‌شود).

## پنل مدیریت چه کار می‌کند؟

| بخش | توضیح |
|---|---|
| داشبورد | بازدید امروز/۷روز، تعداد درخواست‌ها، نمودار ۷ روزه، پرفروش‌ترین نمایندگان |
| نمایندگان | افزودن/حذف نماینده با کد تخفیف اختصاصی (پیشنهاد خودکار کد) |
| فروش‌ها | همه‌ی درخواست‌های فرم + کد تخفیف واردشده + نماینده‌ی صاحب کد + خروجی CSV |
| بازدیدها | تعداد نمایش هر صفحه (امروز / مجموع ۳۰ روز) |
| تنظیمات | پشتیبان JSON، پاک‌سازی داده، راهنمای اتصال ابری |

**منطق کد تخفیف:** هر نماینده یک کد دارد (مثل `DT-SARA-1234`).
مشتری کد را در فرم وارد می‌کند؛ اگر معتبر باشد، فروش به آن نماینده منتسب می‌شود،
اگر نامعتبر باشد با برچسب «نامعتبر» ثبت می‌شود تا در پنل دیده شود.

## ⚠ مهم: حالت دمو در برابر حالت واقعی

| حالت | رفتار |
|---|---|
| **دمو (پیش‌فرض)** | داده در localStorage *مرورگر همان کاربر* ذخیره می‌شود. بازدیدها و فروش‌های کاربرانِ دیگر به پنل شما نمی‌رسد. |
| **ابری (Supabase)** | داده‌ی همه‌ی بازدیدکنندگان در یک دیتابیس مشترک ذخیره می‌شود و پنل شما همه‌چیز را می‌بیند. |

### فعال‌سازی حالت ابری (رایگان)

۱) در [supabase.com](https://supabase.com) پروژه بسازید.
۲) در SQL Editor این کد را اجرا کنید:

```sql
create table if not exists agents (
  id text primary key,
  name text not null,
  phone text,
  code text not null,
  created_at timestamptz default now()
);

create table if not exists sales (
  id text primary key,
  agent_id text,
  agent_name text,
  code text,
  valid boolean default false,
  customer text,
  phone text,
  type text,
  msg text,
  date text,
  ts bigint
);

create table if not exists views (
  id text primary key,
  path text,
  date text,
  ts bigint
);

alter table agents enable row level security;
alter table sales  enable row level security;
alter table views  enable row level security;

create policy "public agents" on agents for all using (true) with check (true);
create policy "public sales"  on sales  for all using (true) with check (true);
create policy "public views"  on views  for all using (true) with check (true);
```

۳) در `assets/js/config.js` مقادیر `SUPABASE_URL` و `SUPABASE_ANON_KEY` را پر کنید.

> سیاست RLS بالا برای شروع ساده است؛ برای امنیت بیشتر، نوشتن را فقط با کلید سرویس و خواندن را عمومی کنید.

## فرم درخواست

- ارسال به وب‌هوک اختیاری است: `FORM_ENDPOINT` را در `assets/js/config.js` پر کنید
  (Formspree، Google Apps Script، بات تلگرام و…).
- اگر خالی باشد، درخواست فقط در پنل ثبت می‌شود.

## افزودن مقاله‌ی جدید

1. یکی از فایل‌های `blog/*.html` را کپی کنید.
2. عنوان، توضیحات، canonical، OG و تاریخ‌ها را عوض کنید.
3. محتوای مقاله را داخل `.prose` بنویسید (یک H1، چند H2).
4. کارت آن را به `blog/index.html` و بخش مقالات `index.html` اضافه کنید.
5. آدرس مقاله را به `sitemap.xml` اضافه کنید و lastmod را به‌روز کنید.

## چک‌لیست سئو پیاده‌شده

- ✅ Title و Meta Description یکتا برای هر صفحه
- ✅ Open Graph و Twitter Card کامل (با og:image 1200×630)
- ✅ Canonical در همه‌ی صفحات عمومی
- ✅ یک H1 منحصربه‌فرد در هر صفحه + سلسله‌مراتب H2/H3
- ✅ JSON-LD: Organization، WebSite، SoftwareApplication، Blog، Article، BreadcrumbList
- ✅ `sitemap.xml` + `robots.txt` (با Disallow پنل و معرفی Sitemap)
- ✅ `lang="fa"` + `dir="rtl"` و `og:locale=fa_IR`
- ✅ آیکون‌های تزئینی `aria-hidden` ، متن‌های لینک توصیفی، لینک‌سازی داخلی بین مقالات و صفحات
- ✅ بدون تصویر raster؛ همه‌چیز SVG سبک و inline (Core Web Vitals بالا)
- ✅ صفحه ۴۰۴ سفارشی + noindex برای پنل مدیریت

> نکته: تصویر `og-cover.svg` برای پشتیبانی کامل شبکه‌های اجتماعی (واتس‌اپ/تلگرام)،
> بهتر است به PNG با ابعاد 1200×630 تبدیل و جایگزین شود.

## فونت

[Vazirmatn](https://github.com/rastikerdar/vazirmatn) از CDN — بدون build و بدون وابستگی.
