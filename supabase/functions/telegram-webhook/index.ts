/* ============================================================
   ربات تلگرام دیتاتایم — انتشار مقاله از تلگرام
   ------------------------------------------------------------
   یک Supabase Edge Function که به‌عنوان Webhook تلگرام کار می‌کند.
   وقتی پیام مقاله می‌فرستید، فایل HTML سئوشده‌ی مقاله را مستقیم روی
   ریپوی گیت‌هاب commit می‌کند (سایت خودکار آپدیت می‌شود)، sitemap را
   به‌روز می‌کند و رکورد آن را در جدول articles ثبت می‌کند.

   راه‌اندازی (راهنمای کامل در README):

   1) supabase secrets set \
        GITHUB_TOKEN=ghp_xxx \
        GITHUB_REPO=amirsaeedidev/datatime-landing \
        SITE_URL=https://amirsaeedidev.github.io/datatime-landing \
        TELEGRAM_BOT_TOKEN=123:ABC \
        ADMIN_IDS=123456789 \
        WEBHOOK_SECRET=yek-ramz-tasadofi
      (SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY به‌صورت خودکار موجودند)

   2) supabase functions deploy telegram-webhook --no-verify-jwt

   3) curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
        -d "url=https://<PROJECT>.supabase.co/functions/v1/telegram-webhook" \
        -d "secret_token=<WEBHOOK_SECRET>"
   ============================================================ */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ---------- تنظیمات ---------- */
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? "";
const GITHUB_REPO = Deno.env.get("GITHUB_REPO") ?? ""; // "owner/repo"
const BRANCH = Deno.env.get("BRANCH") ?? "main";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");
const ADMIN_IDS = (Deno.env.get("ADMIN_IDS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";

const SUPA_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supa = SUPA_URL && SUPA_KEY ? createClient(SUPA_URL, SUPA_KEY) : null;

const GH = "https://api.github.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ---------- ابزار ---------- */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toB64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function isoDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function isoDateTime(d = new Date()): string {
  return d.toISOString();
}
function faDate(d = new Date()): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(d);
  } catch {
    return isoDate(d);
  }
}

/* ---------- GitHub API ---------- */
async function gh(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${GH}/repos/${GITHUB_REPO}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub ${res.status}: ${t.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function putFile(path: string, content: string, message: string) {
  let sha: string | undefined;
  try {
    const cur = await gh(`contents/${path}?ref=${BRANCH}`);
    sha = cur.sha;
  } catch {
    /* فایل جدید است */
  }
  return gh(`contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: toB64(content),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
}

async function deleteFile(path: string, message: string) {
  const cur = await gh(`contents/${path}?ref=${BRANCH}`);
  return gh(`contents/${path}`, {
    method: "DELETE",
    body: JSON.stringify({ message, sha: cur.sha, branch: BRANCH }),
  });
}

/* ---------- تلگرام ---------- */
async function tg(method: string, payload: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}
async function reply(chatId: number, text: string) {
  return tg("sendMessage", { chat_id: chatId, text });
}

/* ---------- تبدیل متن به مقاله ---------- */
interface Draft {
  title: string;
  slug: string;
  cat: string;
  body: string;
}

function autoSlug(): string {
  const d = new Date();
  return `post-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function parseDraft(text: string): Draft | null {
  const parts = text.split(/\n\s*---\s*\n/);
  if (parts.length < 2) return null;

  const headLines = parts[0].trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const body = parts.slice(1).join("\n---\n").trim();
  const title = headLines[0] ?? "";
  if (!title || !body) return null;

  let slug = "";
  let cat = "";
  for (const line of headLines.slice(1)) {
    const m1 = line.match(/^(?:slug|کد)\s*:\s*(.+)$/i);
    if (m1) slug = m1[1].trim();
    const m2 = line.match(/^(?:cat|دسته)\s*:\s*(.+)$/i);
    if (m2) cat = m2[1].trim();
  }

  slug = (slug || autoSlug())
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || autoSlug();

  return { title, slug, cat: cat || "مقاله", body };
}

function inline(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}

function bodyToHtml(body: string): string {
  const lines = body.split(/\r?\n/);
  let html = "";
  let listOpen = false;
  const closeList = () => {
    if (listOpen) { html += "</ul>"; listOpen = false; }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    if (/^###\s+/.test(line)) {
      closeList();
      html += `<h3>${inline(line.replace(/^###\s+/, ""))}</h3>`;
      continue;
    }
    if (/^##\s+/.test(line)) {
      closeList();
      html += `<h2>${inline(line.replace(/^##\s+/, ""))}</h2>`;
      continue;
    }
    if (/^[-•]\s+/.test(line)) {
      if (!listOpen) { html += "<ul>"; listOpen = true; }
      html += `<li>${inline(line.replace(/^[-•]\s+/, ""))}</li>`;
      continue;
    }
    if (/^>\s?/.test(line)) {
      closeList();
      html += `<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`;
      continue;
    }
    closeList();
    html += `<p>${inline(line)}</p>`;
  }
  closeList();
  return html;
}

function excerptOf(body: string): string {
  const first = body.split(/\n/).find((l) => l.trim() && !/^[#>\-*]/.test(l.trim())) || "";
  const text = first.replace(/[*\[\]()#>]/g, "").trim();
  return text.length > 155 ? text.slice(0, 152) + "…" : text;
}

/* ---------- ساخت صفحه‌ی HTML مقاله (سئوشده) ---------- */
function buildHtml(d: Draft): string {
  const U = SITE_URL;
  const url = `${U}/blog/${d.slug}.html`;
  const desc = excerptOf(d.body);
  const dIso = isoDate();
  const dFull = isoDateTime();
  const dFa = faDate();
  const words = d.body.split(/\s+/).length;
  const reading = `${Math.max(1, Math.round(words / 180))} دقیقه مطالعه`;
  const content = bodyToHtml(d.body);

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(d.title)} | مجله دیتاتایم</title>
<meta name="description" content="${esc(desc)}" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="${url}" />
<link rel="icon" type="image/svg+xml" href="${U}/assets/img/favicon.svg" />
<meta name="author" content="تیم دیتاتایم" />

<meta property="og:type" content="article" />
<meta property="og:site_name" content="دیتاتایم" />
<meta property="og:locale" content="fa_IR" />
<meta property="og:title" content="${esc(d.title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${U}/assets/img/og-cover.svg" />
<meta property="article:published_time" content="${dFull}" />
<meta property="article:section" content="${esc(d.cat)}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(d.title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${U}/assets/img/og-cover.svg" />

<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" />
<link rel="stylesheet" href="../assets/css/style.css" />

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": "${url}#article",
      "headline": ${JSON.stringify(d.title)},
      "description": ${JSON.stringify(desc)},
      "image": "${U}/assets/img/og-cover.svg",
      "inLanguage": "fa-IR",
      "datePublished": "${dFull}",
      "dateModified": "${dFull}",
      "articleSection": ${JSON.stringify(d.cat)},
      "author": { "@type": "Organization", "name": "تیم دیتاتایم", "url": "${U}/" },
      "publisher": {
        "@type": "Organization",
        "name": "دیتاتایم",
        "url": "${U}/",
        "logo": { "@type": "ImageObject", "url": "${U}/assets/img/favicon.svg" }
      },
      "mainEntityOfPage": { "@type": "WebPage", "@id": "${url}" }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "خانه", "item": "${U}/" },
        { "@type": "ListItem", "position": 2, "name": "مقالات", "item": "${U}/blog/" },
        { "@type": "ListItem", "position": 3, "name": ${JSON.stringify(d.title)}, "item": "${url}" }
      ]
    }
  ]
}
</script>
</head>
<body>

<div class="bg"></div>
<div class="orb o1"></div>
<div class="orb o2"></div>
<div class="orb o3"></div>

<header class="site-header">
  <div class="nav">
    <a class="brand" href="../" aria-label="دیتاتایم — صفحه اصلی">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>
      </span>
      <span class="brand-text">DATATIME</span>
    </a>
    <nav class="nav-links" aria-label="ناوبری اصلی">
      <a href="../#features">امکانات</a>
      <a href="../#ai">دستیار هوشمند</a>
      <a href="./" aria-current="page">مقالات</a>
      <a href="../#request" class="btn btn-solid btn-sm">درخواست دسترسی</a>
    </nav>
  </div>
</header>

<main class="section">
  <div class="wrap">
    <nav class="breadcrumbs" aria-label="مسیر صفحه">
      <a href="../">خانه</a>
      <span aria-hidden="true">/</span>
      <a href="./">مقالات</a>
      <span aria-hidden="true">/</span>
      <span aria-current="page">${esc(d.cat)}</span>
    </nav>

    <article class="article">
      <h1>${esc(d.title)}</h1>

      <div class="article-meta">
        <span>نویسنده: تیم دیتاتایم</span>
        <span>${dFa}</span>
        <span>${reading}</span>
      </div>

      <div class="prose">
${content}
      </div>

      <aside class="related" aria-label="مقالات مرتبط">
        <h2>مطالب مرتبط</h2>
        <ul>
          <li>← <a href="../blog/taghvim-jalali-nobat-dehi.html">مدیریت نوبت‌دهی سالن با تقویم جلالی؛ راهنمای کامل</a></li>
          <li>← <a href="../blog/eshtebat-mali-salon-zibaei.html">۷ اشتباه رایج در مدیریت مالی سالن زیبایی</a></li>
          <li>← <a href="../#features">امکانات کامل نرم‌افزار مدیریت دیتاتایم</a></li>
          <li>← <a href="../#request">درخواست دسترسی به دیتاتایم برای مجموعه‌ی شما</a></li>
        </ul>
      </aside>
    </article>
  </div>
</main>

<footer>
  <div class="wrap">
    <div class="foot">
      <div class="brand" style="gap:9px">
        <span class="brand-mark" style="width:32px;height:32px;border-radius:11px" aria-hidden="true">
          <svg viewBox="0 0 24 24" style="width:16px;height:16px"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>
        </span>
        <span class="brand-text" style="font-size:14px">DATATIME</span>
      </div>
      <nav class="lnks" aria-label="لینک‌های فوتر">
        <a href="../#features">امکانات</a>
        <a href="./">مقالات</a>
        <a href="../#request">درخواست دسترسی</a>
      </nav>
      <span>© ۱۴۰۵ دیتاتایم — همه‌ی حقوق محفوظ است.</span>
    </div>
  </div>
</footer>

<script src="../assets/js/config.js"></script>
<script src="../assets/js/store.js"></script>
<script src="../assets/js/track.js"></script>
</body>
</html>
`;
}

/* ---------- انتشار ---------- */
async function updateSitemap(slug: string) {
  const cur = await gh(`contents/sitemap.xml?ref=${BRANCH}`);
  const xml = atob(String(cur.content).replace(/\n/g, ""));
  const entry =
    `  <url>\n    <loc>${SITE_URL}/blog/${slug}.html</loc>\n` +
    `    <lastmod>${isoDate()}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
  const next = xml.replace("</urlset>", entry + "</urlset>");
  await gh("contents/sitemap.xml", {
    method: "PUT",
    body: JSON.stringify({
      message: `sitemap: add ${slug}`,
      content: toB64(next),
      branch: BRANCH,
      sha: cur.sha,
    }),
  });
}

async function publish(d: Draft): Promise<string> {
  const url = `${SITE_URL}/blog/${d.slug}.html`;
  await putFile(`blog/${d.slug}.html`, buildHtml(d), `article: ${d.title}`);
  try {
    await updateSitemap(d.slug);
  } catch {
    /* به‌روزرسانی sitemap بحرانی نیست */
  }
  if (supa) {
    await supa.from("articles").insert({
      id: crypto.randomUUID(),
      title: d.title,
      slug: d.slug,
      cat: d.cat,
      excerpt: excerptOf(d.body),
      url,
      date: isoDate(),
      created_at: isoDateTime(),
    });
  }
  return url;
}

/* ---------- پردازش پیام‌ها ---------- */
const HELP = `🎯 <b>ربات انتشار مقاله دیتاتایم</b>

برای انتشار مقاله، پیامی با این قالب بفرستید:

<b>عنوان مقاله</b>
code: آدرس-اختیاری
دسته: دسته‌بندی
---
متن مقاله…

در متن می‌توانید استفاده کنید:
## تیتر بخش  ·  ### تیتر کوچک
- آیتم لیست  ·  &gt; نقل‌قول
<b>متن پررنگ</b>  ·  [متن لینک](https://example.com)

دستورها:
/help — این راهنما
/list — ۱۰ مقاله‌ی آخر
/delete &lt;slug&gt; — حذف مقاله`;

async function handleUpdate(u: any) {
  const msg = u.message ?? u.edited_message;
  if (!msg || !msg.text) return;

  const chatId = msg.chat.id;
  const fromId = String(msg.from?.id ?? "");

  if (ADMIN_IDS.length > 0 && !ADMIN_IDS.includes(fromId)) {
    await reply(chatId, "⛔ شما مجاز به استفاده از این ربات نیستید.");
    return;
  }

  const text = msg.text.trim();

  if (text === "/start" || text === "/help" || text.startsWith("/help")) {
    await tg("sendMessage", { chat_id: chatId, text: HELP, parse_mode: "HTML" });
    return;
  }

  if (text.startsWith("/list")) {
    if (!supa) { await reply(chatId, "اتصال دیتابیس تنظیم نشده است."); return; }
    const { data } = await supa
      .from("articles").select("title,slug,date")
      .order("created_at", { ascending: false }).limit(10);
    const list = (data ?? [])
      .map((a: any, i: number) =>
        `${i + 1}. <a href="${SITE_URL}/blog/${a.slug}.html">${esc(a.title)}</a> — ${a.date}`)
      .join("\n");
    await tg("sendMessage", {
      chat_id: chatId,
      text: list || "هنوز مقاله‌ای منتشر نشده است.",
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    return;
  }

  if (text.startsWith("/delete")) {
    const slug = text.split(/\s+/)[1];
    if (!slug) { await reply(chatId, "استفاده: /delete post-20261124-1010"); return; }
    try {
      await deleteFile(`blog/${slug}.html`, `article: delete ${slug}`);
      if (supa) await supa.from("articles").delete().eq("slug", slug);
      await reply(chatId, `✅ مقاله ${slug} حذف شد (تا ~۱ دقیقه دیگر از سایت برداشته می‌شود).`);
    } catch (e) {
      await reply(chatId, "❌ حذف ناموفق: " + (e as Error).message);
    }
    return;
  }

  const draft = parseDraft(text);
  if (!draft) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: "فرمت درست نیست. برای راهنما /help را بفرستید.",
    });
    return;
  }

  try {
    const url = await publish(draft);
    await tg("sendMessage", {
      chat_id: chatId,
      text:
        `✅ مقاله منتشر شد!\n\n<b>${esc(draft.title)}</b>\n${url}\n\n` +
        "(تا ~۱ دقیقه دیگر روی سایت قابل مشاهده است.)",
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  } catch (e) {
    await reply(chatId, "❌ خطا در انتشار: " + (e as Error).message);
  }
}

/* ---------- سرور ---------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, bot: "datatime-article-bot" }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  if (SECRET && req.headers.get("x-telegram-bot-api-secret-token") !== SECRET) {
    return new Response("forbidden", { status: 403, headers: CORS });
  }

  try {
    const update = await req.json();
    await handleUpdate(update);
  } catch (e) {
    console.error((e as Error).message);
  }

  return new Response("ok", { headers: CORS });
});
