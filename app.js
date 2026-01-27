const LOGIN_KEY = "cdn_authed";
const DEFAULT_EMAIL = "user@abcdn.vercel.app";
const DEFAULT_PASS = "a123";

const $ = (id) => document.getElementById(id);

const loginView = $("loginView");
const dashView = $("dashView");
const loginForm = $("loginForm");
const loginMsg = $("loginMsg");
const logoutBtn = $("logoutBtn");
const refreshBtn = $("refreshBtn");
const tbody = $("tbody");
const search = $("search");
const count = $("count");
const toast = $("toast");

const kindFilter = $("kindFilter");
const upFolderBtn = $("upFolderBtn");
const currentFolderPill = $("currentFolderPill");

let allItems = [];     // from files.json
let currentFolder = ""; // normalized prefix like "images/" or "" for root

// ---------- Icons (inline SVG, B&W) ----------
const ICONS = {
  file: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
      <path d="M14 2v6h6"/>
    </svg>`,
  folder: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    </svg>`,
  link: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0 0-7.07 5 5 0 0 0-7.07 0L10 5"/>
      <path d="M14 11a5 5 0 0 0-7.07 0L5.52 12.4a5 5 0 0 0 0 7.07 5 5 0 0 0 7.07 0L14 19"/>
    </svg>`,
  download: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3v12"/>
      <path d="M7 10l5 5 5-5"/>
      <path d="M5 21h14"/>
    </svg>`,
  open: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 3h7v7"/>
      <path d="M10 14L21 3"/>
      <path d="M21 14v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/>
    </svg>`
};

function iconHTML(key) {
  return `<span class="ico" aria-hidden="true">${ICONS[key] || ""}</span>`;
}

// ---------- UI helpers ----------
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

// ---------- Path helpers ----------
function cleanPath(p) {
  return String(p || "").replace(/^\/+/, "");
}

function normalizeFolderPath(p) {
  const cp = cleanPath(p);
  if (!cp) return "";
  return cp.endsWith("/") ? cp : (cp + "/");
}

function isFolderItem(item) {
  return item.kind === "folder" || /\/$/.test(cleanPath(item.path));
}

function displayCdnPath(path) {
  return `/cdn/${cleanPath(path)}`;
}

function cdnUrlFor(path) {
  return `${location.origin}/cdn/${cleanPath(path)}`;
}

function downloadPageFor(file) {
  const filePath = cleanPath(file.path);
  const name = file.name || filePath.split("/").pop() || "";
  const type = file.type || "";
  const size = file.size || "";
  return (
    `${location.origin}/download.html` +
    `?file=${encodeURIComponent(filePath)}` +
    `&name=${encodeURIComponent(name)}` +
    `&type=${encodeURIComponent(type)}` +
    `&size=${encodeURIComponent(size)}`
  );
}

// ---------- Folder stats (size + updated) ----------
function parseSizeToBytes(sizeStr) {
  // supports "123 B", "42 KB", "1.2 MB", "3 GB"
  if (!sizeStr) return 0;
  const s = String(sizeStr).trim().toUpperCase();
  const m = s.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)?$/);
  if (!m) return 0;
  const n = Number(m[1]);
  if (!isFinite(n)) return 0;
  const unit = m[2] || "B";
  const mult = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4
  }[unit] || 1;
  return Math.round(n * mult);
}

function bytesToNice(bytes) {
  const b = Number(bytes || 0);
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1).replace(/\.0$/, "")} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1).replace(/\.0$/, "")} GB`;
}

function parseUpdatedToMs(updatedStr) {
  // supports "2026-01-27" or ISO; fallback 0
  if (!updatedStr) return 0;
  const d = new Date(updatedStr);
  const ms = d.getTime();
  return isFinite(ms) ? ms : 0;
}

function formatUpdated(ms) {
  if (!ms) return "—";
  const d = new Date(ms);
  // compact date/time
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

// Build stats for folders by scanning descendant files
function buildFolderStats(items) {
  const files = items
    .filter(x => !isFolderItem(x))
    .map(x => ({
      path: cleanPath(x.path),
      bytes: parseSizeToBytes(x.size),
      updatedMs: parseUpdatedToMs(x.updated)
    }));

  // stats: { "images/": { bytes, updatedMs } }
  const stats = {};

  const folderPaths = items
    .filter(x => isFolderItem(x))
    .map(x => normalizeFolderPath(x.path));

  // ensure folderPaths unique
  const uniqFolders = [...new Set(folderPaths)];

  for (const folder of uniqFolders) {
    let bytes = 0;
    let latest = 0;
    for (const f of files) {
      if (f.path.startsWith(folder)) {
        bytes += f.bytes || 0;
        if ((f.updatedMs || 0) > latest) latest = f.updatedMs || 0;
      }
    }
    stats[folder] = { bytes, latest };
  }

  return stats;
}

let folderStats = {}; // set after load

// ---------- Folder navigation ----------
function updateFolderPill() {
  currentFolderPill.textContent = `Folder: /${currentFolder}`;
}

function goUpFolder() {
  if (!currentFolder) return;
  const parts = currentFolder.split("/").filter(Boolean);
  parts.pop();
  currentFolder = parts.length ? (parts.join("/") + "/") : "";
  updateFolderPill();
  renderList();
}

function openFolder(folderPath) {
  currentFolder = normalizeFolderPath(folderPath);
  updateFolderPill();
  renderList();
}

// Direct child check
function isDirectChildOfCurrent(itemPath, isFolder) {
  const p = cleanPath(itemPath);
  const folder = currentFolder;
  if (!p.startsWith(folder)) return false;

  const rest = p.slice(folder.length);
  if (!rest) return false;

  const restNoTrailing = isFolder ? rest.replace(/\/$/, "") : rest;
  return !restNoTrailing.includes("/");
}

function matchesSearch(item, q) {
  if (!q) return true;
  const hay = `${item.name || ""} ${item.path || ""} ${item.type || ""}`.toLowerCase();
  return hay.includes(q);
}

function sortName(a, b) {
  return (a.name || "").localeCompare(b.name || "");
}

async function copy(text) {
  await navigator.clipboard.writeText(text);
  showToast("Copied to clipboard.");
}

async function loadItems() {
  const r = await fetch("./files.json", { cache: "no-store" });
  const j = await r.json();
  const items = Array.isArray(j.items) ? j.items : (Array.isArray(j.files) ? j.files : []);
  allItems = items;

  folderStats = buildFolderStats(allItems);
  renderList();
  showToast("Refreshed.");
}

function renderViews() {
  const authed = isAuthed();
  loginView.classList.toggle("hidden", authed);
  dashView.classList.toggle("hidden", !authed);
  logoutBtn.classList.toggle("hidden", !authed);

  if (authed) {
    updateFolderPill();
    loadItems();
  }
}

function renderList() {
  const q = (search.value || "").toLowerCase().trim();
  const mode = kindFilter.value || "all";
  const isMobile = window.matchMedia("(max-width: 760px)").matches;

  let files = [];
  let folders = [];

  for (const item of allItems) {
    const folder = isFolderItem(item);
    const path = folder ? normalizeFolderPath(item.path) : cleanPath(item.path);

    if (!isDirectChildOfCurrent(path, folder)) continue;

    if (mode === "files" && folder) continue;
    if (mode === "folders" && !folder) continue;

    if (!matchesSearch(item, q)) continue;

    const normalizedItem = { ...item, path };
    if (folder) folders.push(normalizedItem);
    else files.push(normalizedItem);
  }

  files.sort(sortName);
  folders.sort(sortName);

  tbody.innerHTML = "";

  // ---------- Mobile cards ----------
  if (isMobile) {
    // Files first
    for (const f of files) {
      const cdn = cdnUrlFor(f.path);
      const dl = downloadPageFor(f);
      const displayPath = displayCdnPath(f.path);

      const card = document.createElement("div");
      card.className = "fileCard";

      card.innerHTML = `
        <div class="fileName">
          ${iconHTML("file")}
          <div class="fileNameText truncate" title="${f.name || ""}">${f.name || "(unnamed)"}</div>
        </div>
        <div class="filePath truncate" title="${displayPath}">${displayPath}</div>

        <div class="fileMeta">
          <span class="pill">Type: ${f.type || "—"}</span>
          <span class="pill">Size: ${f.size || "—"}</span>
          <span class="pill">Updated: ${f.updated || "—"}</span>
        </div>

        <div class="actions">
          <button class="btn ghost" type="button">Copy CDN URL</button>
          <button class="btn ghost" type="button">Open</button>
          <button class="btn" type="button">Download</button>
        </div>
      `;

      const btns = card.querySelectorAll("button");
      btns[0].onclick = () => copy(cdn);
      btns[1].onclick = () => window.open(cdn, "_blank", "noopener,noreferrer");
      btns[2].onclick = () => window.open(dl, "_blank", "noopener,noreferrer");

      tbody.appendChild(card);
    }

    // Folders at bottom
    for (const f of folders) {
      const folderPath = normalizeFolderPath(f.path);
      const stat = folderStats[folderPath] || { bytes: 0, latest: 0 };
      const sizeNice = bytesToNice(stat.bytes || 0);
      const updatedNice = formatUpdated(stat.latest || 0);

      const card = document.createElement("div");
      card.className = "fileCard";

      const folderName = f.name || folderPath.replace(/\/$/, "").split("/").pop() || "folder";

      card.innerHTML = `
        <div class="fileName">
          ${iconHTML("folder")}
          <div class="fileNameText truncate" title="${folderName}">${folderName}</div>
        </div>
        <div class="filePath truncate" title="/${folderPath}">/${folderPath}</div>

        <div class="fileMeta">
          <span class="pill">Folder</span>
          <span class="pill">Size: ${sizeNice}</span>
          <span class="pill">Updated: ${updatedNice}</span>
        </div>

        <div class="actions">
          <button class="btn" type="button">Open folder</button>
        </div>
      `;

      card.querySelector("button").onclick = () => openFolder(folderPath);
      tbody.appendChild(card);
    }

    count.textContent = `${files.length} file(s), ${folders.length} folder(s)`;
    return;
  }

  // ---------- Desktop table ----------
  for (const f of files) {
    const cdn = cdnUrlFor(f.path);
    const dl = downloadPageFor(f);
    const displayPath = displayCdnPath(f.path);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="fileName">
          ${iconHTML("file")}
          <div class="fileNameText truncate" title="${f.name || ""}">${f.name || "(unnamed)"}</div>
        </div>
        <div class="filePath truncate" title="${displayPath}">${displayPath}</div>
      </td>
      <td>${f.type || "—"}</td>
      <td>${f.size || "—"}</td>
      <td>${f.updated || "—"}</td>
      <td>
        <div class="actions">
          <button class="btn ghost" type="button">${iconHTML("link")}<span class="truncate">Copy CDN URL</span></button>
          <button class="btn ghost" type="button">${iconHTML("open")}<span class="truncate">Open</span></button>
          <button class="btn" type="button">${iconHTML("download")}<span class="truncate">Download</span></button>
        </div>
      </td>
    `;

    const btns = tr.querySelectorAll("button");
    btns[0].onclick = () => copy(cdn);
    btns[1].onclick = () => window.open(cdn, "_blank", "noopener,noreferrer");
    btns[2].onclick = () => window.open(dl, "_blank", "noopener,noreferrer");

    tbody.appendChild(tr);
  }

  for (const f of folders) {
    const folderPath = normalizeFolderPath(f.path);
    const stat = folderStats[folderPath] || { bytes: 0, latest: 0 };
    const sizeNice = bytesToNice(stat.bytes || 0);
    const updatedNice = formatUpdated(stat.latest || 0);

    const folderName = f.name || folderPath.replace(/\/$/, "").split("/").pop() || "folder";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="fileName">
          ${iconHTML("folder")}
          <div class="fileNameText truncate" title="${folderName}">${folderName}</div>
        </div>
        <div class="filePath truncate" title="/${folderPath}">/${folderPath}</div>
      </td>
      <td>Folder</td>
      <td>${sizeNice}</td>
      <td>${updatedNice}</td>
      <td>
        <div class="actions">
          <button class="btn" type="button">${iconHTML("open")}<span class="truncate">Open folder</span></button>
        </div>
      </td>
    `;

    tr.querySelector("button").onclick = () => openFolder(folderPath);
    tbody.appendChild(tr);
  }

  count.textContent = `${files.length} file(s), ${folders.length} folder(s)`;
}

// ---------- Events ----------
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  loginMsg.textContent = "";
  const em = ($("email").value || "").trim();
  const pw = ($("password").value || "").trim();
  if (em === DEFAULT_EMAIL && pw === DEFAULT_PASS) setAuthed(true);
  else loginMsg.textContent = "Invalid login (edit DEFAULT_EMAIL / DEFAULT_PASS in app.js).";
});

logoutBtn.addEventListener("click", () => setAuthed(false));
refreshBtn.addEventListener("click", loadItems);
search.addEventListener("input", renderList);
kindFilter.addEventListener("change", renderList);
upFolderBtn.addEventListener("click", () => {
  goUpFolder();
  showToast("Moved up a folder.");
});
window.addEventListener("resize", renderList);

// boot
updateFolderPill();
renderViews();
