/* ============================================================
   اعلان‌های تلگرام دیتاتایم
   مقدارها از DT_CONFIG خوانده می‌شود؛ اگر خالی بود از override
   محلی پنل مدیریت (localStorage) استفاده می‌شود — مناسب تست.
   ============================================================ */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function cfg() {
    var C = window.DT_CONFIG || {};
    var token = C.TELEGRAM_BOT_TOKEN || "";
    var chat = C.TELEGRAM_CHAT_ID || "";
    try {
      token = localStorage.getItem("dt_tg_token") || token;
      chat = localStorage.getItem("dt_tg_chat") || chat;
    } catch (e) {}
    return { token: token, chat: chat };
  }

  var DTNotify = {
    isConfigured: function () {
      var c = cfg();
      return !!(c.token && c.chat);
    },

    /* ارسال پیام متنی به تلگرام — هرگز خطای آن صفحه را نمی‌شکند */
    send: function (text) {
      var c = cfg();
      if (!c.token || !c.chat) return Promise.resolve(false);
      return fetch("https://api.telegram.org/bot" + c.token + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: c.chat,
          text: text,
          parse_mode: "HTML",
          disable_web_page_preview: true
        })
      }).then(function (r) { return r.ok; }).catch(function () { return false; });
    },

    /* اعلان درخواست جدید فرم */
    sale: function (s) {
      var lines = [
        "🔔 <b>درخواست جدید در سایت دیتاتایم</b>",
        "",
        "👤 نام: " + esc(s.name),
        "📞 تلفن: " + esc(s.phone),
        "🏷 مجموعه: " + esc(s.type || "—")
      ];
      if (s.code) {
        lines.push("🎁 کد تخفیف: " + esc(s.code) +
          (s.agent ? " — نماینده: " + esc(s.agent) + " ✓" : " — نامعتبر ✗"));
      } else {
        lines.push("🎁 کد تخفیف: بدون کد");
      }
      if (s.msg) lines.push("📝 توضیحات: " + esc(s.msg));
      return DTNotify.send(lines.join("\n"));
    }
  };

  window.DTNotify = DTNotify;
})();
