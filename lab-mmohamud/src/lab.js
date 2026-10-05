// lab.mmohamud.me: theme, phone menu, section highlight, reading progress, copy buttons, catalog filters.
(function () {
  // ----- Floating light/dark button -----
  // Clicking switches theme and remembers it. Switching back to what the time of day would show
  // returns to automatic, so visitors never get stuck on a choice.
  (function () {
    var T = window.mmTheme; if (!T) return;
    var root = document.documentElement;
    var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "theme-fab";
    function render() {
      var dark = T.theme() === "dark", auto = T.mode() === "time";
      btn.innerHTML = (dark ? SUN : MOON) + (auto ? '<span class="auto-dot" aria-hidden="true"></span>' : "");
      var label = dark ? "Switch to light theme" : "Switch to dark theme";
      btn.setAttribute("aria-label", label + (auto ? " (now automatic by time of day)" : ""));
      btn.title = label + (auto ? " · now automatic by time of day" : "");
    }
    btn.addEventListener("click", function () {
      var next = T.theme() === "dark" ? "light" : "dark";
      root.classList.add("theme-animating");
      T.set(next === T.auto() ? "time" : next);
      setTimeout(function () { root.classList.remove("theme-animating"); }, 400);
      render();
    });
    window.addEventListener("storage", render);
    setInterval(render, 60000);
    render();
    document.body.appendChild(btn);
  })();

  // ----- Phone menu -----
  var burger = document.querySelector(".burger"), pmenu = document.getElementById("phone-menu");
  if (burger && pmenu) {
    var setMenu = function (open) {
      pmenu.hidden = !open;
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    burger.addEventListener("click", function () { setMenu(pmenu.hidden); });
    pmenu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pmenu.hidden) { setMenu(false); burger.focus(); } });
    window.addEventListener("resize", function () { if (window.innerWidth > 900 && !pmenu.hidden) setMenu(false); });
  }

  // ----- "On this page": highlight the section you're reading -----
  var tocLinks = document.querySelectorAll(".rail a");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    tocLinks.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var setActive = function (link) {
      tocLinks.forEach(function (a) { a.classList.remove("active"); a.removeAttribute("aria-current"); });
      if (link) { link.classList.add("active"); link.setAttribute("aria-current", "true"); }
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) setActive(byId[e.target.id]); });
    }, { rootMargin: "0px 0px -70% 0px" });
    Object.keys(byId).forEach(function (id) { var h = document.getElementById(id); if (h) io.observe(h); });
    setActive(tocLinks[0]);
  }

  // ----- Reading progress -----
  var bar = document.querySelector(".progress span"), article = document.querySelector(".lab");
  if (bar && article) {
    var ticking = false;
    var update = function () {
      var rect = article.getBoundingClientRect();
      var total = rect.height - window.innerHeight * 0.6;
      var done = Math.min(1, Math.max(0, -rect.top / (total > 0 ? total : 1)));
      bar.style.transform = "scaleX(" + done + ")";
      ticking = false;
    };
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // ----- Copy buttons: code panels and the checksum -----
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-copy], [data-copy-code]");
    if (!btn) return;
    var text = btn.hasAttribute("data-copy") ? btn.getAttribute("data-copy")
      : (btn.closest(".term").querySelector("pre code") || {}).textContent || "";
    var done = function (ok) {
      var old = btn.textContent;
      btn.textContent = ok ? "Copied" : "Press Ctrl+C";
      setTimeout(function () { btn.textContent = old; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    else done(false);
  });

  // ----- Catalog: filters and search (combine, and stay in the address so a view can be shared) -----
  var list = document.getElementById("lab-list");
  if (list) {
    var items = Array.prototype.slice.call(list.children);
    var boxes = Array.prototype.slice.call(document.querySelectorAll(".filters input[type=checkbox]"));
    var search = document.getElementById("lab-search");
    var countEl = document.getElementById("lab-count"), empty = document.getElementById("filter-empty"), clear = document.getElementById("clear-filters");
    var label = document.querySelector("#cat-h");
    var picked = function (group) { return boxes.filter(function (b) { return b.dataset.group === group && b.checked; }).map(function (b) { return b.value; }); };
    var apply = function (fromUser) {
      var certs = picked("cert"), levels = picked("level"), domains = picked("domain");
      var words = (search.value || "").toLowerCase().split(/\s+/).filter(Boolean);
      var shown = 0;
      items.forEach(function (li) {
        var c = (li.dataset.cert || "").split("|");
        var ok = (!certs.length || certs.some(function (x) { return c.indexOf(x) !== -1; }))
          && (!levels.length || levels.indexOf(li.dataset.level) !== -1)
          && (!domains.length || domains.indexOf(li.dataset.domain) !== -1)
          && words.every(function (w) { return li.dataset.text.indexOf(w) !== -1; });
        li.hidden = !ok;
        if (ok) shown++;
      });
      countEl.textContent = shown;
      label.lastChild.textContent = shown === 1 ? " lab" : " labs";
      empty.hidden = shown > 0;
      var active = certs.length + levels.length + domains.length + words.length > 0;
      clear.hidden = !active;
      if (fromUser) {
        var url = new URL(location.href);
        ["cert", "level", "domain"].forEach(function (g) { var v = picked(g); v.length ? url.searchParams.set(g, v.join(",")) : url.searchParams.delete(g); });
        search.value.trim() ? url.searchParams.set("q", search.value.trim()) : url.searchParams.delete("q");
        history.replaceState(null, "", url);
      }
    };
    var params = new URLSearchParams(location.search);
    boxes.forEach(function (b) { if ((params.get(b.dataset.group) || "").split(",").indexOf(b.value) !== -1) b.checked = true; });
    if (params.get("q")) search.value = params.get("q");
    boxes.forEach(function (b) { b.addEventListener("change", function () { apply(true); }); });
    search.addEventListener("input", function () { apply(true); });
    clear.addEventListener("click", function () { boxes.forEach(function (b) { b.checked = false; }); search.value = ""; apply(true); search.focus(); });
    apply(false);
  }
})();
