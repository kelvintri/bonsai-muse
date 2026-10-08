// Bonsai D'Uma admin backend — simple username/password CMS.
// Content lives in GitHub (git = database). Every save commits + triggers a Dokploy redeploy.
//
// Env: ADMIN_USER, ADMIN_PASSWORD, SESSION_SECRET,
//      GITHUB_TOKEN, GITHUB_REPO (owner/repo), GITHUB_BRANCH,
//      DOKPLOY_URL, DOKPLOY_API_KEY, DOKPLOY_APP_ID, PORT
import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "25mb" }));

const CFG = {
  user: process.env.ADMIN_USER || "admin",
  pass: process.env.ADMIN_PASSWORD || "",
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  ghToken: process.env.GITHUB_TOKEN || "",
  ghRepo: process.env.GITHUB_REPO || "kelvintri/bonsai-muse",
  ghBranch: process.env.GITHUB_BRANCH || "main",
  dokployUrl: (process.env.DOKPLOY_URL || "https://panel.vintri.my.id").replace(/\/$/, ""),
  dokployKey: process.env.DOKPLOY_API_KEY || "",
  dokployApp: process.env.DOKPLOY_APP_ID || "",
  port: Number(process.env.PORT || 3001),
};

if (!CFG.pass) console.warn("[admin] WARNING: ADMIN_PASSWORD not set — login disabled until configured.");
if (!CFG.ghToken) console.warn("[admin] WARNING: GITHUB_TOKEN not set — saving disabled until configured.");

// ---------- auth: HMAC-signed cookie, no server-side session store ----------
const COOKIE = "duma_admin";
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", CFG.secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verify(token) {
  try {
    const [body, sig] = String(token).split(".");
    const expect = crypto.createHmac("sha256", CFG.secret).update(body).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (p.exp < Date.now()) return null;
    return p;
  } catch { return null; }
}
function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function requireAuth(req, res, next) {
  const sess = verify(parseCookies(req)[COOKIE]);
  if (!sess) return res.status(401).json({ error: "unauthorized" });
  req.session = sess;
  next();
}
function safeEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

app.post("/api/login", (req, res) => {
  const { user, password } = req.body || {};
  if (!CFG.pass) return res.status(503).json({ error: "admin not configured" });
  if (safeEqual(user, CFG.user) && safeEqual(password, CFG.pass)) {
    const token = sign({ user: CFG.user, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 });
    res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`);
    return res.json({ ok: true });
  }
  // constant-time-ish failure
  crypto.timingSafeEqual(crypto.randomBytes(16), crypto.randomBytes(16));
  res.status(401).json({ error: "invalid credentials" });
});
app.post("/api/logout", (req, res) => {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Path=/; Max-Age=0`);
  res.json({ ok: true });
});
app.get("/api/me", requireAuth, (req, res) => res.json({ user: req.session.user }));

// ---------- GitHub content layer ----------
async function gh(method, path, body) {
  const r = await fetch(`https://api.github.com/repos/${CFG.ghRepo}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${CFG.ghToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "duma-admin",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`GitHub ${method} ${path}: ${r.status} ${data.message || ""}`);
  return data;
}
function parseMd(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
  return { data, body: m[2].trim() };
}
function buildMd(data, body) {
  const fm = Object.entries(data).map(([k, v]) => `${k}: "${String(v).replace(/"/g, "'")}"`).join("\n");
  return `---\n${fm}\n---\n\n${body.trim()}\n`;
}
async function listDir(dir) {
  const items = await gh("GET", `/contents/${dir}?ref=${CFG.ghBranch}`);
  return items.filter((i) => i.type === "file" && i.name.endsWith(".md"))
    .map((i) => i.name.replace(/\.md$/, ""));
}
async function readFile(repoPath) {
  const f = await gh("GET", `/contents/${repoPath}?ref=${CFG.ghBranch}`);
  const { data, body } = parseMd(Buffer.from(f.content, "base64").toString("utf8"));
  return { slug: f.name.replace(/\.md$/, ""), sha: f.sha, data, body };
}
async function writeFile(repoPath, data, body, message) {
  let sha;
  try {
    const f = await gh("GET", `/contents/${repoPath}?ref=${CFG.ghBranch}`);
    sha = f.sha;
  } catch { /* new file */ }
  const content = Buffer.from(buildMd(data, body)).toString("base64");
  await gh("PUT", `/contents/${repoPath}`, {
    message, content, sha, branch: CFG.ghBranch,
  });
}
async function deleteFile(repoPath, message) {
  const f = await gh("GET", `/contents/${repoPath}?ref=${CFG.ghBranch}`);
  await gh("DELETE", `/contents/${repoPath}`, { message, sha: f.sha, branch: CFG.ghBranch });
}
async function triggerDeploy() {
  if (!CFG.dokployKey || !CFG.dokployApp) {
    console.warn("[admin] deploy skipped: DOKPLOY_API_KEY/APP_ID not set");
    return;
  }
  const r = await fetch(`${CFG.dokployUrl}/api/application.deploy`, {
    method: "POST",
    headers: { "x-api-key": CFG.dokployKey, "Content-Type": "application/json", "User-Agent": "duma-admin" },
    body: JSON.stringify({ applicationId: CFG.dokployApp, title: "Content update from admin" }),
  });
  if (!r.ok) throw new Error(`Dokploy deploy failed: ${r.status}`);
}

// ---------- content API ----------
const KINDS = { trees: "src/content/trees", journal: "src/content/journal" };
for (const [kind, dir] of Object.entries(KINDS)) {
  app.get(`/api/${kind}`, requireAuth, async (req, res) => {
    try { res.json(await listDir(dir)); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  app.get(`/api/${kind}/:slug`, requireAuth, async (req, res) => {
    try { res.json(await readFile(`${dir}/${req.params.slug}.md`)); }
    catch (e) { res.status(404).json({ error: "not found" }); }
  });
  app.put(`/api/${kind}/:slug`, requireAuth, async (req, res) => {
    try {
      const { data, body } = req.body || {};
      await writeFile(`${dir}/${req.params.slug}.md`, data || {}, body || "", `admin: update ${kind}/${req.params.slug}`);
      await triggerDeploy();
      res.json({ ok: true, deployed: true });
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  app.post(`/api/${kind}`, requireAuth, async (req, res) => {
    try {
      const { slug, data, body } = req.body || {};
      if (!slug || !/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: "invalid slug" });
      await writeFile(`${dir}/${slug}.md`, data || {}, body || "", `admin: create ${kind}/${slug}`);
      await triggerDeploy();
      res.json({ ok: true, slug });
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
  app.delete(`/api/${kind}/:slug`, requireAuth, async (req, res) => {
    try {
      await deleteFile(`${dir}/${req.params.slug}.md`, `admin: delete ${kind}/${req.params.slug}`);
      await triggerDeploy();
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
  });
}

// image upload -> src/assets/
app.post("/api/upload", requireAuth, async (req, res) => {
  try {
    const { name, content } = req.body || {}; // content: base64 webp/png/jpg
    if (!name || !/^[a-z0-9-]+\.(webp|png|jpg|jpeg)$/.test(name) || !content)
      return res.status(400).json({ error: "invalid upload" });
    const buf = Buffer.from(content, "base64");
    if (buf.length > 8 * 1024 * 1024) return res.status(400).json({ error: "file too large (8MB max)" });
    let sha;
    try {
      const f = await gh("GET", `/contents/src/assets/${name}?ref=${CFG.ghBranch}`);
      sha = f.sha;
    } catch { /* new */ }
    await gh("PUT", `/contents/src/assets/${name}`, {
      message: `admin: upload image ${name}`, content, sha, branch: CFG.ghBranch,
    });
    res.json({ ok: true, key: name.replace(/\.(webp|png|jpg|jpeg)$/, "") });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

// list available image keys
app.get("/api/images", requireAuth, async (req, res) => {
  try {
    const items = await gh("GET", `/contents/src/assets?ref=${CFG.ghBranch}`);
    res.json(items.filter((i) => /\.(webp|png|jpg|jpeg)$/.test(i.name))
      .map((i) => i.name.replace(/\.(webp|png|jpg|jpeg)$/, "")));
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(CFG.port, () => console.log(`[admin] listening on :${CFG.port}`));
