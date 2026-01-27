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

let allFiles = [];

function showToast(text) {
  toast.textContent = text;
  toast.classList.remove("hidden");
  toast.style.animation = "none";
  // force reflow to restart animation
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

function cleanPath(p) {
  return String(p || "").replace(/^\/+/, "");
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

async function copy(text) {
  await navigator.clipboard.writeText(text);
  showToast("Copied to clipboard.");
}

async function loadFiles() {
  const r = await fetch("./files.json", { cache: "no-store" });
  const j = await r.json();
  allFiles = Array.isArray(j.files) ? j.files : [];
  renderList();
  showToast("Refreshed.");
}

function renderViews() {
  const authed = isAuthed();
  loginView.classList.toggle("hidden", authed);
  dashView.classList.toggle("hidden", !authed);
  logoutBtn.classList.toggle("hidden", !authed);

  if (authed) loadFiles();
}

function renderList() {
  const q = (search.value || "").toLowerCase().trim();
  const filtered = allFiles.filter((f) => {
    const hay = `${f.name || ""} ${f.path || ""} ${f.type || ""}`.toLowerCase();
    return hay.includes(q);
  });

  tbody.innerHTML = "";
  const isMobile = window.matchMedia("(max-width: 760px)").matches;

  filtered.forEach((f) => {
    const cdn = cdnUrlFor(f.path);
    const dl = downloadPageFor(f);
    const displayPath = `/cdn/${cleanPath(f.path)}`;

    if (isMobile) {
      const card = document.createElement("div");
      card.className = "fileCard";

      const title = document.createElement("div");
      title.className = "fileName";
      title.textContent = f.name || "(unnamed)";

      const sub = document.createElement("div");
      sub.className = "filePath";
      sub.textContent = displayPath;

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
      btnOpen.textContent = "Open (CDN)";
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
      return;
    }

    // Desktop table row
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    const nm = document.createElement("div");
    nm.className = "fileName";
    nm.textContent = f.name || "(unnamed)";
    const path = document.createElement("div");
    path.className = "filePath";
    path.textContent = displayPath;
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
    btnOpen.textContent = "Open (CDN)";
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
  });

  count.textContent = `${filtered.length} file(s)`;
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
refreshBtn.addEventListener("click", loadFiles);
search.addEventListener("input", renderList);
window.addEventListener("resize", renderList);

// boot
renderViews();
