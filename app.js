const LOGIN_KEY = "cdn_authed";
const LINKS_KEY = "cdn_links";
const FILE_SLUG_KEY = "cdn_file_slugs";

const DEFAULT_EMAIL = "user@abcdn.vercel.app";
const DEFAULT_PASS = "Aidan123";

const $ = (id) => document.getElementById(id);

const loginView = $("loginView");
const dashView = $("dashView");
const loginForm = $("loginForm");
const loginMsg = $("loginMsg");
const logoutBtn = $("logoutBtn");
const refreshBtn = $("refreshBtn");
const tbody = $("tbody");
const search = $("search");
const baseUrl = $("baseUrl");
const count = $("count");
const toast = $("toast");

let allFiles = [];

function showToast(text) {
  toast.textContent = text;
  toast.classList.remove("hidden");
  toast.style.animation = "none";
  toast.offsetHeight;
  toast.style.animation = "";

  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), 2400);
}

function setAuthed(v) {
  localStorage.setItem(LOGIN_KEY, v ? "1" : "0");
  renderViews();
}

function isAuthed() {
  return localStorage.getItem(LOGIN_KEY) === "1";
}

function safeJSONGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function safeJSONSet(key, obj) {
  localStorage.setItem(key, JSON.stringify(obj));
}

function makeSlug() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function resolveUrl(filePath) {
  try {
    const u = new URL(filePath);
    return u.toString();
  } catch {}

  const base = (baseUrl.value || "").trim();
  if (!base) return filePath;

  const slash = base.endsWith("/") ? "" : "/";
  return base + slash + filePath.replace(/^\//, "");
}

function getCdnBase() {
  const basePath = location.pathname.replace(/\/index\.html?$/, "/");
  return `${location.origin}${basePath}cdn.html#`;
}

function makeCdnLink(slug) {
  return `${getCdnBase()}${slug}`;
}

async function copy(text) {
  await navigator.clipboard.writeText(text);
  showToast("Copied to clipboard.");
}

async function loadFiles() {
  const r = await fetch("./files.json", { cache: "no-store" });
  const j = await r.json();
  allFiles = Array.isArray(j.files) ? j.files : [];
  renderTable();
  showToast("Refreshed.");
}

function renderViews() {
  const authed = isAuthed();
  loginView.classList.toggle("hidden", authed);
  dashView.classList.toggle("hidden", !authed);
  logoutBtn.classList.toggle("hidden", !authed);

  if (authed) loadFiles();
}

function fileKey(f) {
  return (f.path || f.name || "").trim();
}

function ensureSlugForFile(f, directUrl) {
  const fileSlugs = safeJSONGet(FILE_SLUG_KEY, {});
  const links = safeJSONGet(LINKS_KEY, {});
  const key = fileKey(f);
  if (!key) return null;

  const existing = fileSlugs[key];
  if (existing && links[existing]) return existing;

  let slug = makeSlug();
  while (links[slug]) slug = makeSlug();

  links[slug] = directUrl;
  fileSlugs[key] = slug;

  safeJSONSet(LINKS_KEY, links);
  safeJSONSet(FILE_SLUG_KEY, fileSlugs);

  return slug;
}

function getSlugForFile(f) {
  const key = fileKey(f);
  if (!key) return null;

  const fileSlugs = safeJSONGet(FILE_SLUG_KEY, {});
  const links = safeJSONGet(LINKS_KEY, {});
  const slug = fileSlugs[key];
  if (slug && links[slug]) return slug;
  return null;
}

function renderTable() {
  const q = (search.value || "").toLowerCase().trim();
  const filtered = allFiles.filter(f => {
    const hay = `${f.name||""} ${f.path||""} ${f.type||""}`.toLowerCase();
    return hay.includes(q);
  });

  tbody.innerHTML = "";

  const isMobile = window.matchMedia("(max-width: 760px)").matches;

  filtered.forEach((f) => {
    const directUrl = resolveUrl(f.path || "");
    const slug = getSlugForFile(f);
    const cdnUrl = slug ? makeCdnLink(slug) : null;

    if (isMobile) {
      const card = document.createElement("div");
      card.className = "fileCard";

      const title = document.createElement("div");
      title.className = "fileName";
      title.textContent = f.name || "(unnamed)";

      const sub = document.createElement("div");
      sub.className = "filePath";
      sub.textContent = f.path || "";

      const meta = document.createElement("div");
      meta.className = "fileMeta";
      meta.innerHTML = `
        <span class="pill">Type: ${f.type || "—"}</span>
        <span class="pill">Size: ${f.size || "—"}</span>
        <span class="pill">Updated: ${f.updated || "—"}</span>
        <span class="pill">CDN: ${slug ? slug : "—"}</span>
      `;

      const actions = document.createElement("div");
      actions.className = "actions";

      const btnCopy = document.createElement("button");
      btnCopy.className = "btn ghost";
      btnCopy.textContent = slug ? "Copy CDN URL" : "Copy Direct URL";
      btnCopy.onclick = () => copy(slug ? cdnUrl : directUrl);

      const btnOpen = document.createElement("button");
      btnOpen.className = "btn ghost";
      btnOpen.textContent = "Open (Direct)";
      btnOpen.onclick = () => window.open(directUrl, "_blank", "noopener,noreferrer");

      const btnCdn = document.createElement("button");
      btnCdn.className = "btn";
      btnCdn.textContent = slug ? "Re-copy /cdn link" : "Make /cdn link";
      btnCdn.onclick = async () => {
        const s = ensureSlugForFile(f, directUrl);
        const link = makeCdnLink(s);
        await copy(link);
        showToast(`CDN link ready: ${s}`);
        renderTable();
      };

      actions.appendChild(btnCopy);
      actions.appendChild(btnOpen);
      actions.appendChild(btnCdn);

      card.appendChild(title);
      card.appendChild(sub);
      card.appendChild(meta);
      card.appendChild(actions);

      tbody.appendChild(card);
      return;
    }

    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    const nm = document.createElement("div");
    nm.className = "fileName";
    nm.textContent = f.name || "(unnamed)";
    const path = document.createElement("div");
    path.className = "filePath";
    path.textContent = f.path || "";
    nameTd.appendChild(nm);
    nameTd.appendChild(path);

    const typeTd = document.createElement("td");
    typeTd.textContent = f.type || "—";

    const sizeTd = document.createElement("td");
    sizeTd.textContent = f.size || "—";

    const updTd = document.createElement("td");
    updTd.textContent = f.updated || "—";

    const actTd = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "actions";

    const btnCopy = document.createElement("button");
    btnCopy.className = "btn ghost";
    btnCopy.textContent = slug ? "Copy CDN URL" : "Copy Direct URL";
    btnCopy.onclick = () => copy(slug ? cdnUrl : directUrl);

    const btnOpen = document.createElement("button");
    btnOpen.className = "btn ghost";
    btnOpen.textContent = "Open (Direct)";
    btnOpen.onclick = () => window.open(directUrl, "_blank", "noopener,noreferrer");

    const btnCdn = document.createElement("button");
    btnCdn.className = "btn";
    btnCdn.textContent = slug ? "Re-copy /cdn link" : "Make /cdn link";
    btnCdn.onclick = async () => {
      const s = ensureSlugForFile(f, directUrl);
      const link = makeCdnLink(s);
      await copy(link);
      showToast(`CDN link ready: ${s}`);
      renderTable();
    };

    actions.appendChild(btnCopy);
    actions.appendChild(btnOpen);
    actions.appendChild(btnCdn);
    actTd.appendChild(actions);

    tr.appendChild(nameTd);
    tr.appendChild(typeTd);
    tr.appendChild(sizeTd);
    tr.appendChild(updTd);
    tr.appendChild(actTd);

    tbody.appendChild(tr);
  });

  count.textContent = `${filtered.length} file(s)`;
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  loginMsg.textContent = "";

  const em = ($("email").value || "").trim();
  const pw = ($("password").value || "").trim();

  if (em === DEFAULT_EMAIL && pw === DEFAULT_PASS) {
    setAuthed(true);
  } else {
    loginMsg.textContent = "Invalid login (edit DEFAULT_EMAIL / DEFAULT_PASS in app.js).";
  }
});

logoutBtn.addEventListener("click", () => setAuthed(false));
refreshBtn.addEventListener("click", loadFiles);
search.addEventListener("input", renderTable);
baseUrl.addEventListener("input", renderTable);
window.addEventListener("resize", renderTable);

renderViews();
