"use strict";
/* MuscuApp — suivi des séances de musculation.
   Données gardées sur l'appareil (localStorage) et synchronisées avec Supabase quand on est connecté. */

const SUPABASE_URL = "https://krszgabjpswqjtypalsn.supabase.co";
const SUPABASE_KEY = "sb_publishable_cb_B1dUxgdE-zO1qRjp7tA_BWTYMgUs"; // clé publique (sans danger)
const DB_KEY = "muscuapp-v1";
const WIDE = 900; // largeur (px) à partir de laquelle la séance s'affiche en tableau
const Native = window.AndroidBridge || null;
const $app = document.getElementById("app");

/* ================= Outils ================= */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = v => { const n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isNaN(n) ? null : n; };
const fmtNum = n => String(Math.round(n * 100) / 100).replace(".", ",");
const pad = n => String(n).padStart(2, "0");
function fmtDur(ms) {
  const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? h + ":" + pad(m) + ":" + pad(x) : m + ":" + pad(x);
}
const fmtDate = t => new Date(t).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const fmtDateLong = t => new Date(t).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const fmtTime = t => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
function fmtRest(s) { s = num(s) || 0; if (!s) return "—"; return s >= 60 ? (s % 60 ? Math.floor(s / 60) + " min " + pad(s % 60) : s / 60 + " min") : s + " s"; }
function ago(t) {
  const d = Math.floor((startOfDay(Date.now()) - startOfDay(t)) / 86400000);
  return d <= 0 ? "aujourd'hui" : d === 1 ? "hier" : "il y a " + d + " j";
}
function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
const norm = s => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
  dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>',
};

/* ================= Stockage local ================= */
function emptyDb() { return { items: {}, lastServerAt: null, auth: null, mode: null, seeded: false, live: {} }; }
function load() {
  try { const d = JSON.parse(localStorage.getItem(DB_KEY)); if (d && d.items) return Object.assign(emptyDb(), d); } catch (e) { }
  return emptyDb();
}
let db = load();
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 300); }
function saveNow() { clearTimeout(saveTimer); try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { console.error(e); } }
window.addEventListener("pagehide", saveNow);

function all(kind) { return Object.values(db.items).filter(i => i.kind === kind && !i.deleted).map(i => i.data); }
function getItem(id) { const i = db.items[id]; return i && !i.deleted ? i.data : null; }
function put(kind, data) {
  const prev = db.items[data.id];
  let t = Date.now();
  if (prev && prev.updated_at >= t) t = prev.updated_at + 1;
  db.items[data.id] = { id: data.id, kind, data, updated_at: t, deleted: false, dirty: true };
  save(); scheduleSync();
}
function remove(id) {
  const p = db.items[id]; if (!p) return;
  db.items[id] = Object.assign({}, p, { deleted: true, dirty: true, updated_at: Math.max(Date.now(), p.updated_at + 1) });
  save(); scheduleSync();
}
// enregistrement différé pendant la saisie (évite une écriture à chaque touche)
const pending = {};
function putLater(kind, data) {
  clearTimeout(pending[data.id]);
  pending[data.id] = setTimeout(() => { delete pending[data.id]; if (db.items[data.id] && !db.items[data.id].deleted) put(kind, data); }, 400);
}
function flushPending() {
  for (const id of Object.keys(pending)) { clearTimeout(pending[id]); delete pending[id]; const it = db.items[id]; if (it && !it.deleted) put(it.kind, it.data); }
}
document.addEventListener("visibilitychange", () => { if (document.hidden) { flushPending(); saveNow(); } else sync(); });

/* ================= Données ================= */
const SEED = ["Push", "Pull", "Legs", "Haut du corps", "Bas du corps"];
function seedIfNeeded() {
  if (db.seeded) return;
  if (all("template").length === 0) {
    SEED.forEach((name, k) => {
      const id = "tpl-" + norm(name).replace(/\s+/g, "-");
      // updated_at 0 et non « dirty » : ces modèles vides ne remplacent jamais ceux d'un autre appareil
      db.items[id] = { id, kind: "template", updated_at: 0, deleted: false, dirty: false, data: { id, name, order: k, variants: [1, 2, 3].map(n => ({ id: "v" + n, name: "Variante " + n, exercises: [] })) } };
    });
  }
  db.seeded = true; save();
}
const templates = () => all("template").sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
const workouts = () => all("workout").sort((a, b) => b.startedAt - a.startedAt);
const finished = () => workouts().filter(w => w.endedAt);
const activeWorkout = () => workouts().find(w => !w.endedAt) || null;
function settings() { return Object.assign({ id: "settings", theme: "auto", alert: "vibration" }, getItem("settings") || {}); }
function setSetting(k, v) { const s = settings(); s[k] = v; put("settings", s); applyTheme(); render(); }
const newExercise = () => ({ id: "e-" + uid(), name: "Nouvel exercice", type: "reps", sets: 3, target: "8-10", rest: 90, note: "" });
const blankSet = () => ({ kg: "", reps: "", sec: "", done: false });
function tplExercise(w, exId) {
  const t = getItem(w.templateId); if (!t) return null;
  const v = t.variants.find(x => x.id === w.variantId); if (!v) return null;
  return v.exercises.find(e => e.id === exId) || null;
}
const setHasData = (s, type) => type === "time" ? num(s.sec) != null : (num(s.kg) != null || num(s.reps) != null);
const exHasData = e => e.sets.some(s => setHasData(s, e.type));

function setLabel(s, type) {
  if (type === "time") return num(s.sec) != null ? fmtNum(num(s.sec)) + " s" : "—";
  const kg = num(s.kg), r = num(s.reps);
  if (kg != null && r != null) return fmtNum(kg) + " kg × " + fmtNum(r);
  if (r != null) return fmtNum(r) + " reps";
  if (kg != null) return fmtNum(kg) + " kg";
  return "—";
}
const exSummary = e => e.sets.filter(s => setHasData(s, e.type)).map(s => setLabel(s, e.type)).join(", ");

/* Dernière performance : même séance + même variante en priorité, sinon même nom d'exercice ailleurs */
function lastPerf(w, ex) {
  const before = finished().filter(x => x.id !== w.id && x.startedAt < w.startedAt + 1);
  for (const x of before) {
    if (x.templateId === w.templateId && x.variantId === w.variantId) {
      const e = x.exercises.find(e => e.exId === ex.exId);
      if (e && exHasData(e)) return { w: x, e, same: true };
    }
  }
  const n = norm(ex.name);
  for (const x of before) {
    const e = x.exercises.find(e => norm(e.name) === n && e.type === ex.type);
    if (e && exHasData(e)) return { w: x, e, same: false };
  }
  return null;
}

/* ================= Thème, son, vibration ================= */
const darkQuery = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
function applyTheme() {
  const t = settings().theme;
  const dark = t === "sombre" || (t === "auto" && darkQuery && darkQuery.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = dark ? "#121212" : "#F5F4F0";
}
if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener("change", applyTheme);

let actx = null;
function audio() {
  try {
    if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); }
    if (actx && actx.state === "suspended") actx.resume();
  } catch (e) { }
  return actx;
}
document.addEventListener("pointerdown", audio, { passive: true }); // le son doit être « débloqué » par un geste
function beep() {
  const a = audio(); if (!a) return;
  const t = a.currentTime;
  [0, 0.28, 0.56].forEach((d, i) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = "sine"; o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t + d);
    g.gain.exponentialRampToValueAtTime(0.5, t + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.22);
    o.connect(g); g.connect(a.destination); o.start(t + d); o.stop(t + d + 0.25);
  });
}
function vibrate() {
  const p = [350, 150, 350];
  try { if (Native && Native.vibrate) Native.vibrate(JSON.stringify(p)); else if (navigator.vibrate) navigator.vibrate(p); } catch (e) { }
}
function signal() { const a = settings().alert; if (a === "son" || a === "les deux") beep(); if (a === "vibration" || a === "les deux") vibrate(); }
let screenOn = null;
function keepScreen(on) { if (on === screenOn) return; screenOn = on; try { if (Native && Native.keepScreenOn) Native.keepScreenOn(on); } catch (e) { } }

/* ================= Petites fenêtres ================= */
function toast(msg) {
  const d = document.createElement("div"); d.className = "toast"; d.setAttribute("role", "status"); d.textContent = msg;
  document.body.appendChild(d); setTimeout(() => d.remove(), 2600);
}
function ask(o) {
  return new Promise(res => {
    const d = document.createElement("div"); d.className = "modal";
    d.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><h3>' + esc(o.title) + "</h3>" +
      (o.text ? "<p>" + esc(o.text) + "</p>" : "") +
      (o.input !== undefined ? (o.multiline ? '<textarea class="f" rows="6" aria-label="' + esc(o.title) + '">' + esc(o.input) + "</textarea>" : '<input class="f" aria-label="' + esc(o.title) + '" value="' + esc(o.input) + '">') : "") +
      '<div class="modal-btns">' + (o.cancel === false ? "" : '<button class="btn" data-r="0">' + esc(o.cancel || "Annuler") + "</button>") +
      '<button class="btn ' + (o.danger ? "strong" : "primary") + '" data-r="1">' + esc(o.ok || "OK") + "</button></div></div>";
    document.body.appendChild(d);
    const inp = d.querySelector("input, textarea");
    if (inp) { inp.focus(); if (inp.select) inp.select(); }
    const done = ok => { d.remove(); res(ok ? (inp ? inp.value.trim() : true) : null); };
    if (inp && inp.tagName === "INPUT") inp.addEventListener("keydown", e => { if (e.key === "Enter") done(true); });
    d.addEventListener("click", e => { if (e.target === d) done(false); const b = e.target.closest("[data-r]"); if (b) done(b.dataset.r === "1"); });
  });
}

/* ================= Supabase (connexion + synchro) ================= */
const syncState = { status: "idle", at: null, error: "" };
async function authReq(path, body) {
  const r = await fetch(SUPABASE_URL + "/auth/v1/" + path, { method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error_description || j.msg || j.message || j.error || ("Erreur " + r.status)); e.status = r.status; e.code = j.error_code || j.code; throw e; }
  return j;
}
function setSession(j) {
  db.auth = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, user: { id: j.user.id, email: j.user.email } };
  db.mode = "account"; saveNow();
}
let refreshing = null;
async function ensureToken(force) {
  if (!db.auth) throw new Error("non connecté");
  if (!force && db.auth.expires_at - 60000 > Date.now()) return;
  if (!refreshing) refreshing = authReq("token?grant_type=refresh_token", { refresh_token: db.auth.refresh_token })
    .then(setSession)
    .catch(e => { if (e.status === 400 || e.status === 401) { db.auth = null; db.mode = null; saveNow(); render(); } throw e; })
    .finally(() => { refreshing = null; });
  return refreshing;
}
async function rest(method, path, body, headers) {
  await ensureToken();
  const go = () => fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: Object.assign({ apikey: SUPABASE_KEY, Authorization: "Bearer " + db.auth.access_token, "Content-Type": "application/json" }, headers || {}),
  });
  let r = await go();
  if (r.status === 401) { await ensureToken(true); r = await go(); }
  if (!r.ok) {
    const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch (e) { }
    const e = new Error(j.message || t || ("Erreur " + r.status)); e.status = r.status; e.code = j.code; throw e;
  }
  return method === "GET" ? r.json() : null;
}

let syncTimer = null, syncing = false, syncAgain = false;
function scheduleSync() { if (!db.auth) return; clearTimeout(syncTimer); syncTimer = setTimeout(sync, 2500); }
async function sync() {
  if (!db.auth) return;
  if (syncing) { syncAgain = true; return; }
  if (navigator.onLine === false) { syncState.status = "offline"; updateSyncBadges(); return; }
  syncing = true; syncState.status = "busy"; updateSyncBadges();
  let changed = false;
  try {
    // 1) récupérer ce qui a changé sur le serveur
    let since = db.lastServerAt, maxSeen = db.lastServerAt;
    for (let page = 0; page < 50; page++) {
      let q = "items?select=id,kind,data,updated_at,deleted,server_at&order=server_at.asc&limit=1000";
      if (since) q += "&server_at=gte." + encodeURIComponent(since);
      const rows = await rest("GET", q);
      for (const r of rows) {
        const loc = db.items[r.id];
        const ru = Number(r.updated_at);
        if (!loc || ru > loc.updated_at || (!loc.dirty && ru !== loc.updated_at)) {
          db.items[r.id] = { id: r.id, kind: r.kind, data: r.data, updated_at: ru, deleted: r.deleted, dirty: false };
          changed = true;
        }
        if (!maxSeen || r.server_at > maxSeen) maxSeen = r.server_at;
      }
      if (rows.length < 1000) break;
      since = rows[rows.length - 1].server_at;
    }
    db.lastServerAt = maxSeen;
    if (!db.seeded) { seedIfNeeded(); changed = true; }
    // 2) envoyer ce qui a changé ici
    const dirty = Object.values(db.items).filter(i => i.dirty);
    for (let k = 0; k < dirty.length; k += 200) {
      const chunk = dirty.slice(k, k + 200);
      const snap = chunk.map(i => i.updated_at);
      await rest("POST", "items?on_conflict=user_id,id", chunk.map(i => ({ user_id: db.auth.user.id, id: i.id, kind: i.kind, data: i.data, updated_at: i.updated_at, deleted: !!i.deleted })),
        { Prefer: "resolution=merge-duplicates,return=minimal" });
      chunk.forEach((i, n) => { const cur = db.items[i.id]; if (cur && cur.updated_at === snap[n]) cur.dirty = false; });
    }
    saveNow();
    syncState.status = "ok"; syncState.at = Date.now(); syncState.error = "";
  } catch (e) {
    console.error(e);
    syncState.status = "err";
    syncState.error = e.code === "PGRST205" || e.code === "42P01" || /items/.test(e.message) && e.status === 404
      ? "La base Supabase n'est pas encore prête (table « items » absente)." : (e.message === "Failed to fetch" ? "Pas de connexion." : e.message);
  } finally {
    syncing = false;
    updateSyncBadges();
    if (changed) softRender();
    if (syncAgain) { syncAgain = false; scheduleSync(); }
  }
}
setInterval(() => { if (!document.hidden) sync(); }, 60000);
window.addEventListener("online", sync);

function syncBadge() {
  if (!db.auth) return '<span class="sync"><span class="dot"></span>Hors ligne (sans compte)</span>';
  const s = syncState.status;
  const cls = s === "ok" ? "ok" : s === "err" ? "err" : s === "busy" ? "busy" : "";
  const txt = s === "ok" ? "Synchronisé " + fmtTime(syncState.at) : s === "err" ? "Synchro en échec" : s === "busy" ? "Synchronisation…" : s === "offline" ? "Pas de réseau" : "En attente";
  return '<span class="sync" data-sync><span class="dot ' + cls + '"></span>' + esc(txt) + "</span>";
}
function updateSyncBadges() {
  document.querySelectorAll("[data-sync]").forEach(el => { el.outerHTML = syncBadge(); });
  const e = document.querySelector("[data-sync-error]"); if (e) e.textContent = syncState.status === "err" ? syncState.error : "";
}

/* ================= Navigation ================= */
function route() { const h = location.hash.replace(/^#\/?/, ""); const p = h.split("/"); return { name: p[0] || "home", args: p.slice(1).map(decodeURIComponent) }; }
const go = path => { location.hash = "#/" + path; };
window.addEventListener("hashchange", () => { flushPending(); render(); window.scrollTo(0, 0); });
let isWide = window.innerWidth >= WIDE;
window.addEventListener("resize", () => { const w = window.innerWidth >= WIDE; if (w !== isWide) { isWide = w; softRender(); } });

// rafraîchit l'écran, sauf pendant une saisie (on attend que le champ perde le focus)
let renderWaiting = false;
function softRender() {
  const a = document.activeElement;
  if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && $app.contains(a)) {
    if (!renderWaiting) { renderWaiting = true; a.addEventListener("blur", () => { renderWaiting = false; setTimeout(render, 0); }, { once: true }); }
    return;
  }
  render();
}

const NAV = [["home", "Accueil", "home"], ["programs", "Programmes", "list"], ["history", "Historique", "clock"], ["progress", "Progrès", "chart"], ["settings", "Réglages", "gear"]];
// Remplacer l'écran retire le champ actif : son « blur »/« change » peut redemander un rendu pendant celui-ci.
let rendering = false;
function render() {
  if (rendering) { setTimeout(render, 0); return; }
  rendering = true;
  try { renderNow(); } finally { rendering = false; }
}
function renderNow() {
  applyTheme();
  if (!db.auth && db.mode !== "local") { keepScreen(false); $app.innerHTML = viewLogin(); return; }
  seedIfNeeded();
  const r = route();
  let body, wide = false, immersive = false;
  switch (r.name) {
    case "session": { const v = viewSession(r.args[0]); body = v.html; wide = v.wide; immersive = v.active; break; }
    case "programs": body = viewPrograms(); break;
    case "program": body = viewProgram(r.args[0], r.args[1]); break;
    case "history": body = viewHistory(); break;
    case "progress": body = r.args[0] ? viewProgressDetail(r.args[0]) : viewProgress(); wide = false; break;
    case "settings": body = viewSettings(); break;
    default: body = viewHome();
  }
  const tab = { session: "home", program: "programs" }[r.name] || (NAV.some(n => n[0] === r.name) ? r.name : "home");
  $app.innerHTML = '<div class="shell' + (immersive ? " hide-nav" : "") + '"><nav class="nav" aria-label="Navigation"><div class="brand">Muscu</div>' +
    NAV.map(n => '<a href="#/' + n[0] + '" class="' + (n[0] === tab ? "on" : "") + '"' + (n[0] === tab ? ' aria-current="page"' : "") + ">" + ICON[n[2]] + "<span>" + n[1] + "</span></a>").join("") +
    '</nav><main class="main' + (wide ? " wide" : "") + '">' + body + "</main></div>";
  keepScreen(immersive);
  tick();
}

/* ================= Écran : connexion ================= */
function viewLogin() {
  return '<div class="login"><div class="logo">' + ICON.dumbbell + "</div><h1>Muscu</h1>" +
    '<p class="muted">Connecte-toi pour retrouver tes séances sur ton téléphone et sur ton ordinateur.</p>' +
    '<form data-form="login" class="stack">' +
    '<label class="fl">E-mail<input class="f" type="email" name="email" autocomplete="email" required></label>' +
    '<label class="fl">Mot de passe<input class="f" type="password" name="password" minlength="6" autocomplete="current-password" required></label>' +
    '<button class="btn primary big" type="submit" value="in">Se connecter</button>' +
    '<button class="btn big" type="submit" value="up">Créer un compte</button></form>' +
    '<p class="msg" data-msg role="status"></p>' +
    '<button class="link" data-act="local">Continuer sans compte (données sur cet appareil seulement)</button></div>';
}
function authMessage(e) {
  const m = String(e.message || "");
  if (/invalid login credentials/i.test(m)) return "E-mail ou mot de passe incorrect.";
  if (/email not confirmed/i.test(m)) return "Confirme d'abord ton e-mail avec le lien reçu, puis reconnecte-toi.";
  if (/already registered|already exists/i.test(m)) return "Un compte existe déjà avec cet e-mail : clique sur « Se connecter ».";
  if (/password/i.test(m) && /6|short|weak/i.test(m)) return "Mot de passe trop court (6 caractères minimum).";
  if (m === "Failed to fetch") return "Pas de connexion internet.";
  return m;
}
async function onLogin(form, mode) {
  const msg = $app.querySelector("[data-msg]");
  const email = form.email.value.trim(), password = form.password.value;
  msg.className = "msg"; msg.textContent = mode === "up" ? "Création du compte…" : "Connexion…";
  form.querySelectorAll("button").forEach(b => { b.disabled = true; });
  try {
    if (mode === "up") {
      const j = await authReq("signup", { email, password });
      if (!j.access_token) { msg.textContent = "Compte créé. Ouvre le lien reçu par e-mail pour le confirmer, puis clique sur « Se connecter »."; return; }
      setSession(j);
    } else {
      setSession(await authReq("token?grant_type=password", { email, password }));
    }
    db.seeded = false; db.lastServerAt = null;
    // les données déjà saisies sans compte seront envoyées au compte
    Object.values(db.items).forEach(i => { if (i.updated_at > 0) i.dirty = true; });
    saveNow(); render(); await sync(); render();
  } catch (e) {
    msg.className = "msg err"; msg.textContent = authMessage(e);
  } finally {
    form.querySelectorAll("button").forEach(b => { b.disabled = false; });
  }
}

/* ================= Écran : accueil ================= */
function variantStats(t) {
  const ws = finished().filter(w => w.templateId === t.id);
  return t.variants.map(v => { const last = ws.find(w => w.variantId === v.id); return { v, last }; });
}
function viewHome() {
  const act = activeWorkout();
  let h = '<div class="page-head"><div><div class="muted small">' + esc(fmtDateLong(Date.now())) + '</div><h1>Bonjour</h1></div>' + syncBadge() + "</div>";
  if (act) {
    h += '<div class="hero"><div class="small" style="opacity:.75">Séance en cours</div><div style="font-size:21px;font-weight:800;margin-top:2px">' + esc(act.templateName) + " · " + esc(act.variantName) + "</div>" +
      '<div class="small" style="opacity:.8;margin-top:4px">Commencée à ' + fmtTime(act.startedAt) + ' · <span class="num" data-tick="elapsed" data-id="' + act.id + '"></span></div>' +
      '<a class="btn primary block big" href="#/session/' + act.id + '">Reprendre la séance</a></div>';
  }
  const ts = templates();
  h += '<div class="section-title">Mes séances</div><div class="stack">';
  if (!ts.length) h += '<div class="card empty">Aucune séance. Crée-en une dans <a href="#/programs">Programmes</a>.</div>';
  for (const t of ts) {
    const st = variantStats(t);
    const lastAny = st.filter(x => x.last).sort((a, b) => b.last.startedAt - a.last.startedAt)[0];
    // variante suggérée : jamais faite, sinon celle faite il y a le plus longtemps (en suivant l'ordre)
    let sugg = null;
    if (st.length > 1) {
      const never = st.find(x => !x.last);
      sugg = never ? never.v.id : st.slice().sort((a, b) => a.last.startedAt - b.last.startedAt)[0].v.id;
    }
    h += '<div class="card tpl"><div class="spread"><h2>' + esc(t.name) + "</h2>" +
      '<span class="muted small">' + (lastAny ? "Dernière : " + esc(fmtDate(lastAny.last.startedAt)) + " (" + esc(lastAny.v.name) + ")" : "Jamais faite") + "</span></div>" +
      '<div class="variants">' + st.map(x => {
        const n = x.v.exercises.length;
        return '<button class="variant' + (x.v.id === sugg ? " sugg" : "") + '" data-act="start" data-t="' + t.id + '" data-v="' + x.v.id + '"><b>' + esc(x.v.name) + "</b>" +
          "<span>" + (n ? n + " exercice" + (n > 1 ? "s" : "") : "vide — à remplir") + "</span>" +
          "<span>" + (x.v.id === sugg ? '<span class="tag">Suggérée</span> · ' : "") + (x.last ? esc(ago(x.last.startedAt)) : "jamais faite") + "</span></button>";
      }).join("") + "</div></div>";
  }
  h += "</div>";
  const recent = finished().slice(0, 3);
  if (recent.length) {
    h += '<div class="section-title">Dernières séances</div><div class="list">' + recent.map(historyRow).join("") + "</div>";
  }
  return h;
}
async function startWorkout(tid, vid) {
  const t = getItem(tid); if (!t) return;
  const v = t.variants.find(x => x.id === vid); if (!v) return;
  if (!v.exercises.length) { toast("Ajoute d'abord des exercices à cette variante"); go("program/" + tid + "/" + vid); return; }
  const act = activeWorkout();
  if (act) {
    const ok = await ask({ title: "Une séance est déjà en cours", text: act.templateName + " · " + act.variantName + "\nLa terminer et commencer celle-ci ?", ok: "Oui, la terminer" });
    if (!ok) return;
    act.endedAt = Date.now(); put("workout", act);
  }
  const w = {
    id: "w-" + uid(), templateId: t.id, variantId: v.id, templateName: t.name, variantName: v.name, startedAt: Date.now(), endedAt: null,
    exercises: v.exercises.map(e => ({ exId: e.id, name: e.name, type: e.type, target: e.target, rest: e.rest, sets: Array.from({ length: Math.max(1, num(e.sets) || 1) }, blankSet) })),
  };
  put("workout", w);
  db.live = {}; save();
  go("session/" + w.id);
}

/* ================= Écran : séance ================= */
function lastLine(w, e) {
  const lp = lastPerf(w, e);
  if (!lp) return '<div class="last">Pas encore de performance enregistrée pour cet exercice.</div>';
  const where = lp.same ? esc(lp.w.variantName) : esc(lp.w.templateName) + " · " + esc(lp.w.variantName);
  return '<div class="last">Dernière fois · ' + where + " · " + esc(fmtDate(lp.w.startedAt)) + " : <b>" + esc(exSummary(lp.e)) + "</b></div>";
}
function placeholders(w, e, s) {
  const lp = lastPerf(w, e);
  const src = (lp && lp.e.sets[s] && setHasData(lp.e.sets[s], e.type)) ? lp.e.sets[s] : null;
  return { kg: src && num(src.kg) != null ? fmtNum(num(src.kg)) : "kg", reps: src && num(src.reps) != null ? fmtNum(num(src.reps)) : "reps", sec: src && num(src.sec) != null ? fmtNum(num(src.sec)) : "s" };
}
function chronoBtn(w, i, s) {
  const c = db.live.chrono, run = c && c.wid === w.id && c.i === i && c.s === s;
  return '<button class="chrono' + (run ? " run" : "") + '" data-act="chrono" data-i="' + i + '" data-s="' + s + '" aria-label="' + (run ? "Arrêter le chrono" : "Lancer le chrono") + '">' +
    (run ? ICON.stop + '<span class="num" data-tick="chrono">0:00</span>' : ICON.play + "<span>Chrono</span>") + "</button>";
}
function viewSession(id) {
  const w = getItem(id);
  if (!w) return { html: '<a class="back" href="#/home">‹ Accueil</a><div class="card empty">Séance introuvable.</div>', wide: false, active: false };
  const active = !w.endedAt;
  const wide = window.innerWidth >= WIDE;
  let h = '<a class="back" href="#/' + (active ? "home" : "history") + '">‹ ' + (active ? "Accueil" : "Historique") + "</a>" +
    '<div class="page-head"><div><div class="muted small">' + esc(w.variantName) + " · " + esc(fmtDateLong(w.startedAt)) + "</div><h1>" + esc(w.templateName) + "</h1></div>" +
    '<div class="row"><span class="num" style="font-size:18px;font-weight:700" data-tick="elapsed" data-id="' + w.id + '"></span>' +
    (active ? '<button class="btn sm" data-act="cancel">Annuler</button>' : "") + "</div></div>";
  if (!active) h += '<div class="banner">Séance terminée. Tu peux encore corriger les valeurs.</div>';
  h += wide ? sessionTable(w) : sessionCards(w);
  h += '<div style="margin-top:16px" class="row"><button class="btn" data-act="addex">+ Ajouter un exercice à cette séance</button></div>';
  h += '<div class="bottom-bar"><div class="inner">' +
    (active ? '<button class="rest" data-act="skiprest" hidden><span class="bar" data-restbar></span><span class="txt" data-tick="rest"></span></button>' +
      '<button class="btn strong big" data-act="finish" style="flex:1">Terminer la séance</button>'
      : '<button class="btn danger big" data-act="delworkout" style="flex:1">Supprimer cette séance</button>') + "</div></div>";
  return { html: h, wide, active };
}
function sessionCards(w) {
  return '<div class="stack">' + w.exercises.map((e, i) => {
    const te = tplExercise(w, e.exId);
    const note = te ? te.note : (e.note || "");
    const time = e.type === "time";
    let rows = '<div class="h">Série</div>' + (time ? '<div class="h">Temps (s)</div><div class="h"></div>' : '<div class="h">Kg</div><div class="h">Reps</div>') + '<div class="h"></div>';
    e.sets.forEach((s, k) => {
      const ph = placeholders(w, e, k), d = s.done ? " done-row" : "";
      rows += '<div class="n">' + (k + 1) + "</div>";
      if (time) rows += '<div class="set' + d + '"><input inputmode="numeric" aria-label="Temps série ' + (k + 1) + '" data-f="sec" data-i="' + i + '" data-s="' + k + '" value="' + esc(s.sec) + '" placeholder="' + esc(ph.sec) + '"></div>' + chronoBtn(w, i, k);
      else rows += '<div class="set' + d + '"><input inputmode="decimal" aria-label="Kilos série ' + (k + 1) + '" data-f="kg" data-i="' + i + '" data-s="' + k + '" value="' + esc(s.kg) + '" placeholder="' + esc(ph.kg) + '"></div>' +
        '<div class="set' + d + '"><input inputmode="numeric" aria-label="Répétitions série ' + (k + 1) + '" data-f="reps" data-i="' + i + '" data-s="' + k + '" value="' + esc(s.reps) + '" placeholder="' + esc(ph.reps) + '"></div>';
      rows += '<button class="ok' + (s.done ? " on" : "") + '" data-act="done" data-i="' + i + '" data-s="' + k + '" aria-label="Valider la série ' + (k + 1) + '" aria-pressed="' + !!s.done + '">✓</button>';
    });
    return '<section class="card ex"><div class="spread"><div class="ex-name">' + esc(e.name) + '</div><button class="link" data-act="rename" data-i="' + i + '">Renommer</button></div>' +
      '<div class="ex-meta">' + e.sets.length + " × " + esc(e.target || "—") + (time ? " s" : "") + " · repos " + esc(fmtRest(e.rest)) + "</div>" +
      lastLine(w, e) +
      '<div class="sets' + (time ? " time" : "") + '">' + rows + "</div>" +
      '<div class="ex-actions"><button class="btn sm" data-act="addset" data-i="' + i + '">+ Série</button>' +
      (e.sets.length > 1 ? '<button class="btn sm" data-act="delset" data-i="' + i + '">− Série</button>' : "") + "</div>" +
      '<textarea class="f" data-f="note" data-i="' + i + '" placeholder="Notes (réglages, sensations…)" aria-label="Notes ' + esc(e.name) + '">' + esc(note) + "</textarea></section>";
  }).join("") + "</div>";
}
function sessionTable(w) {
  const max = Math.max(1, ...w.exercises.map(e => e.sets.length));
  let h = '<div class="table-wrap"><table class="grid"><thead><tr><th>Exercice</th><th>Séries</th><th>Reps cible</th><th>Repos</th>';
  for (let k = 0; k < max; k++) h += "<th>Série " + (k + 1) + "</th>";
  h += "<th>Notes</th></tr></thead><tbody>";
  w.exercises.forEach((e, i) => {
    const te = tplExercise(w, e.exId), note = te ? te.note : (e.note || ""), time = e.type === "time";
    h += '<tr><td><div class="spread" style="align-items:flex-start"><b style="font-size:15px">' + esc(e.name) + '</b><button class="link" data-act="rename" data-i="' + i + '">Renommer</button></div>' +
      lastLine(w, e) + '<div class="ex-actions"><button class="btn sm" data-act="addset" data-i="' + i + '">+ Série</button>' +
      (e.sets.length > 1 ? '<button class="btn sm" data-act="delset" data-i="' + i + '">− Série</button>' : "") + "</div></td>" +
      "<td>" + e.sets.length + "</td><td>" + esc(e.target || "—") + (time ? " s" : "") + "</td><td>" + esc(fmtRest(e.rest)) + "</td>";
    for (let k = 0; k < max; k++) {
      const s = e.sets[k];
      if (!s) { h += "<td></td>"; continue; }
      const ph = placeholders(w, e, k);
      h += '<td><div class="cell' + (s.done ? " done-row" : "") + '">' +
        (time ? '<input inputmode="numeric" aria-label="Temps série ' + (k + 1) + '" data-f="sec" data-i="' + i + '" data-s="' + k + '" value="' + esc(s.sec) + '" placeholder="' + esc(ph.sec) + '">' + chronoBtn(w, i, k)
          : '<input inputmode="decimal" aria-label="Kilos série ' + (k + 1) + '" data-f="kg" data-i="' + i + '" data-s="' + k + '" value="' + esc(s.kg) + '" placeholder="' + esc(ph.kg) + '">' +
          '<input inputmode="numeric" aria-label="Répétitions série ' + (k + 1) + '" data-f="reps" data-i="' + i + '" data-s="' + k + '" value="' + esc(s.reps) + '" placeholder="' + esc(ph.reps) + '">') +
        '<button class="ok' + (s.done ? " on" : "") + '" data-act="done" data-i="' + i + '" data-s="' + k + '" aria-label="Valider la série ' + (k + 1) + '" aria-pressed="' + !!s.done + '">✓</button></div></td>';
    }
    h += '<td><textarea class="f" data-f="note" data-i="' + i + '" placeholder="Notes" aria-label="Notes ' + esc(e.name) + '">' + esc(note) + "</textarea></td></tr>";
  });
  return h + "</tbody></table></div>";
}
function currentWorkout() { const r = route(); return r.name === "session" ? getItem(r.args[0]) : null; }
function markDone(w, i, s) {
  const e = w.exercises[i], set = e.sets[s];
  if (!set.done) {
    // champs vides : on reprend la dernière performance (ou la série précédente)
    const lp = lastPerf(w, e);
    const src = (lp && lp.e.sets[s]) || e.sets[s - 1] || null;
    for (const f of e.type === "time" ? ["sec"] : ["kg", "reps"]) if (set[f] === "" && src && src[f] !== "" && src[f] != null) set[f] = src[f];
    set.done = true;
    if (!w.endedAt) startRest(e.rest);
  } else set.done = false;
  put("workout", w);
  render();
}
function startRest(sec) {
  sec = num(sec) || 0;
  if (sec <= 0) return;
  db.live.restEnd = Date.now() + sec * 1000; db.live.restTotal = sec * 1000; db.live.restAlerted = false; save();
}

/* ================= Écran : programmes ================= */
function viewPrograms() {
  const ts = templates();
  return '<div class="page-head"><h1>Programmes</h1><button class="btn primary" data-act="newtpl">+ Nouvelle séance</button></div>' +
    '<p class="muted small">Tes séances-types et leurs variantes. Les modifications servent pour les prochaines séances.</p>' +
    '<div class="list">' + (ts.length ? ts.map(t => '<a href="#/program/' + t.id + '"><div><b>' + esc(t.name) + '</b><div class="muted small">' +
      t.variants.map(v => esc(v.name) + " : " + v.exercises.length + " exo").join(" · ") + '</div></div><span class="muted">›</span></a>').join("") : '<div class="empty">Aucune séance.</div>') + "</div>";
}
function viewProgram(tid, vid) {
  const t = getItem(tid);
  if (!t) return '<a class="back" href="#/programs">‹ Programmes</a><div class="card empty">Séance introuvable.</div>';
  const v = t.variants.find(x => x.id === vid) || t.variants[0];
  let h = '<a class="back" href="#/programs">‹ Programmes</a>' +
    '<label class="fl" style="margin-top:8px">Nom de la séance<input class="f" data-p="tname" value="' + esc(t.name) + '" style="font-size:20px;font-weight:700"></label>' +
    '<div class="section-title">Variantes</div><div class="tabs">' +
    t.variants.map(x => '<button class="' + (v && x.id === v.id ? "on" : "") + '" data-act="tab" data-v="' + x.id + '"' + (v && x.id === v.id ? " data-vtab" : "") + '>' + esc(x.name) + "</button>").join("") +
    '<button data-act="addvar">+ Variante</button></div>';
  if (!v) return h;
  h += '<div class="card"><div class="spread"><label class="fl" style="flex:1">Nom de la variante<input class="f" data-p="vname" value="' + esc(v.name) + '"></label></div>' +
    '<div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn sm" data-act="dupvar">Dupliquer cette variante</button>' +
    (t.variants.length > 1 ? '<button class="btn sm danger" data-act="delvar">Supprimer la variante</button>' : "") + "</div></div>";
  h += '<div class="section-title">Exercices (' + v.exercises.length + ")</div><div class=\"stack\">";
  v.exercises.forEach((e, k) => {
    h += '<div class="card"><div class="spread"><b>' + (k + 1) + '. <span data-title="' + k + '">' + esc(e.name) + '</span></b><div class="row">' +
      (k > 0 ? '<button class="btn sm" data-act="up" data-e="' + k + '" aria-label="Monter">↑</button>' : "") +
      (k < v.exercises.length - 1 ? '<button class="btn sm" data-act="down" data-e="' + k + '" aria-label="Descendre">↓</button>' : "") +
      '<button class="btn sm danger" data-act="delex" data-e="' + k + '">Supprimer</button></div></div>' +
      '<div class="ed-grid"><label class="fl full">Nom<input class="f" data-p="name" data-e="' + k + '" value="' + esc(e.name) + '"></label>' +
      '<label class="fl">Type<select class="f" data-p="type" data-e="' + k + '"><option value="reps"' + (e.type !== "time" ? " selected" : "") + '>Poids × reps</option><option value="time"' + (e.type === "time" ? " selected" : "") + ">Temps (gainage)</option></select></label>" +
      '<label class="fl">Séries<input class="f" type="number" min="1" max="20" inputmode="numeric" data-p="sets" data-e="' + k + '" value="' + esc(e.sets) + '"></label>' +
      '<label class="fl">' + (e.type === "time" ? "Temps cible (s)" : "Reps cible") + '<input class="f" data-p="target" data-e="' + k + '" value="' + esc(e.target) + '" placeholder="' + (e.type === "time" ? "45" : "8-10") + '"></label>' +
      '<label class="fl">Repos (s)<input class="f" type="number" min="0" step="5" inputmode="numeric" data-p="rest" data-e="' + k + '" value="' + esc(e.rest) + '"></label>' +
      '<label class="fl full">Notes<textarea class="f" data-p="note" data-e="' + k + '" placeholder="Réglages de la machine, consignes…">' + esc(e.note) + "</textarea></label></div></div>";
  });
  h += '<button class="btn block" data-act="addtplex">+ Ajouter un exercice</button></div>' +
    '<div style="margin-top:32px"><button class="btn danger" data-act="deltpl">Supprimer la séance « ' + esc(t.name) + " »</button></div>";
  return h;
}
function currentProgram() {
  const r = route(); if (r.name !== "program") return {};
  const t = getItem(r.args[0]); if (!t) return {};
  const v = t.variants.find(x => x.id === r.args[1]) || t.variants[0];
  return { t, v };
}

/* ================= Écran : historique ================= */
function historyRow(w) {
  const done = w.exercises.reduce((n, e) => n + e.sets.filter(s => s.done || setHasData(s, e.type)).length, 0);
  return '<a href="#/session/' + w.id + '"><div><b>' + esc(w.templateName) + '</b> <span class="muted">· ' + esc(w.variantName) + '</span><div class="muted small">' +
    esc(fmtDate(w.startedAt)) + " · " + w.exercises.length + " exercices · " + done + ' séries</div></div><span class="muted small num">' + fmtDur((w.endedAt || Date.now()) - w.startedAt) + "</span></a>";
}
function viewHistory() {
  const ws = finished();
  if (!ws.length) return '<div class="page-head"><h1>Historique</h1></div><div class="card empty">Aucune séance terminée pour l\'instant.</div>';
  let h = '<div class="page-head"><h1>Historique</h1><span class="muted small">' + ws.length + " séance" + (ws.length > 1 ? "s" : "") + "</span></div>", month = "";
  ws.forEach((w, k) => {
    const m = new Date(w.startedAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    if (m !== month) { if (month) h += "</div>"; month = m; h += '<div class="section-title">' + esc(m) + '</div><div class="list">'; }
    h += historyRow(w);
  });
  return h + "</div>";
}

/* ================= Écran : progression ================= */
function progressData() {
  const map = {};
  for (const w of finished().slice().reverse()) {
    for (const e of w.exercises) {
      if (!exHasData(e)) continue;
      const key = norm(e.name) + "|" + e.type;
      const best = Math.max(...e.sets.map(s => num(e.type === "time" ? s.sec : s.kg)).filter(x => x != null), -Infinity);
      const reps = e.type === "time" ? null : Math.max(...e.sets.map(s => num(s.reps)).filter(x => x != null), -Infinity);
      (map[key] = map[key] || { key, name: e.name, type: e.type, entries: [] }).entries.push({ w, e, best: best === -Infinity ? null : best, reps: reps === -Infinity ? null : reps });
      map[key].name = e.name;
    }
  }
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
const unitOf = p => p.type === "time" ? " s" : " kg";
function viewProgress() {
  const ps = progressData();
  let h = '<div class="page-head"><h1>Progrès</h1></div>';
  if (!ps.length) return h + '<div class="card empty">Termine une première séance pour voir ta progression.</div>';
  return h + '<div class="list">' + ps.map(p => {
    const vals = p.entries.map(x => x.best).filter(x => x != null);
    const rec = vals.length ? Math.max(...vals) : null;
    return '<a href="#/progress/' + encodeURIComponent(p.key) + '"><div><b>' + esc(p.name) + '</b><div class="muted small">' + p.entries.length + " séance" + (p.entries.length > 1 ? "s" : "") +
      " · dernière " + esc(fmtDate(p.entries[p.entries.length - 1].w.startedAt)) + "</div></div>" +
      '<span class="small"><b>' + (rec != null ? fmtNum(rec) + unitOf(p) : "—") + '</b> <span class="muted">record</span></span></a>';
  }).join("") + "</div>";
}
function viewProgressDetail(key) {
  const p = progressData().find(x => x.key === key);
  if (!p) return '<a class="back" href="#/progress">‹ Progrès</a><div class="card empty">Pas de données.</div>';
  const vals = p.entries.map(x => x.best).filter(x => x != null);
  const rec = vals.length ? Math.max(...vals) : null;
  const last = p.entries[p.entries.length - 1];
  const pts = p.entries.slice(-16);
  const max = Math.max(1, ...pts.map(x => x.best || 0));
  const W = 600, H = 200, bw = Math.min(W / pts.length, 70), x0 = (W - bw * pts.length) / 2;
  let svg = '<svg class="chart" viewBox="0 0 ' + W + " " + (H + 24) + '" role="img" aria-label="' + esc((p.type === "time" ? "Meilleur temps" : "Charge maximale") + " par séance pour " + p.name) + '">';
  pts.forEach((x, k) => {
    const v = x.best || 0, bh = Math.max(2, (v / max) * (H - 24));
    svg += '<rect class="b' + (v === rec ? " top" : "") + '" x="' + (x0 + k * bw + bw * 0.15) + '" y="' + (H - bh) + '" width="' + (bw * 0.7) + '" height="' + bh + '" rx="4"></rect>';
    if (pts.length <= 12 || k % 2 === 0) {
      svg += '<text x="' + (x0 + k * bw + bw / 2) + '" y="' + (H - bh - 6) + '" text-anchor="middle">' + (x.best != null ? fmtNum(x.best) : "") + "</text>";
      const d = new Date(x.w.startedAt);
      svg += '<text x="' + (x0 + k * bw + bw / 2) + '" y="' + (H + 16) + '" text-anchor="middle">' + pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "</text>";
    }
  });
  svg += "</svg>";
  return '<a class="back" href="#/progress">‹ Progrès</a><div class="page-head"><h1>' + esc(p.name) + "</h1></div>" +
    '<div class="stats"><div class="card stat"><div class="muted small">Record</div><div class="v">' + (rec != null ? fmtNum(rec) + unitOf(p) : "—") + "</div></div>" +
    '<div class="card stat"><div class="muted small">Dernière séance</div><div class="v">' + (last.best != null ? fmtNum(last.best) + unitOf(p) : "—") + "</div></div></div>" +
    '<div class="card" style="margin-top:12px"><div class="muted small" style="font-weight:600;margin-bottom:8px">' + (p.type === "time" ? "Meilleur temps par séance (s)" : "Charge maximale par séance (kg)") + "</div>" + svg + "</div>" +
    '<div class="section-title">Historique</div><div class="list">' + p.entries.slice().reverse().map(x =>
      '<a href="#/session/' + x.w.id + '"><div><b>' + esc(fmtDate(x.w.startedAt)) + '</b><div class="muted small">' + esc(x.w.templateName) + " · " + esc(x.w.variantName) + '</div></div><span class="small" style="text-align:right">' + esc(exSummary(x.e)) + "</span></a>").join("") + "</div>";
}

/* ================= Écran : réglages ================= */
function viewSettings() {
  const s = settings();
  const seg = (k, opts) => '<div class="seg" role="group">' + opts.map(o => '<button class="' + (s[k] === o[0] ? "on" : "") + '" aria-pressed="' + (s[k] === o[0]) + '" data-act="set" data-k="' + k + '" data-val="' + o[0] + '">' + o[1] + "</button>").join("") + "</div>";
  const ver = (Native && Native.version ? "Appli Android " + Native.version() : "Version web") + " · " + (window.APP_BUILD || "dev");
  return '<div class="page-head"><h1>Réglages</h1></div><div class="stack">' +
    '<div class="card"><b>Apparence</b><div style="margin-top:10px">' + seg("theme", [["auto", "Auto"], ["clair", "Clair"], ["sombre", "Sombre"]]) + "</div></div>" +
    '<div class="card"><b>Alerte de fin de repos</b><div style="margin-top:10px">' + seg("alert", [["vibration", "Vibration"], ["son", "Son"], ["les deux", "Les deux"], ["aucune", "Aucune"]]) + "</div>" +
    '<button class="btn sm" style="margin-top:10px" data-act="testalert">Tester</button></div>' +
    '<div class="card"><b>Compte</b><div style="margin-top:8px">' +
    (db.auth ? '<div class="small">Connecté : ' + esc(db.auth.user.email) + "</div><div style=\"margin-top:6px\">" + syncBadge() + '</div><div class="small msg err" data-sync-error>' + (syncState.status === "err" ? esc(syncState.error) : "") + "</div>" +
      '<div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm" data-act="syncnow">Synchroniser maintenant</button><button class="btn sm" data-act="logout">Se déconnecter</button></div>'
      : '<div class="small muted">Sans compte : tes données restent sur cet appareil.</div><button class="btn sm primary" style="margin-top:8px" data-act="tologin">Se connecter / créer un compte</button>') +
    "</div></div>" +
    '<div class="card"><b>Sauvegarde</b><div class="small muted" style="margin-top:4px">Copie de secours de toutes tes données (texte à garder dans une note).</div>' +
    '<div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm" data-act="export">Copier la sauvegarde</button><button class="btn sm" data-act="import">Restaurer…</button></div></div>' +
    '<div class="muted small">' + esc(ver) + "</div></div>";
}

/* ================= Minuteurs ================= */
function tick() {
  const now = Date.now(), L = db.live || {};
  document.querySelectorAll('[data-tick="elapsed"]').forEach(el => { const w = getItem(el.dataset.id); if (w) el.textContent = fmtDur((w.endedAt || now) - w.startedAt); });
  // repos
  if (L.restEnd && now >= L.restEnd && !L.restAlerted) { L.restAlerted = true; L.restEnd = null; save(); signal(); toast("Repos terminé, c'est reparti !"); }
  const btn = document.querySelector('[data-act="skiprest"]');
  if (btn) {
    if (L.restEnd) {
      btn.hidden = false;
      btn.querySelector('[data-tick="rest"]').textContent = "Repos " + fmtDur(L.restEnd - now) + " · Passer";
      btn.querySelector("[data-restbar]").style.width = Math.max(0, Math.min(100, 100 * (L.restEnd - now) / (L.restTotal || 1))) + "%";
    } else btn.hidden = true;
  }
  // chrono (gainage)
  const c = L.chrono;
  if (c) {
    const el = document.querySelector('[data-tick="chrono"]');
    const ms = now - c.start;
    if (el) el.textContent = fmtDur(ms);
    if (!c.alerted && c.target && ms >= c.target * 1000) { c.alerted = true; save(); signal(); toast("Objectif atteint !"); }
  }
}
setInterval(tick, 250);

/* ================= Actions ================= */
$app.addEventListener("submit", e => {
  const f = e.target.closest("[data-form]"); if (!f) return;
  e.preventDefault();
  if (f.dataset.form === "login") onLogin(f, (e.submitter && e.submitter.value) || "in");
});

$app.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const a = b.dataset.act, i = +b.dataset.i, s = +b.dataset.s;
  const w = currentWorkout();
  switch (a) {
    /* connexion */
    case "local": db.mode = "local"; saveNow(); render(); break;
    case "tologin": db.mode = null; saveNow(); render(); break;
    case "logout": {
      if (!await ask({ title: "Se déconnecter ?", text: "Tes données restent enregistrées dans ton compte. Elles seront effacées de cet appareil.", ok: "Se déconnecter", danger: true })) return;
      flushPending(); await sync();
      if (Object.values(db.items).some(x => x.dirty) && !await ask({ title: "Modifications non envoyées", text: "Certaines modifications n'ont pas pu être envoyées (pas de réseau ?). Se déconnecter quand même ?", ok: "Oui", danger: true })) return;
      db = emptyDb(); saveNow(); go("home"); render(); break;
    }
    case "syncnow": flushPending(); await sync(); if (syncState.status === "ok") toast("Synchronisé"); break;

    /* accueil */
    case "start": startWorkout(b.dataset.t, b.dataset.v); break;

    /* séance */
    case "done": if (w) markDone(w, i, s); break;
    case "addset": if (w) { const ex = w.exercises[i]; ex.sets.push(blankSet()); put("workout", w); render(); } break;
    case "delset": if (w) { const ex = w.exercises[i]; if (ex.sets.length > 1) { ex.sets.pop(); put("workout", w); render(); } } break;
    case "rename": if (w) {
      const ex = w.exercises[i];
      const n = await ask({ title: "Renommer l'exercice", input: ex.name, ok: "Renommer" });
      if (!n) return;
      ex.name = n; put("workout", w);
      const t = getItem(w.templateId), te = tplExercise(w, ex.exId);
      if (t && te) { te.name = n; put("template", t); }
      render();
    } break;
    case "addex": if (w) {
      const n = await ask({ title: "Nouvel exercice", input: "", ok: "Ajouter" });
      if (!n) return;
      const te = Object.assign(newExercise(), { name: n });
      const add = await ask({ title: "L'ajouter au programme ?", text: "L'ajouter aussi à « " + w.templateName + " · " + w.variantName + " » pour les prochaines fois ?", ok: "Oui", cancel: "Juste aujourd'hui" });
      if (add) { const t = getItem(w.templateId); const v = t && t.variants.find(x => x.id === w.variantId); if (v) { v.exercises.push(te); put("template", t); } }
      w.exercises.push({ exId: te.id, name: te.name, type: te.type, target: te.target, rest: te.rest, sets: Array.from({ length: te.sets }, blankSet) });
      put("workout", w); render();
    } break;
    case "chrono": if (w) {
      const c = db.live.chrono;
      if (c && c.wid === w.id && c.i === i && c.s === s) {
        const sec = Math.round((Date.now() - c.start) / 1000);
        db.live.chrono = null;
        const set = w.exercises[i].sets[s]; set.sec = String(sec); set.done = true;
        if (!w.endedAt) startRest(w.exercises[i].rest);
        put("workout", w);
      } else {
        db.live.chrono = { wid: w.id, i, s, start: Date.now(), target: num(w.exercises[i].target), alerted: false };
        db.live.restEnd = null;
      }
      save(); render();
    } break;
    case "skiprest": db.live.restEnd = null; save(); tick(); break;
    case "finish": if (w) {
      flushPending();
      if (!await ask({ title: "Terminer la séance ?", text: "Elle sera enregistrée dans ton historique.", ok: "Terminer" })) return;
      w.endedAt = Date.now(); put("workout", w); db.live = {}; save(); sync();
      toast("Séance enregistrée"); go("home");
    } break;
    case "cancel": if (w) {
      if (!await ask({ title: "Annuler la séance ?", text: "Elle ne sera pas enregistrée.", ok: "Annuler la séance", cancel: "Continuer", danger: true })) return;
      remove(w.id); db.live = {}; save(); go("home");
    } break;
    case "delworkout": if (w) {
      if (!await ask({ title: "Supprimer cette séance ?", text: "Elle disparaîtra de l'historique.", ok: "Supprimer", danger: true })) return;
      remove(w.id); go("history");
    } break;

    /* programmes */
    case "newtpl": {
      const n = await ask({ title: "Nouvelle séance", input: "", ok: "Créer" });
      if (!n) return;
      const t = { id: "tpl-" + uid(), name: n, order: templates().length, variants: [1, 2, 3].map(k => ({ id: "v" + k, name: "Variante " + k, exercises: [] })) };
      put("template", t); go("program/" + t.id);
    } break;
    case "tab": { const { t } = currentProgram(); if (t) go("program/" + t.id + "/" + b.dataset.v); } break;
    case "addvar": { const { t } = currentProgram(); if (!t) return; const v = { id: "v" + uid(), name: "Variante " + (t.variants.length + 1), exercises: [] }; t.variants.push(v); put("template", t); go("program/" + t.id + "/" + v.id); } break;
    case "dupvar": { const { t, v } = currentProgram(); if (!v) return; const c = { id: "v" + uid(), name: v.name + " (copie)", exercises: v.exercises.map(e => Object.assign({}, e, { id: "e-" + uid() })) }; t.variants.push(c); put("template", t); go("program/" + t.id + "/" + c.id); } break;
    case "delvar": { const { t, v } = currentProgram(); if (!v || t.variants.length < 2) return; if (!await ask({ title: "Supprimer « " + v.name + " » ?", text: "L'historique des séances déjà faites est conservé.", ok: "Supprimer", danger: true })) return; t.variants = t.variants.filter(x => x !== v); put("template", t); go("program/" + t.id); } break;
    case "addtplex": { const { t, v } = currentProgram(); if (!v) return; v.exercises.push(newExercise()); put("template", t); render(); const ins = $app.querySelectorAll('[data-p="name"]'); const last = ins[ins.length - 1]; if (last) { last.focus(); last.select(); } } break;
    case "delex": { const { t, v } = currentProgram(); if (!v) return; const ex = v.exercises[+b.dataset.e]; if (!await ask({ title: "Supprimer « " + ex.name + " » ?", ok: "Supprimer", danger: true })) return; v.exercises.splice(+b.dataset.e, 1); put("template", t); render(); } break;
    case "up": case "down": { const { t, v } = currentProgram(); if (!v) return; const k = +b.dataset.e, j = a === "up" ? k - 1 : k + 1; if (j < 0 || j >= v.exercises.length) return; const x = v.exercises[k]; v.exercises[k] = v.exercises[j]; v.exercises[j] = x; put("template", t); render(); } break;
    case "deltpl": { const { t } = currentProgram(); if (!t) return; if (!await ask({ title: "Supprimer « " + t.name + " » ?", text: "Ses variantes et exercices seront supprimés. L'historique des séances déjà faites est conservé.", ok: "Supprimer", danger: true })) return; remove(t.id); go("programs"); } break;

    /* réglages */
    case "set": setSetting(b.dataset.k, b.dataset.val); break;
    case "testalert": audio(); if (settings().alert === "aucune") toast("Alerte désactivée"); else signal(); break;
    case "export": {
      flushPending();
      const data = JSON.stringify({ app: "muscuapp", v: 1, at: Date.now(), items: Object.values(db.items).filter(x => !x.deleted).map(x => ({ id: x.id, kind: x.kind, data: x.data, updated_at: x.updated_at })) });
      try { await navigator.clipboard.writeText(data); toast("Sauvegarde copiée : colle-la dans une note"); }
      catch (err) { await ask({ title: "Sauvegarde", text: "Copie ce texte :", input: data, multiline: true, cancel: false, ok: "Fermer" }); }
    } break;
    case "import": {
      const txt = await ask({ title: "Restaurer une sauvegarde", text: "Colle le texte de la sauvegarde. Les éléments plus récents de la sauvegarde remplacent ceux de l'appli.", input: "", multiline: true, ok: "Restaurer" });
      if (!txt) return;
      try {
        const j = JSON.parse(txt); if (!j || j.app !== "muscuapp" || !Array.isArray(j.items)) throw new Error();
        let n = 0;
        for (const it of j.items) { const cur = db.items[it.id]; if (!cur || it.updated_at > cur.updated_at) { db.items[it.id] = { id: it.id, kind: it.kind, data: it.data, updated_at: Math.max(it.updated_at, (cur && cur.updated_at + 1) || 0), deleted: false, dirty: true }; n++; } }
        saveNow(); scheduleSync(); render(); toast(n + " élément" + (n > 1 ? "s" : "") + " restauré" + (n > 1 ? "s" : ""));
      } catch (err) { toast("Ce texte n'est pas une sauvegarde valide"); }
    } break;
  }
});

/* Saisie au clavier : enregistre sans redessiner l'écran (on garde le focus) */
$app.addEventListener("input", e => {
  const el = e.target;
  if (el.dataset.f) {
    const w = currentWorkout(); if (!w) return;
    const ex = w.exercises[+el.dataset.i]; if (!ex) return;
    if (el.dataset.f === "note") {
      const t = getItem(w.templateId), te = tplExercise(w, ex.exId);
      if (t && te) { te.note = el.value; putLater("template", t); } else { ex.note = el.value; putLater("workout", w); }
      return;
    }
    ex.sets[+el.dataset.s][el.dataset.f] = el.value.replace(/[^\d.,]/g, "");
    if (el.value !== ex.sets[+el.dataset.s][el.dataset.f]) el.value = ex.sets[+el.dataset.s][el.dataset.f];
    putLater("workout", w);
    return;
  }
  if (el.dataset.p) {
    const { t, v } = currentProgram(); if (!t) return;
    const p = el.dataset.p;
    if (p === "tname") { t.name = el.value; putLater("template", t); return; }
    if (p === "vname") { v.name = el.value; putLater("template", t); const tab = $app.querySelector("[data-vtab]"); if (tab) tab.textContent = el.value; return; }
    const ex = v.exercises[+el.dataset.e]; if (!ex) return;
    if (p === "type") return; // géré par « change »
    if (p === "name") { const ti = $app.querySelector('[data-title="' + el.dataset.e + '"]'); if (ti) ti.textContent = el.value; }
    ex[p] = (p === "sets" || p === "rest") ? (num(el.value) == null ? "" : Math.max(0, Math.round(num(el.value)))) : el.value;
    putLater("template", t);
  }
});
$app.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.p === "type") {
    const { t, v } = currentProgram(); if (!t) return;
    const ex = v.exercises[+el.dataset.e]; ex.type = el.value;
    if (ex.type === "time" && !/^\d+$/.test(String(ex.target))) ex.target = "45";
    put("template", t); render();
  } else if (el.dataset.p || el.dataset.f) {
    flushPending(); // enregistre tout de suite quand on quitte un champ (sans redessiner l'écran)
  }
});
// Entrée dans un champ de série : passe au champ suivant
$app.addEventListener("keydown", e => {
  if (e.key !== "Enter" || !e.target.dataset.f || e.target.tagName !== "INPUT") return;
  e.preventDefault();
  const ins = Array.from($app.querySelectorAll("input[data-f]"));
  const n = ins[ins.indexOf(e.target) + 1];
  if (n) n.focus(); else e.target.blur();
});

/* ================= Démarrage ================= */
applyTheme();
render();
if (db.auth) sync();
if ("serviceWorker" in navigator && location.protocol === "https:" && !Native && !window.claude) {
  navigator.serviceWorker.register("sw.js").catch(() => { });
}
