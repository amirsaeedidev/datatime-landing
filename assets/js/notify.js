/* ============================================================
   اعلان‌های تلگرام دیتاتایم — نسخه‌ی امن
   ------------------------------------------------------------
   توکن ربات دیگر در مرورگر نیست. این ماژول فقط تابع notify را در
   Supabase صدا می‌زند؛ آن تابع رکورد را از دیتابیس می‌خواند و
   پیام را با توکنی که در Secret سرور نگه داشته شده ارسال می‌کند.
   ============================================================ */
(function () {
  "use strict";

  var CFG = window.DT_CONFIG || {};

  function endpoint() {
    return String(CFG.NOTIFY_FUNCTION_URL || "").trim();
  }

  var DTNotify = {
    isConfigured: function () {
      return !!endpoint();
    },

    /* فراخوانی تابع سرور — با JWT عمومی سایت ( Supabase آن را تأیید می‌کند ) */
    call: function (payload) {
      if (!endpoint()) return Promise.resolve(false);
      return fetch(endpoint(), {
        method: "POST",
        headers: {
          "apikey": CFG.SUPABASE_ANON_KEY || "",
          "Authorization": "Bearer " + (CFG.SUPABASE_ANON_KEY || ""),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.ok; }).catch(function () { return false; });
    },

    /* اعلان یک درخواست ثبت‌شده — فقط با شناسه‌ی رکورد؛ متن پیام در سرور ساخته می‌شود */
    sale: function (saleIdOrObj) {
      var id = typeof saleIdOrObj === "string" ? saleIdOrObj : (saleIdOrObj && saleIdOrObj.saleId);
      return id ? DTNotify.call({ saleId: id }) : Promise.resolve(false);
    },

    /* پیام تست از پنل مدیریت */
    test: function () {
      return DTNotify.call({ test: true });
    }
  };

  window.DTNotify = DTNotify;
})();
