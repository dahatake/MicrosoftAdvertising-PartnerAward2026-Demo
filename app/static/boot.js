"use strict";
/* Script loader with retry. A page needs a dozen scripts, loaded one after another in dependency order.
   If one request fails (a transient 5xx from a proxy, a dropped connection) it is retried instead of
   leaving the app half-loaded with errors such as "A.updatePill is not a function". */
(function () {
  var SCRIPTS = ["/vendor/d3.min.js", "/ui.js", "/art.js", "/fx.js", "/charts.js", "/dashboard.js", "/case.js", "/ops.js", "/res.js", "/biz.js", "/biz2.js", "/main.js"];
  var MAX_TRIES = 8, i = 0, tries = 0, box = document.getElementById("boot");

  function say(msg, bad) {
    if (!box) return;
    box.textContent = msg; box.className = bad ? "bad" : "";
  }
  function fail(src) {
    say("読み込みに失敗しました（" + src + "）。 / Failed to load " + src + ".", true);
    var b = document.createElement("button"); b.className = "btn accent"; b.textContent = "再読み込み / Reload";
    b.addEventListener("click", function () { location.reload(); }); box.append(document.createElement("br"), b);
  }
  function next() {
    if (i >= SCRIPTS.length) { if (box) box.remove(); window.__booted = true; return; }
    var s = document.createElement("script");
    s.src = SCRIPTS[i] + (tries ? "?r=" + tries + "&t=" + Date.now() : ""); // the server ignores the query; it only defeats a cached failure
    s.onload = function () { i++; tries = 0; next(); };
    s.onerror = function () {
      s.remove();
      if (++tries >= MAX_TRIES) return fail(SCRIPTS[i]);
      say("読み込み中… 再試行 " + tries + " / Retrying " + SCRIPTS[i] + " (" + tries + ")");
      setTimeout(next, 200 * tries);
    };
    document.head.appendChild(s);
  }
  window.__bootScripts = SCRIPTS;
  next();
})();
