/* mmohamud.me site script: announcement banner, maintenance mode, privacy-friendly page views and goals.
   Add before </body> on every public *.mmohamud.me page:
     <script defer src="https://admin.mmohamud.me/t.js"></script>
   No cookies. Page views respect Do Not Track and Global Privacy Control. */
(function () {
  var host = location.hostname;
  if (!/(^|\.)mmohamud\.me$/.test(host) || host === "admin.mmohamud.me") return;

  var ADMIN = "https://admin.mmohamud.me";

  // Sites that already know the public config (like the blog) pass it in and skip the extra download.
  var preset = window.BLOG_CFG;
  if (preset && preset.url && preset.key) {
    run({ SUPABASE_URL: preset.url, SUPABASE_ANON_KEY: preset.key });
  } else {
    // Otherwise load the shared public config (project URL + anon key), then run.
    var s = document.createElement("script");
    s.src = ADMIN + "/assets/config.js";
    s.onload = function () { run(window.ADMIN_CONFIG || {}); };
    document.head.appendChild(s);
  }

  function run(cfg) {
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
    loadSettings(cfg);
    track(cfg);
    goals(cfg);
  }

  // ---------- Banner + maintenance (reads public settings) ----------
  function loadSettings(cfg) {
    fetch(cfg.SUPABASE_URL + "/rest/v1/settings?select=key,value&key=in.(banner,maintenance)", {
      headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY },
      cache: "no-store"
    })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var map = {};
        rows.forEach(function (row) { map[row.key] = row.value || {}; });
        var m = map.maintenance || {};
        if (m.enabled && (m.sites || []).indexOf(host) !== -1) return showMaintenance(m.sites || []);
        var b = map.banner || {};
        if (b.enabled && b.text) showBanner(b);
      })
      .catch(function () {});
  }

  function injectStyles() {
    if (document.getElementById("mm-styles")) return;
    var css =
      ".mm-banner{position:relative;z-index:9999;display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 48px;background:#0B2545;color:#fff;font:500 14px/1.4 'DM Sans',system-ui,sans-serif;text-align:center}" +
      ".mm-banner a{color:#FBBF24;font-weight:700;text-decoration:underline;text-underline-offset:3px}" +
      ".mm-banner button{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:#C9D4E3;font-size:20px;line-height:1;cursor:pointer}" +
      ".mm-banner button:hover{background:rgba(255,255,255,.1);color:#fff}" +
      ".mm-maint{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:24px;background:#0B2545;color:#E6ECF4;font:16px/1.6 'DM Sans',system-ui,sans-serif;text-align:center}" +
      ".mm-maint h1{margin:0 0 8px;font:700 32px/1.2 'Source Serif 4',Georgia,serif;color:#fff}" +
      ".mm-maint a{color:#FBBF24}";
    var st = document.createElement("style");
    st.id = "mm-styles";
    st.textContent = css;
    document.head.appendChild(st);
  }

  function showBanner(b) {
    var key = "mm-banner-dismissed";
    try { if (localStorage.getItem(key) === b.text) return; } catch (e) {}
    injectStyles();
    var bar = document.createElement("div");
    bar.className = "mm-banner";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Announcement");
    var msg = document.createElement("span");
    msg.textContent = b.text + " ";
    bar.appendChild(msg);
    if (b.link && /^https:\/\//.test(b.link)) {
      var a = document.createElement("a");
      a.href = b.link;
      a.textContent = "Learn more";
      bar.appendChild(a);
    }
    var close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss announcement");
    close.textContent = "\u00d7";
    close.onclick = function () {
      bar.remove();
      try { localStorage.setItem(key, b.text); } catch (e) {}
    };
    bar.appendChild(close);
    document.body.insertBefore(bar, document.body.firstChild);
  }

  // Points visitors to one of your sites that's still up (portfolio, then blog, then labs), or LinkedIn if all are down.
  function fallback(down) {
    var options = [["mmohamud.me", "https://mmohamud.me"], ["blog.mmohamud.me", "https://blog.mmohamud.me"], ["lab.mmohamud.me", "https://lab.mmohamud.me"]];
    for (var i = 0; i < options.length; i++) if (options[i][0] !== host && down.indexOf(options[i][0]) === -1) return options[i];
    return ["LinkedIn", "https://www.linkedin.com/in/mohamed-2-mohamud"];
  }
  function showMaintenance(down) {
    injectStyles();
    var wrap = document.createElement("div");
    wrap.className = "mm-maint";
    wrap.setAttribute("role", "status");
    var inner = document.createElement("div");
    var h = document.createElement("h1");
    h.textContent = "Back shortly";
    var p = document.createElement("p");
    var to = fallback(down || []);
    p.textContent = to[0] === "LinkedIn" ? "This site is getting some updates. In the meantime, find me on " : "This site is getting some updates. In the meantime, visit ";
    var a = document.createElement("a");
    a.href = to[1];
    a.textContent = to[0];
    p.appendChild(a);
    inner.appendChild(h);
    inner.appendChild(p);
    wrap.appendChild(inner);
    document.body.appendChild(wrap);
    document.documentElement.style.overflow = "hidden";
  }

  // ---------- Page views ----------
  function allowed() {
    try {
      if (localStorage.getItem("mm-ignore") === "1") return false;
    } catch (e) {}
    return !(navigator.doNotTrack === "1" || navigator.globalPrivacyControl);
  }
  function send(cfg, payload) {
    var url = cfg.SUPABASE_URL + "/functions/v1/track";
    var data = JSON.stringify(payload);
    var sent = navigator.sendBeacon && navigator.sendBeacon(url, new Blob([data], { type: "text/plain" }));
    if (!sent) fetch(url, { method: "POST", body: data, headers: { "Content-Type": "text/plain" }, keepalive: true }).catch(function () {});
  }
  function outsideHost(u) {
    try { var h = new URL(u, location.href).hostname.replace(/^www\./, ""); return /(^|\.)mmohamud\.me$/.test(h) ? "" : h; } catch (e) { return ""; }
  }
  function track(cfg) {
    try {
      // Owner opt-out: visiting any page with ?mm-ignore=1 stops counting this browser (?mm-ignore=0 undoes it).
      var params = new URLSearchParams(location.search);
      if (params.has("mm-ignore")) {
        if (params.get("mm-ignore") === "1") localStorage.setItem("mm-ignore", "1");
        else localStorage.removeItem("mm-ignore");
        params.delete("mm-ignore");
        var clean = location.pathname + (params.toString() ? "?" + params : "") + location.hash;
        history.replaceState(null, "", clean);
        return;
      }
      if (!allowed()) return;
      // Remember which site sent this visitor, for this tab only, so goals can say "came from LinkedIn".
      var from = document.referrer ? outsideHost(document.referrer) : "";
      try { if (from && !sessionStorage.getItem("mm-src")) sessionStorage.setItem("mm-src", from); } catch (e) {}
      send(cfg, { path: location.pathname, referrer: document.referrer || "" });
    } catch (e) {}
  }

  // ---------- Goals: résumé downloads, messages, sign-ups, outbound clicks ----------
  function goals(cfg) {
    var GOALS = { resume_download: 1, contact_submit: 1, newsletter_signup: 1, outbound_click: 1, lab_download: 1 };
    // Pages call window.mmTrack("contact_submit") etc. when something succeeds.
    window.mmTrack = function (name, detail) {
      try {
        if (!GOALS[name] || !allowed()) return;
        var src = ""; try { src = sessionStorage.getItem("mm-src") || ""; } catch (e) {}
        send(cfg, { path: location.pathname, event: name, detail: detail ? String(detail).slice(0, 120) : "", source: src });
      } catch (e) {}
    };
    // Downloads and links to other sites are noticed automatically.
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      var href = a.getAttribute("href") || "";
      // A link can say which goal it counts as, e.g. <a data-goal="lab_download" data-detail="LAB-01">.
      if (a.dataset.goal && GOALS[a.dataset.goal]) {
        window.mmTrack(a.dataset.goal, a.dataset.detail || href.split("/").pop().split(/[?#]/)[0]);
      } else if (/\.pdf($|[?#])/i.test(href) || a.hasAttribute("download")) {
        window.mmTrack("resume_download", href.split("/").pop().split(/[?#]/)[0] || "file");
      } else if (/^mailto:/i.test(href)) {
        window.mmTrack("outbound_click", "email");
      } else if (/^https?:/i.test(href)) {
        var h = outsideHost(href);
        if (h) window.mmTrack("outbound_click", h);
      }
    }, true);
  }
})();
