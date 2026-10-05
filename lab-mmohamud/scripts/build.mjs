// Builds lab.mmohamud.me as static HTML from published labs in Supabase.
// Usage: SUPABASE_ANON_KEY=... node scripts/build.mjs   → output in _site/
// Writing conventions (in a lab's body, Markdown):
//   ## Heading        → a section in the "On this page" menu (Scenario, Objectives, Environment, Steps, …)
//   ```bash / ```spl  → a labelled terminal panel with a Copy button
//   ```output         → an "Expected output" panel
//   > text            → a note box
//   ![alt](url "Caption") on its own line → a figure with a caption
import { mkdir, rm, writeFile, cp } from "node:fs/promises";
import { join } from "node:path";
import { marked } from "marked";

// ---------- Settings you can edit ----------
const SUPABASE_URL = "https://lurrqcyaybpgidzjfdvh.supabase.co";
const SITE_URL = "https://lab.mmohamud.me";
const SITE_NAME = "Mohamud's Labs";
const HEADLINE = "Practical labs for detection, hardening and incident response.";
const INTRO = "Each lab documents a real exercise end to end: the scenario, the environment, every command, the evidence, and what it taught me. Aligned to Security+ and CySA+.";
const AUTHOR = { name: "Mohamud", line: "Technology and cybersecurity professional, Columbus, Ohio" };
const LINKS = { home: "https://mmohamud.me", blog: "https://blog.mmohamud.me", linkedin: "https://www.linkedin.com/in/mohamed-2-mohamud" };
const DOMAINS = ["Threat detection", "System hardening", "Network analysis", "Vulnerability management", "Incident response"];
const CERTS = ["Security+", "CySA+"];
const LEVELS = { beginner: { n: 1, label: "Beginner" }, intermediate: { n: 2, label: "Intermediate" }, advanced: { n: 3, label: "Advanced" } };
const CODE_LABELS = { bash: "bash", sh: "shell", shell: "shell", zsh: "zsh", powershell: "PowerShell", ps1: "PowerShell", spl: "SPL · Splunk search",
  kql: "KQL", sql: "SQL", python: "Python", py: "Python", yaml: "YAML", yml: "YAML", json: "JSON", ini: "config", conf: "config", text: "text", cisco: "Cisco IOS" };
// --------------------------------------------

const ANON = process.env.SUPABASE_ANON_KEY;
if (!ANON) {
  console.error("Missing SUPABASE_ANON_KEY. Add it under repo Settings → Secrets and variables → Actions.");
  process.exit(1);
}
const OUT = "_site";
const BUILD_ID = Date.now().toString(36);

const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
const labUrl = (l) => `/labs/${l.slug}/`;
const level = (l) => LEVELS[l.difficulty] || LEVELS.beginner;
const duration = (m) => (!m ? "" : m < 60 ? `About ${m} min` : `About ${Math.round((m / 60) * 10) / 10} h`.replace(".0 h", " h"));
const fileSize = (b) => (!b ? "" : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const attackUrl = (t) => `https://attack.mitre.org/techniques/${t.replace(".", "/")}/`;
const safeHttps = (u) => (/^https:\/\/[^\s"'<>]+$/.test(u || "") ? u : "");

// ---------- Fetch published labs ----------
async function fetchLabs() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/labs?select=*&status=eq.published&order=published_at.desc`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  if (!res.ok) throw new Error(`Supabase returned ${res.status}: ${await res.text()}`);
  return (await res.json()).map((l) => ({ ...l, published_at: l.published_at || l.created_at }));
}

// ---------- Markdown ----------
function renderMarkdown(md) {
  const toc = [];
  const used = new Set();
  const renderer = new marked.Renderer();
  renderer.heading = (text, lvl, raw) => {
    let id = raw.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
    while (used.has(id)) id += "-x";
    used.add(id);
    if (lvl === 2) toc.push({ id, text: raw.replace(/<[^>]+>/g, "") });
    return `<h${lvl} id="${id}">${text}</h${lvl}>`;
  };
  renderer.code = (code, lang) => {
    const l = String(lang || "").trim().toLowerCase().split(/\s+/)[0];
    if (l === "output") return `<div class="output"><div class="output-h">Expected output</div><pre><code>${esc(code)}</code></pre></div>`;
    const label = CODE_LABELS[l] || (l ? esc(l) : "code");
    return `<div class="term"><div class="term-h"><span>${label}</span><button type="button" class="copy" data-copy-code>Copy</button></div><pre><code>${esc(code)}</code></pre></div>`;
  };
  renderer.blockquote = (quote) => `<aside class="note">${quote}</aside>`;
  renderer.link = (href, title, text) => {
    const external = /^https?:\/\//.test(href || "") && !(href || "").startsWith(SITE_URL);
    return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ""}${external ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`;
  };
  renderer.image = (href, title, text) => `<img src="${esc(href)}" alt="${esc(text)}" loading="lazy"${title ? ` title="${esc(title)}"` : ""}>`;
  const html = marked.parse(md || "", { renderer, gfm: true })
    .replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>")
    .replace(/<p>(<img [^>]*>)<\/p>/g, (m, img) => {
      const cap = (img.match(/ title="([^"]*)"/) || [])[1];
      return `<figure>${img}${cap ? `<figcaption>${cap}</figcaption>` : ""}</figure>`;
    });
  return { html, toc };
}

// ---------- Pieces ----------
const icon = {
  search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
  shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7z"/><path d="M12 8v4M12 16h.01"/></svg>`,
  check: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  download: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>`,
};
const bars = (l) => `<span class="bars" aria-hidden="true">${[1, 2, 3].map((i) => `<span${i <= level(l).n ? ' class="on"' : ""}></span>`).join("")}</span>`;
const num = (i) => String(i + 1).padStart(2, "0");
const NOTICE = `<p class="notice">${icon.shield}<span><strong>Authorized environments only.</strong> Every lab runs in an isolated environment I own. Never test systems you don't have written permission to test.</span></p>`;

function layout({ title, description, path, body, rail = [], isLab = false, extraHead = "" }) {
  const url = SITE_URL + path;
  const fullTitle = path === "/" ? `${SITE_NAME}: hands-on security labs` : `${title} · ${SITE_NAME}`;
  const nav = (cur) => `<a href="/"${cur ? ' aria-current="page"' : ""}>Labs</a><a href="${LINKS.blog}">Blog</a><a href="${LINKS.home}">Portfolio</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#FFFFFF" id="theme-color">
<script>
/* Theme: light 7 AM–7 PM (visitor's clock), dark otherwise, unless they chose with the ☀/☾ button. Runs before the page is drawn. */
(function () {
  var K = "mm-theme", root = document.documentElement;
  function mode() { try { var v = localStorage.getItem(K); return v === "light" || v === "dark" ? v : "time"; } catch (e) { return "time"; } }
  function auto() { var h = new Date().getHours(); return h >= 7 && h < 19 ? "light" : "dark"; }
  function theme() { var m = mode(); return m === "time" ? auto() : m; }
  function apply() {
    var t = theme(); root.dataset.theme = t; root.dataset.themeMode = mode();
    var mc = document.getElementById("theme-color"); if (mc) mc.content = t === "dark" ? "#0B1120" : "#FFFFFF";
  }
  apply();
  window.mmTheme = { mode: mode, auto: auto, theme: theme, apply: apply,
    set: function (v) { try { v === "time" ? localStorage.removeItem(K) : localStorage.setItem(K, v); } catch (e) {} apply(); } };
  setInterval(function () { if (mode() === "time") apply(); }, 60000);
  window.addEventListener("storage", function (e) { if (e.key === K) apply(); });
})();
</script>
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="${isLab ? "article" : "website"}">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE_URL}/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
${extraHead}
<link rel="preload" href="/assets/fonts/dm-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css?v=${BUILD_ID}">
<link rel="stylesheet" href="/assets/lab.css?v=${BUILD_ID}">
<script>window.BLOG_CFG=${JSON.stringify({ url: SUPABASE_URL, key: ANON })};</script>
</head>
<body${isLab ? ' class="is-lab"' : ""}>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <div class="head-inner">
    <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">M</span><span class="brand-name">${esc(SITE_NAME)}</span></a>
    <nav class="head-nav" aria-label="Main">${nav(path === "/")}</nav>
    <button class="burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="phone-menu"><span></span><span></span><span></span></button>
  </div>
  ${isLab ? `<div class="progress" aria-hidden="true"><span></span></div>` : ""}
  <div class="phone-menu" id="phone-menu" hidden>
    <nav class="pm-nav" aria-label="Main">${nav(path === "/")}</nav>
    ${rail.length ? `<p class="pm-title">On this page</p><ol class="pm-list">${rail.map((r, i) => `<li><a href="#${r.id}"><span class="rail-num">${num(i)}</span>${esc(r.text)}</a></li>`).join("")}</ol>` : ""}
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-foot">
  <div class="foot-inner">
    <span class="foot-author"><img src="/assets/mohamud.jpg" alt="" width="40" height="40"><span><strong>${esc(AUTHOR.name)}</strong><span>${esc(AUTHOR.line)}</span></span></span>
    <span class="foot-links"><a href="${LINKS.home}">mmohamud.me</a><a href="${LINKS.blog}">Blog</a><a href="${LINKS.linkedin}">LinkedIn</a><a href="${LINKS.blog}/privacy/">Privacy</a></span>
  </div>
</footer>
<script defer src="/assets/lab.js?v=${BUILD_ID}"></script>
<script defer src="/assets/site.js?v=${BUILD_ID}"></script>
</body>
</html>`;
}

// ---------- Home: the catalog ----------
function homePage(labs) {
  const domains = DOMAINS.filter((d) => labs.some((l) => l.domain === d));
  const check = (group, value, label) => `<label class="fcheck"><input type="checkbox" data-group="${group}" value="${esc(value)}"> ${esc(label)}</label>`;
  const row = (l) => `
    <li data-cert="${esc((l.certs || []).join("|"))}" data-level="${esc(l.difficulty)}" data-domain="${esc(l.domain)}" data-text="${esc([l.code, l.title, l.summary, l.domain, ...(l.tools || []), ...(l.attack || []), ...(l.skills || [])].join(" ").toLowerCase())}">
      <a class="lab-row" href="${labUrl(l)}">
        <span class="lab-code">${esc(l.code)}</span>
        <span class="lab-main">
          <span class="lab-title">${esc(l.title)}</span>
          ${l.summary ? `<span class="lab-sum">${esc(l.summary)}</span>` : ""}
          <span class="lab-tags"><span>${esc(l.domain)}</span>${(l.certs || []).length ? `<span>${esc(l.certs.join(" · "))}</span>` : ""}${(l.attack || []).length ? `<span class="mono">${esc(l.attack.join(", "))}</span>` : ""}</span>
        </span>
        <span class="lab-side"><span class="lvl">${bars(l)}${level(l).label}</span>${l.duration_min ? `<span>${esc(duration(l.duration_min).replace("About ", ""))}</span>` : ""}</span>
      </a>
    </li>`;
  const catalog = labs.length ? `
<div class="catalog">
  <aside class="filters" aria-label="Filter labs">
    <label class="fsearch">${icon.search}<span class="sr-only">Search labs</span><input type="search" id="lab-search" placeholder="Search labs, tools…" autocomplete="off"></label>
    <fieldset><legend>Certification</legend>${CERTS.map((c) => check("cert", c, c)).join("")}</fieldset>
    <fieldset><legend>Difficulty</legend>${Object.entries(LEVELS).map(([k, v]) => check("level", k, v.label)).join("")}</fieldset>
    ${domains.length > 1 ? `<fieldset><legend>Domain</legend>${domains.map((d) => check("domain", d, d)).join("")}</fieldset>` : ""}
  </aside>
  <section aria-labelledby="cat-h">
    <div class="cat-head"><h2 id="cat-h"><span id="lab-count">${labs.length}</span> ${labs.length === 1 ? "lab" : "labs"}</h2><button type="button" class="linkish" id="clear-filters" hidden>Clear filters</button></div>
    <ul class="lab-list" id="lab-list">${labs.map(row).join("")}</ul>
    <p class="filter-empty" id="filter-empty" hidden>No labs match those filters.</p>
    ${NOTICE}
  </section>
</div>` : `
<div class="empty-state">
  <h2>The first lab is on its way</h2>
  <p>In the meantime, I write about security and what I'm learning on <a href="${LINKS.blog}">my blog</a>.</p>
</div>`;
  const body = `
<section class="hero">
  <div class="wrap">
    <p class="eyebrow">Hands-on security labs</p>
    <h1>${esc(HEADLINE)}</h1>
    <p class="lede">${esc(INTRO)}</p>
    <ul class="features">
      <li>${icon.check}Mapped to exam objectives</li>
      <li>${icon.shield}MITRE ATT&amp;CK techniques</li>
      <li>${icon.download}Downloadable files, SHA-256 verified</li>
    </ul>
  </div>
</section>
<div class="wrap">${catalog}</div>`;
  return layout({ title: SITE_NAME, description: INTRO, path: "/", body });
}

// ---------- A lab ----------
function labPage(l, { prev, next } = {}) {
  const { html, toc } = renderMarkdown(l.body_md);
  const url = SITE_URL + labUrl(l);
  const related = safeHttps(l.related_post);
  const files = safeHttps(l.files_url) && l.files_sha256 ? `
      <div class="dl">
        <a class="btn-dl" href="${esc(l.files_url)}" download data-goal="lab_download" data-detail="${esc(l.code)}">${icon.download}Download lab files</a>
        <p class="dl-meta">${esc(l.files_name || "Lab files")} · ${fileSize(l.files_size)}</p>
        <p class="sha-label">SHA-256</p>
        <p class="sha"><code>${esc(l.files_sha256)}</code><button type="button" class="copy" data-copy="${esc(l.files_sha256)}">Copy</button></p>
      </div>` : "";
  const row = (dt, dd) => (dd ? `<div><dt>${dt}</dt><dd>${dd}</dd></div>` : "");
  const details = `
    <aside class="details" aria-label="Lab details">
      <section class="card">
        <h2>Lab details</h2>
        <dl>
          ${row("Difficulty", `${bars(l)}${level(l).label}`)}
          ${row("Duration", esc(duration(l.duration_min)))}
          ${row("Certifications", esc((l.certs || []).join(", ")))}
          ${row("Exam objectives", esc(l.objectives))}
          ${row("ATT&amp;CK", (l.attack || []).map((t) => `<a class="mono" href="${attackUrl(t)}" target="_blank" rel="noopener">${esc(t)}</a>`).join(" "))}
          ${(l.tools || []).length ? `<div class="stack"><dt>Tools</dt><dd class="chips">${l.tools.map((t) => `<span>${esc(t)}</span>`).join("")}</dd></div>` : ""}
          ${(l.skills || []).length ? `<div class="stack"><dt>Skills</dt><dd class="chips">${l.skills.map((t) => `<span>${esc(t)}</span>`).join("")}</dd></div>` : ""}
        </dl>
        ${files}
      </section>
      ${related ? `<a class="related" href="${esc(related)}"><span>Read the blog post</span>${icon.download.replace("M12 3v12M7 10l5 5 5-5M5 21h14", "M5 12h14M13 6l6 6-6 6")}</a>` : ""}
    </aside>`;
  const rail = toc.length >= 2 ? `
    <nav class="rail toc" aria-label="On this page">
      <span class="rail-title">On this page</span>
      ${toc.map((t, i) => `<a href="#${t.id}"><span class="rail-num">${num(i)}</span><span class="rail-line" aria-hidden="true"></span><span class="rail-label">${esc(t.text)}</span></a>`).join("")}
    </nav>` : `<span></span>`;
  const neighbour = (o, dir) => (o ? `<a class="pn ${dir}" href="${labUrl(o)}"><span class="pn-dir">${dir === "prev" ? "← Previous lab" : "Next lab →"}</span><span class="pn-title">${esc(o.title)}</span></a>` : "<span></span>");
  const ld = {
    "@context": "https://schema.org", "@type": "TechArticle", headline: l.title, description: l.summary || "",
    datePublished: l.published_at, dateModified: l.updated_at || l.published_at, url, proficiencyLevel: level(l).label,
    author: { "@type": "Person", name: AUTHOR.name, url: LINKS.home },
  };
  const body = `
<div class="lab-grid">
  ${rail}
  <article class="lab">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Labs</a><span aria-hidden="true">/</span><span>${esc(l.domain)}</span><span aria-hidden="true">/</span><span class="mono">${esc(l.code)}</span></nav>
    <h1>${esc(l.title)}</h1>
    ${l.summary ? `<p class="lede">${esc(l.summary)}</p>` : ""}
    <p class="meta"><span>${level(l).label}</span>${l.duration_min ? `<span>${esc(duration(l.duration_min))}</span>` : ""}<span>Updated <time datetime="${esc(l.updated_at || l.published_at)}">${fmtDate(l.updated_at || l.published_at)}</time></span></p>
    ${details.replace('class="details"', 'class="details details-top"')}
    ${NOTICE}
    <div class="prose">${html}</div>
    ${prev || next ? `<nav class="post-nav" aria-label="More labs">${neighbour(prev, "prev")}${neighbour(next, "next")}</nav>` : ""}
  </article>
  ${details}
</div>`;
  return layout({
    title: `${l.code}: ${l.title}`, description: l.summary || INTRO, path: labUrl(l), body, rail: toc, isLab: true,
    extraHead: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
  });
}

function notFoundPage() {
  const body = `<div class="wrap empty-state"><h1>That page doesn't exist</h1><p>It may have moved. <a href="/">See all labs</a>.</p></div>`;
  return layout({ title: "Not found", description: "Page not found", path: "/404.html", body });
}

// ---------- Write ----------
async function write(path, content) {
  const full = join(OUT, path);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, content);
}

const labs = await fetchLabs();
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp("src", join(OUT, "assets"), { recursive: true });
await write("index.html", homePage(labs));
for (const [i, l] of labs.entries()) {
  // newest first: "next" is the newer lab, "previous" the older one
  await write(`labs/${l.slug}/index.html`, labPage(l, { next: labs[i - 1], prev: labs[i + 1] }));
}
await write("404.html", notFoundPage());
await write("labs.json", JSON.stringify(labs.map((l) => ({ code: l.code, title: l.title, summary: l.summary, url: SITE_URL + labUrl(l), certs: l.certs, published_at: l.published_at }))));
await write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE_URL}/</loc></url>
${labs.map((l) => `<url><loc>${SITE_URL}${labUrl(l)}</loc><lastmod>${new Date(l.updated_at || l.published_at).toISOString().slice(0, 10)}</lastmod></url>`).join("\n")}
</urlset>
`);
await write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
await write("CNAME", "lab.mmohamud.me\n");
console.log(`Built ${labs.length} lab${labs.length === 1 ? "" : "s"} into _site/`);
