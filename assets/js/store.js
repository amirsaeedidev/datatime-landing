/* ============================================================
   لایه‌ی داده‌ی دیتاتایم (Data Layer)
   ------------------------------------------------------------
   دو حالت کار می‌کند:
   • local : localStorage  → دمو / تست تک‌کاربره
   • cloud : Supabase REST → داده‌ی واقعی بین همه‌ی بازدیدکنندگان
   ============================================================ */
(function () {
  "use strict";

  var CFG = window.DT_CONFIG || {};
  var KEYS = { agents: "dt_agents", sales: "dt_sales", views: "dt_views", articles: "dt_articles" };
  var CLOUD = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);

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
      "Authorization": "Bearer " + CFG.SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    };
    if (method === "POST") headers["Prefer"] = "return=representation";
    return fetch(url, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
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

    /* ===== نمایندگان ===== */
    listAgents: function () {
      if (CLOUD) return api("GET", "agents", null, "select=*&order=created_at.asc")
        .catch(function () { return ls(KEYS.agents, []); });
      return Promise.resolve(ls(KEYS.agents, []));
    },

    saveAgent: function (agent) {
      var row = Object.assign({
        id: uid(), code: "", name: "", phone: "", createdAt: today()
      }, agent);
      if (CLOUD) return api("POST", "agents", [row]);
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
      if (CLOUD) return api("POST", "sales", [row]);
      var list = ls(KEYS.sales, []); list.unshift(row); lsSet(KEYS.sales, list);
      return Promise.resolve(row);
    },

    listSales: function () {
      if (CLOUD) return api("GET", "sales", null, "select=*&order=ts.desc")
        .catch(function () { return ls(KEYS.sales, []); });
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
        .catch(function () { return ls(KEYS.views, []).filter(function (v) { return v.date >= sinceDate; }); });
      return Promise.resolve(
        ls(KEYS.views, []).filter(function (v) { return v.date >= sinceDate; })
      );
    },

    /* ===== مقالات (منتشرشده از ربات تلگرام) ===== */
    listArticles: function () {
      if (CLOUD) return api("GET", "articles", null, "select=*&order=created_at.desc")
        .catch(function () { return ls(KEYS.articles, []); });
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
