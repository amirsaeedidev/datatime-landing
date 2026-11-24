/* ============================================================
   لایه‌ی داده‌ی دیتاتایم (Data Layer)
   ------------------------------------------------------------
   • local : localStorage  → دمو / تست تک‌کاربره
   • cloud : Supabase REST → داده‌ی واقعی بین همه‌ی بازدیدکنندگان
   ------------------------------------------------------------
   در حالت ابری، پس از ورود مدیر (Supabase Auth) توکن کاربر به‌جای
   کلید عمومی در هدر Authorization قرار می‌گیرد تا سیاست‌های RLS اجازه‌ی
   خواندن داده‌ها را بدهند.
   ============================================================ */
(function () {
  "use strict";

  var CFG = window.DT_CONFIG || {};
  var KEYS = { agents: "dt_agents", sales: "dt_sales", views: "dt_views", articles: "dt_articles" };
  var CLOUD = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);

  /* توکن جلسه‌ی مدیر */
  var authToken = null;
  try { authToken = sessionStorage.getItem("dt_admin_token") || null; } catch (e) {}

  /* ---------- ابزار ---------- */
  function pad(n) { return String(n).length < 2 ? "0" + n : String(n); }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function daysAgo(n) {
    var d = new Date(); d.setDate(d.getDate() - n);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function ls(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  /* ---------- Supabase REST ---------- */
  function api(method, table, body, query) {
    var url = String(CFG.SUPABASE_URL).replace(/\/+$/, "") +
              "/rest/v1/" + table + (query ? "?" + query : "");
    var headers = {
      "apikey": CFG.SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + (authToken || CFG.SUPABASE_ANON_KEY),
      "Content-Type": "application/json"
    };
    if (method === "POST") headers["Prefer"] = "return=representation";
    return fetch(url, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      if (res.status === 401) throw new Error("نشست شما منقضی شده؛ دوباره وارد شوید.");
      if (!res.ok) throw new Error("Supabase " + res.status);
      return res.status === 204 ? [] : res.json();
    });
  }

  /* ---------- فروشگاه ---------- */
  var store = {
    mode: CLOUD ? "cloud" : "local",
    today: today,
    daysAgo: daysAgo,
    uid: uid,

    /* ===== احراز هویت مدیر ===== */
    setAuthToken: function (token) {
      authToken = token || null;
      try {
        if (token) sessionStorage.setItem("dt_admin_token", token);
        else sessionStorage.removeItem("dt_admin_token");
      } catch (e) {}
    },
    hasAuthToken: function () { return !!authToken; },
    getAuthToken: function () { return authToken || (CFG.SUPABASE_ANON_KEY || ""); },

    login: function (email, password) {
      return fetch(String(CFG.SUPABASE_URL).replace(/\/+$/, "") + "/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: { "apikey": CFG.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password })
      }).then(function (res) {
        if (!res.ok) throw new Error("ایمیل یا رمز عبور اشتباه است.");
        return res.json();
      }).then(function (j) {
        store.setAuthToken(j.access_token);
        return j;
      });
    },

    logout: function () { store.setAuthToken(null); },

    /* ===== آپلود عکس به Supabase Storage ===== */
    uploadImage: function (file) {
      if (!CLOUD) {
        return Promise.reject(new Error("ابتدا Supabase را در config.js وصل کنید."));
      }
      var name = "blog/" + Date.now() + "-" +
        String(file.name || "image").replace(/[^\w.-]/g, "_");
      return fetch(String(CFG.SUPABASE_URL).replace(/\/+$/, "") +
        "/storage/v1/object/article-images/" + name, {
        method: "POST",
        headers: {
          "apikey": CFG.SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + (authToken || CFG.SUPABASE_ANON_KEY),
          "Content-Type": file.type || "image/jpeg",
          "x-upsert": "true"
        },
        body: file
      }).then(function (res) {
        if (!res.ok) throw new Error("آپلود ناموفق: " + res.status);
        return String(CFG.SUPABASE_URL).replace(/\/+$/, "") +
          "/storage/v1/object/public/article-images/" + name;
      });
    },

    /* ===== نمایندگان ===== */
    listAgents: function () {
      if (CLOUD) return api("GET", "agents", null, "select=*&order=created_at.asc")
        .catch(function () { return []; });
      return Promise.resolve(ls(KEYS.agents, []));
    },

    saveAgent: function (agent) {
      var row = Object.assign({ id: uid(), code: "", name: "", phone: "", createdAt: today() }, agent);
      if (CLOUD) return api("POST", "agents", [row])
        .then(function (rows) { return Array.isArray(rows) ? rows[0] : rows; });
      var list = ls(KEYS.agents, []); list.push(row); lsSet(KEYS.agents, list);
      return Promise.resolve(row);
    },

    updateAgent: function (id, patch) {
      if (CLOUD) return api("PATCH", "agents", patch, "id=eq." + encodeURIComponent(id));
      var list = ls(KEYS.agents, []).map(function (a) {
        return a.id === id ? Object.assign(a, patch) : a;
      });
      lsSet(KEYS.agents, list);
      return Promise.resolve(true);
    },

    deleteAgent: function (id) {
      if (CLOUD) return api("DELETE", "agents", null, "id=eq." + encodeURIComponent(id));
      lsSet(KEYS.agents, ls(KEYS.agents, []).filter(function (a) { return a.id !== id; }));
      return Promise.resolve(true);
    },

    findByCode: function (code) {
      var c = String(code || "").trim().toUpperCase();
      return store.listAgents().then(function (list) {
        for (var i = 0; i < list.length; i++) {
          if (String(list[i].code || "").trim().toUpperCase() === c) return list[i];
        }
        return null;
      });
    },

    /* ===== فروش‌ها ===== */
    recordSale: function (sale) {
      var row = Object.assign({
        id: uid(), agentId: "", agentName: "", code: "", valid: false,
        customer: "", phone: "", type: "", msg: "",
        date: today(), ts: Date.now()
      }, sale);

      var p;
      if (CLOUD) {
        p = api("POST", "sales", [row])
          .then(function (rows) { return Array.isArray(rows) ? rows[0] : rows; });
      } else {
        var list = ls(KEYS.sales, []); list.unshift(row); lsSet(KEYS.sales, list);
        p = Promise.resolve(row);
      }

      /* اعلان تلگرام: بعد از ثبت، فقط با شناسه‌ی رکورد —
         متن پیام در سرور از دیتابیس ساخته می‌شود و قابل جعل نیست */
      return p.then(function (saved) {
        if (saved && saved.id && window.DTNotify) {
          try { window.DTNotify.sale(saved.id); } catch (e) {}
        }
        return saved;
      });
    },

    listSales: function () {
      if (CLOUD) return api("GET", "sales", null, "select=*&order=ts.desc")
        .catch(function () { return []; });
      return Promise.resolve(ls(KEYS.sales, []));
    },

    /* ===== بازدیدها ===== */
    trackView: function (path) {
      var row = { id: uid(), path: path || "/", date: today(), ts: Date.now() };
      if (CLOUD) return api("POST", "views", [row]).catch(function () { return null; });
      var list = ls(KEYS.views, []); list.push(row);
      if (list.length > 6000) list = list.slice(-6000);
      lsSet(KEYS.views, list);
      return Promise.resolve(row);
    },

    getViews: function (sinceDate) {
      if (CLOUD) return api("GET", "views", null, "select=*&date=gte." + sinceDate)
        .catch(function () { return []; });
      return Promise.resolve(
        ls(KEYS.views, []).filter(function (v) { return v.date >= sinceDate; })
      );
    },

    /* ===== مقالات ===== */
    listArticles: function () {
      if (CLOUD) return api("GET", "articles", null, "select=*&order=created_at.desc")
        .catch(function () { return []; });
      return Promise.resolve(ls(KEYS.articles, []));
    },

    deleteArticle: function (id) {
      if (CLOUD) return api("DELETE", "articles", null, "id=eq." + encodeURIComponent(id));
      lsSet(KEYS.articles, ls(KEYS.articles, []).filter(function (a) { return a.id !== id; }));
      return Promise.resolve(true);
    },

    /* ===== تنظیمات محلی ===== */
    getSetting: function (key, fallback) {
      var v = null;
      try { v = localStorage.getItem("dt_set_" + key); } catch (e) {}
      return v === null ? fallback : v;
    },
    setSetting: function (key, value) {
      try { localStorage.setItem("dt_set_" + key, value); } catch (e) {}
    }
  };

  window.DTStore = store;
})();
