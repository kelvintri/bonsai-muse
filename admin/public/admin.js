// D'Uma admin UI
const $ = (s) => document.querySelector(s);
const state = { kind: "trees", images: [], editing: null };

const SCHEMAS = {
  trees: [
    { k: "name", label: "Name", type: "text", req: 1 },
    { k: "latin", label: "Latin name", type: "text", req: 1 },
    { k: "origin", label: "Origin", type: "text" },
    { k: "size", label: "Size", type: "select", opts: ["Shito","Mame","Shohin","Medium","Large","XL"] },
    { k: "style", label: "Style", type: "select", opts: ["Informal Upright","Cascade","Semi-Cascade","Twin Trunk","Bunjin","On The Rock","Clump","Broom","Natural Style"] },
    { k: "status", label: "Status", type: "select", opts: ["Available","Reserved","Sold","Exported"] },
    { k: "image", label: "Image", type: "image" },
  ],
  journal: [
    { k: "title", label: "Title", type: "text", req: 1 },
    { k: "description", label: "Description", type: "text", req: 1 },
    { k: "date", label: "Date", type: "date", req: 1 },
    { k: "image", label: "Image", type: "image" },
    { k: "imageAlt", label: "Image alt text", type: "text" },
  ],
};
const BODY_LABEL = { trees: "Story (markdown)", journal: "Article body (markdown)" };

async function api(method, path, body) {
  const r = await fetch(path, {
    method, headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `request failed (${r.status})`);
  return d;
}

async function boot() {
  try {
    const me = await api("GET", "/api/me");
    $("#whoami").textContent = me.user;
    $("#loginView").classList.add("hidden");
    $("#appView").classList.remove("hidden");
    state.images = await api("GET", "/api/images");
    loadList();
  } catch {
    $("#loginView").classList.remove("hidden");
  }
}

$("#loginBtn").onclick = async () => {
  $("#loginErr").textContent = "";
  try {
    await api("POST", "/api/login", { user: $("#loginUser").value, password: $("#loginPass").value });
    boot();
  } catch (e) { $("#loginErr").textContent = "Login failed — check username/password."; }
};
$("#loginPass").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#loginBtn").click(); });
$("#logoutBtn").onclick = async () => { await api("POST", "/api/logout"); location.reload(); };

document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
  t.classList.add("active");
  state.kind = t.dataset.kind;
  showList();
}));

function showList() { $("#listView").classList.remove("hidden"); $("#editView").classList.add("hidden"); loadList(); }
$("#backBtn").onclick = showList;

async function loadList() {
  const kind = state.kind;
  $("#listTitle").textContent = kind === "trees" ? "Collection" : "Journal";
  const slugs = await api("GET", `/api/${kind}`);
  const list = $("#itemList");
  list.innerHTML = "";
  for (const slug of slugs) {
    const item = await api("GET", `/api/${kind}/${slug}`);
    const title = kind === "trees" ? `${item.data.name} <span class="meta">— ${item.data.latin || ""} · ${item.data.status || ""}</span>`
                                   : `${item.data.title} <span class="meta">— ${item.data.date || ""}</span>`;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<div>${title}</div><div class="row" style="gap:.5rem">
      <button class="btn small">Edit</button>
      <button class="btn small danger">Delete</button></div>`;
    div.querySelector(".btn:not(.danger)").onclick = () => editItem(slug);
    div.querySelector(".danger").onclick = async () => {
      if (!confirm(`Delete "${slug}"?`)) return;
      await api("DELETE", `/api/${kind}/${slug}`);
      loadList();
      flash("Deleted & deployed.");
    };
    list.appendChild(div);
  }
  if (!slugs.length) list.innerHTML = `<p class="hint">Nothing here yet.</p>`;
}

$("#newBtn").onclick = () => editItem(null);

function fieldHtml(f, val) {
  const v = val ?? "";
  if (f.type === "select")
    return `<select data-k="${f.k}">${f.opts.map((o) => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select>`;
  if (f.type === "image")
    return `<select data-k="${f.k}">${["", ...state.images].map((o) => `<option value="${o}" ${o === v ? "selected" : ""}>${o || "— none —"}</option>`).join("")}</select>
      <div style="margin-top:.6rem"><label class="hint">or upload new (webp/png/jpg, max 8MB):</label>
      <input type="file" data-upload accept=".webp,.png,.jpg,.jpeg" style="margin-top:.3rem"/></div>
      ${v ? `<img class="img-preview" id="imgPrev" alt="preview"/>` : ""}`;
  if (f.type === "date") return `<input type="date" data-k="${f.k}" value="${v}" />`;
  return `<input data-k="${f.k}" value="${String(v).replace(/"/g, "&quot;")}" ${f.req ? "required" : ""} />`;
}

async function editItem(slug) {
  state.editing = slug;
  $("#listView").classList.add("hidden");
  $("#editView").classList.remove("hidden");
  const kind = state.kind;
  const item = slug ? await api("GET", `/api/${kind}/${slug}`) : { data: {}, body: "" };
  const schema = SCHEMAS[kind];
  $("#editForm").innerHTML = `
    <h2 style="margin-top:0">${slug ? "Edit" : "New"} ${kind === "trees" ? "tree" : "article"}</h2>
    ${slug ? "" : `<div class="field"><label>Slug (url-name, lowercase-dashes)</label><input id="newSlug" placeholder="e.g. santigi-kecil" /></div>`}
    ${schema.map((f) => `<div class="field"><label>${f.label}${f.req ? " *" : ""}</label>${fieldHtml(f, item.data[f.k])}</div>`).join("")}
    <div class="field"><label>${BODY_LABEL[kind]}</label><textarea class="tall" id="f_body">${item.body.replace(/</g, "&lt;")}</textarea></div>
    <div class="row"><button class="btn primary" id="saveBtn">Save & deploy</button><span class="hint">Saving commits to GitHub and redeploys the site (~1–2 min).</span></div>`;
  $("#saveBtn").onclick = saveItem;
  const up = $("#editForm").querySelector("[data-upload]");
  if (up) up.onchange = () => {
    const file = up.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = String(reader.result).split(",")[1];
      const name = file.name.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
      const r = await api("POST", "/api/upload", { name, content: b64 });
      state.images.push(r.key);
      const sel = $("#editForm").querySelector('[data-k="image"]');
      sel.innerHTML = ["", ...state.images].map((o) => `<option value="${o}" ${o === r.key ? "selected" : ""}>${o || "— none —"}</option>`).join("");
      flash("Image uploaded.");
    };
    reader.readAsDataURL(file);
  };
}

async function saveItem() {
  const kind = state.kind;
  const data = {};
  $("#editForm").querySelectorAll("[data-k]").forEach((el) => { data[el.dataset.k] = el.value; });
  const body = $("#f_body").value;
  $("#saveMsg").textContent = "Saving & deploying…";
  try {
    if (state.editing) {
      await api("PUT", `/api/${kind}/${state.editing}`, { data, body });
    } else {
      const slug = $("#newSlug").value.trim();
      if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("invalid slug");
      await api("POST", `/api/${kind}`, { slug, data, body });
    }
    flash("Saved & deployed.");
    showList();
  } catch (e) { $("#saveMsg").textContent = ""; alert("Save failed: " + e.message); }
}

function flash(msg) { const el = $("#saveMsg"); el.textContent = msg; setTimeout(() => (el.textContent = ""), 5000); }

boot();
