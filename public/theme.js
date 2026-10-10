/* Applies the saved colour theme before first paint ('light' or 'midnight'; nothing saved = follow the device). */
(function () {
  var t;
  try { t = localStorage.getItem('kf_theme'); } catch (e) { /* private mode: follow the device */ }
  if (t === 'light' || t === 'midnight') document.documentElement.setAttribute('data-theme', t);
})();
