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

// New UI bits
const kindFilter = $("kindFilter");
const upFolderBtn = $("upFolderBtn");
const currentFolderPill = $("currentFolderPill");

let allItems = [];            // from files.json (files + folders)
let currentFolder = "";       // prefix like "images/" or "" for root

function showToast(text) {
  toast.textContent = text;
  toast.classList.remove("hidden");
  toast.style.animation = "none";
  toast.offsetHeight; // restart animation
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

function cleanPath(p) {
  return String(p || "").replace(/^\/+/, "");
}

function isFolderItem(item) {
  // folder if explicitly marked OR path ends with /
  return item.kind === "folder" || /\/$/.test(cleanPath(item.path));
}

function normalizeFolderPath(p) {
  const cp = cleanPath(p);
  if (!cp) return "";
  return cp.endsWith("/") ? cp : (cp + "/");
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

function displayCdnPath(path) {
  return `/cdn/${cleanPath(path)}`;
}

function updateFolderPill() {
  currentFolderPill.textContent = `Folder: /${currentFolder}`;
}

function folderDepth(folder) {
  if (!folder) return 0;
  return folder.split("/").filter(Boolean).length;
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

async function copy(text) {
  await navigator.clipboard.writeText(text);
  showToast("Copied to clipboard.");
}

async function loadItems() {
  const r = await fetch("./files.json", { cache: "no-store" });
  const j = await r.json();

  // Support both { files: [] } and { items: [] }
  const items = Array.isArray(j.items) ? j.items : (Array.isArray(j.files) ? j.files : []);
  allItems = items;

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

// Determines if an item is inside currentFolder (direct child, not deep)
function isDirectChildOfCurrent(itemPath, isFolder) {
  const p = cleanPath(itemPath);
  const folder = currentFolder; // already normalized
  if (!p.startsWith(folder)) return false;

  const rest = p.slice(folder.length); // path after folder prefix
  if (!rest) return false;

  // For folders like "images/" inside root -> rest would be "images/"
  // We only want direct children: no extra "/" in rest (except trailing slash)
  const restNoTrailing = isFolder ? rest.replace(/\/$/, "") : rest;
  return !restNoTrailing.includes("/");
}

function sortFilesThenFolders(files, folders) {
  // folders must be at bottom, so return files then folders
  const nameSort = (a, b) => (a.name || "").localeCompare(b.name || "");
  files.sort(nameSort);
  folders.sort(nameSort);
  return { files, folders };
}

function matchesSearch(item, q) {
  if (!q) return true;
  const hay = `${item.name || ""} ${item.path || ""} ${item.type || ""}`.toLowerCase();
  return hay.includes(q);
}

function renderList() {
  const q = (search.value || "").toLowerCase().trim();
  const mode = kindFilter.value || "all";
  const isMobile = window.matchMedia("(max-width: 760px)").matches;

  // Split into direct children of current folder
  let files = [];
  let folders = [];

  for (const item of allItems) {
    const folder = isFolderItem(item);
    const path = folder ? normalizeFolderPath(item.path) : cleanPath(item.path);

    // must be direct child of current folder
    if (!isDirectChildOfCurrent(path, folder)) continue;

    // folder/files filter
    if (mode === "files" && folder) continue;
    if (mode === "folders" && !folder) continue;

    // search filter
    if (!matchesSearch(item, q)) continue;

    const normalizedItem = { ...item, path };

    if (folder) folders.push(normalizedItem);
    else files.push(normalizedItem);
  }

  ({ files, folders } = sortFilesThenFolders(files, folders));

  // Clear output
  tbody.innerHTML = "";

  // MOBILE (cards)
  if (isMobile) {
    // Render files first
    for (const f of files) {
      const cdn = cdnUrlFor(f.path);
      const dl = downloadPageFor(f);

      const card = document.createElement("div");
      card.className = "fileCard";

      const title = document.createElement("div");
      title.className = "fileName";
      title.textContent = `📄 ${f.name || "(unnamed)"}`;

      const sub = document.createElement("div");
      sub.className = "filePath";
      sub.textContent = displayCdnPath(f.path);

      const meta = document.createElement("div");
      meta.className = "fileMeta";
      meta.innerHTML = `
        <span class="pill">Type: ${f.type || "—"}</span>
        <span class="pill">Size: ${f.size || "—"}</span>
        <span class="pill">Updated: ${f.updated || "—"}</span>
      `;

      const actions = document.createElement("div");
      actions.className = "actions";

      const btnCopy = document.createElement("button");
      btnCopy.className = "btn ghost";
      btnCopy.textContent = "Copy CDN URL";
      btnCopy.onclick = () => copy(cdn);

      const btnOpen = document.createElement("button");
      btnOpen.className = "btn ghost";
      btnOpen.textContent = "Open";
      btnOpen.onclick = () => window.open(cdn, "_blank", "noopener,noreferrer");

      const btnDl = document.createElement("button");
      btnDl.className = "btn";
      btnDl.textContent = "Download";
      btnDl.onclick = () => window.open(dl, "_blank", "noopener,noreferrer");

      actions.appendChild(btnCopy);
      actions.appendChild(btnOpen);
      actions.appendChild(btnDl);

      card.appendChild(title);
      card.appendChild(sub);
      card.appendChild(meta);
      card.appendChild(actions);
      tbody.appendChild(card);
    }

    // Render folders at bottom
    for (const f of folders) {
      const folderPath = normalizeFolderPath(f.path);

      const card = document.createElement("div");
      card.className = "fileCard";

      const title = document.createElement("div");
      title.className = "fileName";
      title.textContent = `📁 ${f.name || folderPath.replace(/\/$/, "").split("/").pop() || "folder"}`;

      const sub = document.createElement("div");
      sub.className = "filePath";
      sub.textContent = `/${folderPath}`;

      const meta = document.createElement("div");
      meta.className = "fileMeta";
      meta.innerHTML = `
        <span class="pill">Folder</span>
        <span class="pill">Depth: ${folderDepth(folderPath)}</span>
      `;

      const actions = document.createElement("div");
      actions.className = "actions";

      const btnOpenFolder = document.createElement("button");
      btnOpenFolder.className = "btn";
      btnOpenFolder.textContent = "Open folder";
      btnOpenFolder.onclick = () => openFolder(folderPath);

      actions.appendChild(btnOpenFolder);

      card.appendChild(title);
      card.appendChild(sub);
      card.appendChild(meta);
      card.appendChild(actions);
      tbody.appendChild(card);
    }

    count.textContent = `${files.length} file(s), ${folders.length} folder(s)`;
    return;
  }

  // DESKTOP (table rows)
  // Files first
  for (const f of files) {
    const cdn = cdnUrlFor(f.path);
    const dl = downloadPageFor(f);

    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    const nm = document.createElement("div");
    nm.className = "fileName";
    nm.textContent = `📄 ${f.name || "(unnamed)"}`;
    const path = document.createElement("div");
    path.className = "filePath";
    path.textContent = displayCdnPath(f.path);
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
    btnCopy.textContent = "Copy CDN URL";
    btnCopy.onclick = () => copy(cdn);

    const btnOpen = document.createElement("button");
    btnOpen.className = "btn ghost";
    btnOpen.textContent = "Open";
    btnOpen.onclick = () => window.open(cdn, "_blank", "noopener,noreferrer");

    const btnDl = document.createElement("button");
    btnDl.className = "btn";
    btnDl.textContent = "Download";
    btnDl.onclick = () => window.open(dl, "_blank", "noopener,noreferrer");

    actions.appendChild(btnCopy);
    actions.appendChild(btnOpen);
    actions.appendChild(btnDl);
    actTd.appendChild(actions);

    tr.appendChild(nameTd);
    tr.appendChild(typeTd);
    tr.appendChild(sizeTd);
    tr.appendChild(updTd);
    tr.appendChild(actTd);

    tbody.appendChild(tr);
  }

  // Folders at bottom
  for (const f of folders) {
    const folderPath = normalizeFolderPath(f.path);

    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    const nm = document.createElement("div");
    nm.className = "fileName";
    nm.textContent = `📁 ${f.name || folderPath.replace(/\/$/, "").split("/").pop() || "folder"}`;
    const path = document.createElement("div");
    path.className = "filePath";
    path.textContent = `/${folderPath}`;
    nameTd.appendChild(nm);
    nameTd.appendChild(path);

    const typeTd = document.createElement("td");
    typeTd.textContent = "Folder";

    const sizeTd = document.createElement("td");
    sizeTd.textContent = "—";

    const updTd = document.createElement("td");
    updTd.textContent = "—";

    const actTd = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "actions";

    const btnOpenFolder = document.createElement("button");
    btnOpenFolder.className = "btn";
    btnOpenFolder.textContent = "Open folder";
    btnOpenFolder.onclick = () => openFolder(folderPath);

    actions.appendChild(btnOpenFolder);
    actTd.appendChild(actions);

    tr.appendChild(nameTd);
    tr.appendChild(typeTd);
    tr.appendChild(sizeTd);
    tr.appendChild(updTd);
    tr.appendChild(actTd);

    tbody.appendChild(tr);
  }

  count.textContent = `${files.length} file(s), ${folders.length} folder(s)`;
}

// events
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
