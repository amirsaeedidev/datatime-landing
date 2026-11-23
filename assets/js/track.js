/* ثبت بازدید صفحه — در همه‌ی صفحات بارگذاری می‌شود */
(function () {
  "use strict";
  try {
    if (!window.DTStore) return;
    var path = location.pathname.replace(/^.*\/datatime-landing/, "") || "/";
    window.DTStore.trackView(path);
  } catch (e) { /* بی‌صدا — خطای آمار نباید صفحه را بشکند */ }
})();
