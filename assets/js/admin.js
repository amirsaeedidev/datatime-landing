/* ============================================================
   پنل مدیریت دیتاتایم
   ------------------------------------------------------------
   ⚠ توجه: احراز هویت این پنل سمت کلاینت است و برای محافظت واقعی
   از داده‌ها باید Supabase + RLS مناسب یا بک‌اند اختصاصی داشته باشید.
   ============================================================ */
(function () {
  "use strict";

  var store = window.DTStore;
  var $ = function (s) { return document.querySelector(s); };

  /* ---------- ابزار ---------- */
  function fa(n) { return String(n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[d]; }); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function faDate(iso) {
    try {
      return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" })
        .format(new Date(iso + "T12:00:00"));
    } catch (e) { return iso; }
  }
  function faWeekday(iso) {
    try {
      return new Intl.DateTimeFormat("fa-IR", { weekday: "short" }).format(new Date(iso + "T12:00:00"));
    } catch (e) { return iso.slice(5); }
  }

  /* ---------- احراز هویت ساده ---------- */
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return String(h);
  }

  var gate = $("#gate"), panel = $("#panel");

  function openPanel() {
    gate.hidden = true;
    panel.hidden = false;
    renderMode();
    initTelegramSettings();
    loadAll();
  }

  $("#gateForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var pass = $("#gatePass").value;
    if (pass.length < 4) { alert("رمز باید حداقل ۴ نویسه باشد."); return; }
    var saved = localStorage.getItem("dt_admin_hash");
    if (!saved) {
      localStorage.setItem("dt_admin_hash", hash(pass));
      sessionStorage.setItem("dt_admin_ok", "1");
      openPanel();
      return;
    }
    if (hash(pass) === saved) {
      sessionStorage.setItem("dt_admin_ok", "1");
      openPanel();
    } else {
      alert("رمز اشتباه است.");
    }
  });

  $("#logoutBtn").addEventListener("click", function () {
    sessionStorage.removeItem("dt_admin_ok");
    location.reload();
  });

  function renderMode() {
    var el = $("#modeBadge");
    var modeText;
    if (store.mode === "cloud") {
      el.textContent = "حالت ابری: Supabase متصل است ✓";
      el.classList.add("cloud");
      modeText = "حالت ابری (Supabase متصل است ✓) — داده‌ی همه‌ی کاربران در سرور ذخیره می‌شود.";
    } else {
      el.textContent = "حالت دمو: داده‌ها فقط در همین مرورگر ذخیره می‌شوند";
      modeText = "حالت دمو — داده‌ها فقط در همین مرورگر ذخیره می‌شوند.";
    }
    var sm = $("#settingsMode");
    if (sm) sm.textContent = modeText;
  }

  /* ---------- تب‌ها ---------- */
  var tabs = document.querySelectorAll(".adm-tabs button");
  tabs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      tabs.forEach(function (b) { b.classList.remove("on"); });
      btn.classList.add("on");
      document.querySelectorAll(".adm-view").forEach(function (v) { v.hidden = true; });
      var view = document.getElementById("view-" + btn.dataset.view);
      if (view) view.hidden = false;
    });
  });

  /* ---------- بارگذاری داده ---------- */
  var state = { agents: [], sales: [], views: [], articles: [] };

  function loadAll() {
    Promise.all([
      store.listAgents(),
      store.listSales(),
      store.getViews(store.daysAgo(29)),
      store.listArticles()
    ]).then(function (res) {
      state.agents = res[0] || [];
      state.sales = res[1] || [];
      state.views = res[2] || [];
      state.articles = res[3] || [];
      renderDashboard();
      renderAgents();
      renderSales();
      renderViews();
      renderArticles();
    }).catch(function (err) {
      alert("خطا در خواندن داده‌ها: " + err.message);
    });
  }

  /* ---------- داشبورد ---------- */
  function renderDashboard() {
    var today = store.today();
    var viewsToday = state.views.filter(function (v) { return v.date === today; }).length;
    var views7 = state.views.filter(function (v) { return v.date >= store.daysAgo(6); }).length;

    $("#kpiViewsToday").textContent = fa(viewsToday);
    $("#kpiViews7").textContent = fa(views7);
    $("#kpiSales").textContent = fa(state.sales.length);
    $("#kpiAgents").textContent = fa(state.agents.length);

    /* نمودار ۷ روز اخیر */
    var days = [];
    for (var i = 6; i >= 0; i--) days.push(store.daysAgo(i));
    var counts = days.map(function (d) {
      return state.views.filter(function (v) { return v.date === d; }).length;
    });
    var max = Math.max.apply(null, counts.concat([1]));

    var chart = "";
    days.forEach(function (d, idx) {
      var h = Math.max(4, Math.round((counts[idx] / max) * 100));
      chart += '<div class="col">' +
        '<div class="bar" style="height:' + h + '%"><em>' + fa(counts[idx]) + "</em></div>" +
        '<span class="lbl">' + faWeekday(d) + "</span></div>";
    });
    $("#chart7").innerHTML = chart;

    /* برترین نمایندگان */
    var countsByName = {};
    state.sales.forEach(function (s) {
      if (s.valid && s.agentName) countsByName[s.agentName] = (countsByName[s.agentName] || 0) + 1;
    });
    var rows = Object.keys(countsByName)
      .map(function (k) { return { name: k, n: countsByName[k] }; })
      .sort(function (a, b) { return b.n - a.n; });

    $("#topAgents").innerHTML = rows.length
      ? rows.map(function (r) {
          return "<tr><td><b>" + esc(r.name) + "</b></td><td>" + fa(r.n) + " فروش</td></tr>";
        }).join("")
      : '<tr><td class="empty-note">هنوز فروشی ثبت نشده است.</td></tr>';
  }

  /* ---------- نمایندگان ---------- */
  function suggestCode(name) {
    var base = String(name || "").replace(/[^\u0600-\u06FFa-zA-Z]/g, "").slice(0, 4);
    var num = String(Math.floor(1000 + Math.random() * 9000));
    return "DT-" + (base || "AG") + "-" + num;
  }

  function renderAgents() {
    $("#agentsBody").innerHTML = state.agents.length
      ? state.agents.map(function (a) {
          var sold = state.sales.filter(function (s) { return s.agentId === a.id && s.valid; }).length;
          return "<tr>" +
            "<td><b>" + esc(a.name) + "</b></td>" +
            "<td>" + esc(a.phone || "—") + "</td>" +
            "<td><b dir=\"ltr\">" + esc(a.code) + "</b></td>" +
            "<td>" + fa(sold) + "</td>" +
            '<td><button class="btn btn-danger btn-sm" data-del="' + esc(a.id) + '">حذف</button></td>' +
            "</tr>";
        }).join("")
      : '<tr><td colspan="5" class="empty-note">هنوز نماینده‌ای ثبت نشده است.</td></tr>';

    $("#agentsBody").querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!confirm("این نماینده حذف شود؟ سوابق فروش او باقی می‌ماند.")) return;
        store.deleteAgent(btn.dataset.del).then(loadAll);
      });
    });
  }

  $("#agentName").addEventListener("input", function () {
    if (!$("#agentCode").dataset.touched) {
      $("#agentCode").value = suggestCode(this.value);
    }
  });
  $("#agentCode").addEventListener("input", function () {
    this.dataset.touched = "1";
  });

  $("#agentForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("#agentName").value.trim();
    var code = $("#agentCode").value.trim().toUpperCase();
    var phone = $("#agentPhone").value.trim();
    if (!name || !code) { alert("نام و کد تخفیف الزامی است."); return; }

    store.findByCode(code).then(function (dup) {
      if (dup) { alert("این کد تخفیف قبلاً ثبت شده است: " + dup.name); return; }
      return store.saveAgent({ name: name, code: code, phone: phone });
    }).then(function (saved) {
      if (!saved) return;
      $("#agentForm").reset();
      delete $("#agentCode").dataset.touched;
      loadAll();
    });
  });

  /* ---------- فروش‌ها ---------- */
  function renderSales() {
    $("#salesBody").innerHTML = state.sales.length
      ? state.sales.slice(0, 200).map(function (s) {
          return "<tr>" +
            "<td>" + faDate(s.date) + "</td>" +
            "<td><b>" + esc(s.agentName || "—") + "</b></td>" +
            "<td dir=\"ltr\">" + esc(s.code || "—") + "</td>" +
            '<td>' + (s.valid ? '<span class="badge ok">معتبر</span>' : '<span class="badge no">نامعتبر</span>') + "</td>" +
            "<td>" + esc(s.customer) + "</td>" +
            "<td dir=\"ltr\">" + esc(s.phone) + "</td>" +
            "<td>" + esc(s.type || "—") + "</td>" +
            "</tr>";
        }).join("")
      : '<tr><td colspan="7" class="empty-note">هنوز درخواستی ثبت نشده است.</td></tr>';
  }

  $("#exportCsv").addEventListener("click", function () {
    var head = ["تاریخ", "نماینده", "کد", "وضعیت", "مشتری", "تلفن", "نوع مجموعه"];
    var lines = [head.join(",")];
    state.sales.forEach(function (s) {
      lines.push([
        s.date, s.agentName || "", s.code || "", s.valid ? "معتبر" : "نامعتبر",
        s.customer, s.phone, s.type
      ].map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(","));
    });
    var blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "datatime-sales.csv";
    a.click();
  });

  /* ---------- بازدیدها ---------- */
  function renderViews() {
    var today = store.today();
    var map = {};
    state.views.forEach(function (v) {
      if (!map[v.path]) map[v.path] = { today: 0, total: 0 };
      map[v.path].total++;
      if (v.date === today) map[v.path].today++;
    });
    var rows = Object.keys(map)
      .map(function (p) { return { path: p, today: map[p].today, total: map[p].total }; })
      .sort(function (a, b) { return b.total - a.total; });

    $("#viewsBody").innerHTML = rows.length
      ? rows.map(function (r) {
          return "<tr>" +
            '<td dir="ltr"><b>' + esc(r.path) + "</b></td>" +
            "<td>" + fa(r.today) + "</td>" +
            "<td>" + fa(r.total) + "</td>" +
            "</tr>";
        }).join("")
      : '<tr><td colspan="3" class="empty-note">هنوز بازدیدی ثبت نشده است.</td></tr>';
  }

  /* ---------- مقالات ---------- */
  function renderArticles() {
    var body = $("#articlesBody");
    if (!body) return;
    body.innerHTML = state.articles.length
      ? state.articles.map(function (a) {
          return "<tr>" +
            "<td><b>" + esc(a.title) + "</b></td>" +
            "<td>" + esc(a.cat || "مقاله") + "</td>" +
            "<td>" + esc(a.date || "") + "</td>" +
            '<td><a href="blog/' + esc(a.slug) + '.html" target="_blank" rel="noopener" style="font-weight:700;color:#33415c">مشاهده ↗</a></td>' +
            '<td><button class="btn btn-danger btn-sm" data-adel="' + esc(a.id) + '">حذف رکورد</button></td>' +
            "</tr>";
        }).join("")
      : '<tr><td colspan="5" class="empty-note">هنوز مقاله‌ای از تلگرام منتشر نشده است. راهنما در README.</td></tr>';

    body.querySelectorAll("[data-adel]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!confirm("فقط رکورد این مقاله از لیست پاک شود؟ (فایل مقاله باقی می‌ماند)")) return;
        store.deleteArticle(btn.dataset.adel).then(loadAll);
      });
    });
  }

  /* ---------- تنظیمات تلگرام ---------- */
  function initTelegramSettings() {
    var tokenEl = $("#tgToken");
    var chatEl = $("#tgChat");
    var statusEl = $("#tgStatus");
    if (!tokenEl || !chatEl) return;

    var C = window.DT_CONFIG || {};
    try {
      tokenEl.value = localStorage.getItem("dt_tg_token") || C.TELEGRAM_BOT_TOKEN || "";
      chatEl.value = localStorage.getItem("dt_tg_chat") || C.TELEGRAM_CHAT_ID || "";
    } catch (e) {}

    if (window.DTNotify && DTNotify.isConfigured()) {
      statusEl.textContent = "ربات متصل است ✓ — با دکمه‌ی تست یک پیام نمونه بفرستید.";
    } else {
      statusEl.textContent = "ربات هنوز تنظیم نشده است.";
    }

    $("#tgSave").addEventListener("click", function () {
      try {
        localStorage.setItem("dt_tg_token", tokenEl.value.trim());
        localStorage.setItem("dt_tg_chat", chatEl.value.trim());
      } catch (e) {}
      statusEl.textContent = "در همین مرورگر ذخیره شد ✓ (برای اتصال واقعی، در config.js هم قرار دهید)";
    });

    $("#tgTest").addEventListener("click", function () {
      statusEl.textContent = "در حال ارسال…";
      if (!window.DTNotify) { statusEl.textContent = "خطا در بارگذاری ماژول اعلان."; return; }
      if (!tokenEl.value.trim() || !chatEl.value.trim()) {
        statusEl.textContent = "ابتدا توکن و Chat ID را وارد و ذخیره کنید.";
        return;
      }
      try {
        localStorage.setItem("dt_tg_token", tokenEl.value.trim());
        localStorage.setItem("dt_tg_chat", chatEl.value.trim());
      } catch (e) {}

      DTNotify.send("✅ پیام تست از پنل مدیریت دیتاتایم — اتصال ربات برقرار است!")
        .then(function (ok) {
          statusEl.textContent = ok
            ? "پیام تست ارسال شد ✓ تلگرام خود را چک کنید."
            : "ارسال ناموفق — توکن یا Chat ID را بررسی کنید (و اینکه یک‌بار به ربات پیام Start داده باشید).";
        });
    });
  }

  /* ---------- تنظیمات: پشتیبان ---------- */
  $("#exportJson").addEventListener("click", function () {
    var data = {
      exportedAt: new Date().toISOString(),
      agents: state.agents, sales: state.sales, views: state.views, articles: state.articles
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "datatime-backup.json";
    a.click();
  });

  $("#clearData").addEventListener("click", function () {
    if (!confirm("تمام داده‌های محلی (نمایندگان، فروش‌ها، بازدیدها، مقالات) پاک شود؟")) return;
    try {
      localStorage.removeItem("dt_agents");
      localStorage.removeItem("dt_sales");
      localStorage.removeItem("dt_views");
      localStorage.removeItem("dt_articles");
    } catch (e) {}
    loadAll();
  });

  /* ---------- شروع ---------- */
  if (sessionStorage.getItem("dt_admin_ok") === "1") {
    openPanel();
  } else {
    var saved = localStorage.getItem("dt_admin_hash");
    $("#gateTitle").textContent = saved ? "ورود به پنل مدیریت" : "تعیین رمز پنل";
    $("#gateHint").textContent = saved
      ? "برای مشاهده‌ی آمار، رمز پنل را وارد کنید."
      : "اولین ورود است؛ یک رمز برای پنل انتخاب کنید (حداقل ۴ نویسه).";
    gate.hidden = false;
    panel.hidden = true;
  }
})();
