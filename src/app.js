"use strict";
/* MuscuApp — suivi des séances de musculation.
   Données gardées sur l'appareil (localStorage) et synchronisées avec Supabase quand on est connecté. */

const SUPABASE_URL = "https://krszgabjpswqjtypalsn.supabase.co";
const SUPABASE_KEY = "sb_publishable_cb_B1dUxgdE-zO1qRjp7tA_BWTYMgUs"; // clé publique (sans danger)
const DB_KEY = "muscuapp-v1";
const WIDE = 900; // largeur (px) à partir de laquelle la séance s'affiche en tableau
const Native = window.AndroidBridge || null;
const $app = document.getElementById("app");
let flashTimer = null; // clignotement de fin de repos

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
      db.items[id] = { id, kind: "template", updated_at: 0, deleted: false, dirty: false, data: { id, name, order: k, variants: [1, 2, 3].map(n => ({ id: "v" + n, name: "Séance " + n, exercises: [] })) } };
    });
  }
  db.seeded = true; save();
}
function migrate() {
  if (db.items["tpl-amanda"]) return false; // déjà créée (ou supprimée volontairement)
  const ex = [
    ["Traction prise neutre assistée", "reps", "8-10", 90, ""],
    ["Dips assistés", "reps", "8-10", 90, ""],
    ["Hip thrust (hold 1 s)", "reps", "10-12", 90, "Tenir 1 s en haut"],
    ["Rear kick debout avec appui", "reps", "12-15", 60, "Je pousse avec une jambe"],
    ["Abduction hanche (machine)", "reps", "12-15", 60, ""],
    ["Lombaires", "reps", "12-15", 60, ""],
    ["Gainage", "time", "45", 60, ""],
  ];
  const data = { id: "tpl-amanda", name: "Amanda", order: 5, variants: [{ id: "v1", name: "Séance 1",
    exercises: ex.map((x, k) => ({ id: "e-amanda-" + (k + 1), name: x[0], type: x[1], sets: 3, target: x[2], rest: x[3], note: x[4] })) }] };
  // updated_at 1 : une version déjà modifiée sur un autre appareil l'emporte toujours
  db.items["tpl-amanda"] = { id: "tpl-amanda", kind: "template", data, updated_at: 1, deleted: false, dirty: true };
  save(); scheduleSync();
  return true;
}
// anciens noms « Variante N » → « Séance N » (affichage, et renommage enregistré quand les données sont à jour)
const vLabel = n => String(n == null ? "" : n).replace(/^Variante(?=\s|$)/i, "Séance");
function renameVariants() {
  for (const it of Object.values(db.items)) {
    if (it.kind !== "template" || it.deleted) continue;
    let ch = false;
    it.data.variants.forEach(v => { const n = vLabel(v.name); if (n !== v.name) { v.name = n; ch = true; } });
    if (!ch) continue;
    if (it.updated_at === 0) save(); // modèle vide jamais envoyé : on renomme sur place
    else put("template", it.data);
  }
}
const templates = () => all("template").sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
const workouts = () => all("workout").sort((a, b) => b.startedAt - a.startedAt);
const finished = () => workouts().filter(w => w.endedAt);
const activeWorkout = () => workouts().find(w => !w.endedAt) || null;
function settings() { return Object.assign({ id: "settings", theme: "auto", alert: "vibration", goal: "5" }, getItem("settings") || {}); }
function setSetting(k, v) { const s = settings(); s[k] = v; put("settings", s); applyTheme(); render(); }
const newExercise = () => ({ id: "e-" + uid(), name: "Nouvel exercice", type: "reps", sets: 3, target: "8-10", rest: 90, note: "" });
const blankSet = drops => ({ kg: "", reps: "", sec: "", done: false, drops: Array.from({ length: Math.max(0, num(drops) || 0) }, () => ({ kg: "", reps: "" })) });
const GROUP_LABEL = { superset: "Superset", biset: "Biset", triset: "Triset" };
const GROUP_SIZE = { superset: 2, biset: 2, triset: 3 };
const LETTERS = "ABCDEFGH";
// regroupe les exercices consécutifs d'un même superset / biset / triset
function blocks(list) {
  const out = [];
  list.forEach((e, i) => {
    const last = out[out.length - 1];
    if (e.groupId && last && last.groupId === e.groupId) last.items.push({ e, i });
    else out.push({ groupId: e.groupId || null, kind: e.groupKind || null, items: [{ e, i }] });
  });
  out.forEach(b => { if (b.items.length < 2) b.groupId = null; });
  return out;
}
function knownNames() {
  const set = new Set();
  all("template").forEach(t => t.variants.forEach(v => v.exercises.forEach(e => e.name && set.add(e.name.trim()))));
  all("workout").forEach(w => w.exercises.forEach(e => e.name && set.add(e.name.trim())));
  return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
}
// un groupe de moins de 2 exercices redevient un exercice simple ; un groupe de 3+ est un triset
function cleanGroups(v) {
  const cnt = {};
  v.exercises.forEach(e => { if (e.groupId) cnt[e.groupId] = (cnt[e.groupId] || 0) + 1; });
  v.exercises.forEach(e => {
    if (!e.groupId) return;
    if (cnt[e.groupId] < 2) { delete e.groupId; delete e.groupKind; }
    else if (cnt[e.groupId] >= 3) e.groupKind = "triset";
    else if (e.groupKind === "triset") e.groupKind = "superset";
  });
}
function tplExercise(w, exId) {
  const t = getItem(w.templateId); if (!t) return null;
  const v = t.variants.find(x => x.id === w.variantId); if (!v) return null;
  return v.exercises.find(e => e.id === exId) || null;
}
const setHasData = (s, type) => type === "time" ? num(s.sec) != null : (num(s.kg) != null || num(s.reps) != null);
const exHasData = e => e.sets.some(s => setHasData(s, e.type));

function oneLabel(s, type) {
  if (type === "time") return num(s.sec) != null ? fmtNum(num(s.sec)) + " s" : "—";
  const kg = num(s.kg), r = num(s.reps);
  if (kg != null && r != null) return fmtNum(kg) + " kg × " + fmtNum(r);
  if (r != null) return fmtNum(r) + " reps";
  if (kg != null) return fmtNum(kg) + " kg";
  return "—";
}
function setLabel(s, type) {
  let t = oneLabel(s, type);
  (s.drops || []).forEach(d => { if (setHasData(d, type)) t += " ↘ " + oneLabel(d, type); });
  return t;
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
  if (flashTimer) return; // pendant le clignotement de fin de repos
  const t = settings().theme;
  const dark = t === "sombre" || (t === "auto" && darkQuery && darkQuery.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = dark ? "#08080D" : "#F4F2F8";
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
    if (migrate()) changed = true;
    renameVariants(); // après la récupération : les données sont à jour, aucun risque d'écraser une modif récente
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

const NAV = [["home", "Accueil", "home"], ["programs", "Programmes", "list"], ["history", "Historique", "clock"], ["progress", "Stats", "chart"], ["settings", "Réglages", "gear"]];
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
  migrate();
  if (!db.auth) renameVariants();
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
  return '<div class="login"><img class="logo" src="icon-192.png" alt="" width="72" height="72"><h1>Muscu</h1>' +
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
    h += '<div class="hero"><div class="small" style="opacity:.75">Séance en cours</div><div style="font-size:21px;font-weight:800;margin-top:2px">' + esc(act.templateName) + " · " + esc(vLabel(act.variantName)) + "</div>" +
      '<div class="small" style="opacity:.8;margin-top:4px">Commencée à ' + fmtTime(act.startedAt) + ' · <span class="num" data-tick="elapsed" data-id="' + act.id + '"></span></div>' +
      '<a class="btn primary block big" href="#/session/' + act.id + '">Reprendre la séance</a></div>';
  }
  const ts = templates();
  h += '<div class="section-title">Mes programmes</div><div class="stack">';
  if (!ts.length) h += '<div class="card empty">Aucun programme. Crée-en un dans <a href="#/programs">Programmes</a>.</div>';
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
      '<span class="muted small">' + (lastAny ? "Dernière : " + esc(fmtDate(lastAny.last.startedAt)) + " (" + esc(vLabel(lastAny.v.name)) + ")" : "Jamais faite") + "</span></div>" +
      '<div class="variants">' + st.map(x => {
        const n = x.v.exercises.length;
        return '<button class="variant' + (x.v.id === sugg ? " sugg" : "") + '" data-act="start" data-t="' + t.id + '" data-v="' + x.v.id + '"><b>' + esc(vLabel(x.v.name)) + "</b>" +
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
  if (!v.exercises.length) { toast("Ajoute d'abord des exercices à cette séance"); go("program/" + tid + "/" + vid); return; }
  const act = activeWorkout();
  if (act) {
    const ok = await ask({ title: "Une séance est déjà en cours", text: act.templateName + " · " + vLabel(act.variantName) + "\nLa terminer et commencer celle-ci ?", ok: "Oui, la terminer" });
    if (!ok) return;
    act.endedAt = Date.now(); put("workout", act);
  }
  const w = {
    id: "w-" + uid(), templateId: t.id, variantId: v.id, templateName: t.name, variantName: v.name, startedAt: Date.now(), endedAt: null,
    exercises: v.exercises.map(e => ({ exId: e.id, name: e.name, type: e.type, target: e.target, rest: e.rest, drops: num(e.drops) || 0, groupId: e.groupId || null, groupKind: e.groupKind || null,
      sets: Array.from({ length: Math.max(1, num(e.sets) || 1) }, () => blankSet(e.drops)) })),
  };
  put("workout", w);
  db.live = {}; save();
  go("session/" + w.id);
}

/* ================= Écran : séance ================= */
// valeurs de la dernière fois, affichées en grisé dans les champs vides (d = numéro de baisse en dégressif)
function phOf(w, e, s, d) {
  const lp = lastPerf(w, e);
  let src = lp && lp.e.sets[s];
  if (src && d != null) src = src.drops && src.drops[d];
  const has = src && setHasData(src, e.type);
  const f = k => (has && num(src[k]) != null ? fmtNum(num(src[k])) : null);
  return { kg: f("kg") || "kg", reps: f("reps") || "reps", sec: f("sec") || "s" };
}
function inputsHtml(w, e, i, k, d, label) {
  const s = e.sets[k], v = d == null ? s : ((s.drops || [])[d] || {}), ph = phOf(w, e, k, d);
  const a = ' data-i="' + i + '" data-s="' + k + '"' + (d == null ? "" : ' data-d="' + d + '"');
  if (e.type === "time") return '<input inputmode="numeric" aria-label="Temps ' + label + '" data-f="sec"' + a + ' value="' + esc(v.sec) + '" placeholder="' + esc(ph.sec) + '">';
  return '<input inputmode="decimal" aria-label="Kilos ' + label + '" data-f="kg"' + a + ' value="' + esc(v.kg) + '" placeholder="' + esc(ph.kg) + '">' +
    '<input inputmode="numeric" aria-label="Répétitions ' + label + '" data-f="reps"' + a + ' value="' + esc(v.reps) + '" placeholder="' + esc(ph.reps) + '">';
}
function chronoBtn(w, i, s) {
  const c = db.live.chrono, run = c && c.wid === w.id && c.i === i && c.s === s;
  return '<button class="chrono' + (run ? " run" : "") + '" data-act="chrono" data-i="' + i + '" data-s="' + s + '" aria-label="' + (run ? "Arrêter le chrono" : "Lancer le chrono") + '">' +
    (run ? ICON.stop + '<span class="num" data-tick="chrono">0:00</span>' : ICON.play + "<span>Démarrer chrono</span>") + "</button>";
}
function okBtn(s, i, k) {
  return '<button class="ok' + (s.done ? " on" : "") + '" data-act="done" data-i="' + i + '" data-s="' + k + '" aria-label="Valider la série ' + (k + 1) + '" aria-pressed="' + !!s.done + '">✓</button>';
}
// une série (et ses baisses) dans la grille des cartes
function setRows(w, e, i, k, label) {
  const s = e.sets[k], d = s.done ? " done-row" : "";
  let h = '<div class="n">' + label + '</div><div class="set' + d + '">' + inputsHtml(w, e, i, k, null, "série " + (k + 1)) + (e.type === "time" ? chronoBtn(w, i, k) : "") + "</div>" + okBtn(s, i, k);
  (s.drops || []).forEach((x, n) => {
    h += '<div class="n drop" title="Baisse ' + (n + 1) + '">↘</div><div class="set' + d + '">' + inputsHtml(w, e, i, k, n, "série " + (k + 1) + " baisse " + (n + 1)) + "</div><div></div>";
  });
  return h;
}
function metaText(e, inGroup) {
  const time = e.type === "time";
  let t = inGroup ? "Cible " + esc(e.target || "—") + (time ? " s" : " reps") : e.sets.length + " × " + esc(e.target || "—") + (time ? " s" : "") + " · repos " + esc(fmtRest(e.rest));
  const d = num(e.drops) || 0;
  if (d) t += " · dégressif (" + d + " baisse" + (d > 1 ? "s" : "") + ")";
  return t;
}
function exHead(w, e, i, letter) {
  return '<div class="spread"><div class="ex-name">' + (letter ? '<span class="letter">' + letter + "</span>" : "") + esc(e.name) + '</div><button class="link" data-act="rename" data-i="' + i + '">Renommer</button></div>' +
    '<div class="ex-meta">' + metaText(e, !!letter) + "</div>";
}
function setActions(idx, count, word) {
  const g = idx.join(",");
  return '<div class="ex-actions"><button class="btn sm" data-act="addset" data-g="' + g + '">+ ' + word + "</button>" +
    (count > 1 ? '<button class="btn sm" data-act="delset" data-g="' + g + '">− ' + word + "</button>" : "") + "</div>";
}
function noteBox(w, e, i, letter) {
  const te = tplExercise(w, e.exId), note = te ? te.note : (e.note || "");
  return '<textarea class="f" data-f="note" data-i="' + i + '" placeholder="Notes' + (letter ? " " + letter + " · " + esc(e.name) : " (réglages, sensations…)") + '" aria-label="Notes ' + esc(e.name) + '">' + esc(note) + "</textarea>";
}
function exCard(w, e, i) {
  let rows = '<div class="h">Série</div><div class="h hdr">' + (e.type === "time" ? "<span>Temps (s)</span>" : "<span>Kg</span><span>Reps</span>") + '</div><div class="h"></div>';
  e.sets.forEach((s, k) => { rows += setRows(w, e, i, k, k + 1); });
  return '<section class="card ex">' + exHead(w, e, i, "") + '<div class="sets">' + rows + "</div>" + setActions([i], e.sets.length, "Série") + noteBox(w, e, i, "") + "</section>";
}
function groupCard(w, blk) {
  const first = blk.items[0].e, rounds = Math.max(...blk.items.map(x => x.e.sets.length));
  let h = '<section class="card ex group"><div class="group-tag">' + esc(GROUP_LABEL[first.groupKind] || "Enchaînement") + " · " + rounds + " tour" + (rounds > 1 ? "s" : "") +
    " · repos " + esc(fmtRest(first.rest)) + " après chaque tour</div>";
  blk.items.forEach((x, n) => { h += '<div class="member">' + exHead(w, x.e, x.i, LETTERS[n]) + "</div>"; });
  for (let k = 0; k < rounds; k++) {
    h += '<div class="round-title">Tour ' + (k + 1) + '</div><div class="sets">';
    blk.items.forEach((x, n) => { if (x.e.sets[k]) h += setRows(w, x.e, x.i, k, LETTERS[n]); });
    h += "</div>";
  }
  h += setActions(blk.items.map(x => x.i), rounds, "Tour");
  blk.items.forEach((x, n) => { h += noteBox(w, x.e, x.i, LETTERS[n]); });
  return h + "</section>";
}
function viewSession(id) {
  const w = getItem(id);
  if (!w) return { html: '<a class="back" href="#/home">‹ Accueil</a><div class="card empty">Séance introuvable.</div>', wide: false, active: false };
  const active = !w.endedAt;
  const wide = window.innerWidth >= WIDE;
  let h = '<div class="spread"><a class="back" href="#/' + (active ? "home" : "history") + '">‹ ' + (active ? "Accueil" : "Historique") + "</a>" +
    (active ? '<button class="btn sm primary" data-act="finish">Terminer la séance</button>' : "") + "</div>" +
    '<div class="page-head"><div><div class="muted small">' + esc(vLabel(w.variantName)) + " · " + esc(fmtDateLong(w.startedAt)) + "</div><h1>" + esc(w.templateName) + "</h1></div>" +
    '<div class="row"><span class="num" style="font-size:18px;font-weight:700" data-tick="elapsed" data-id="' + w.id + '"></span>' +
    (active ? '<button class="btn sm" data-act="cancel">Annuler</button>' : "") + "</div></div>";
  if (!active) h += '<div class="banner">Séance terminée. Tu peux encore corriger les valeurs.</div>';
  h += wide ? sessionTable(w) : sessionCards(w);
  h += '<div style="margin-top:16px" class="row"><button class="btn" data-act="addex">+ Ajouter un exercice à cette séance</button></div>';
  if (active) h += '<div class="restpop" data-restpop hidden><div class="rp-box" role="timer" aria-label="Minuteur de repos"><div class="rp-label">Repos</div>' +
    '<div class="rp-time num" data-rptime>0:00</div><div class="rp-bar"><span data-rpbar></span></div>' +
    '<div class="rp-btns"><button class="rp-b" data-act="restadd" data-v="-15">−15 s</button><button class="rp-b rp-go" data-act="skiprest">Passer</button><button class="rp-b" data-act="restadd" data-v="15">+15 s</button></div>' +
    '<button class="rp-min" data-act="restmin">Réduire</button></div></div>' +
    '<button class="restpill num" data-restpill data-act="restmax" hidden></button>' +
    '<div class="restpop" data-chronopop hidden><div class="rp-box gain-box" role="timer" aria-label="Chrono de gainage"><div class="rp-label">Gainage</div><div class="rp-sub" data-cpname></div>' +
    '<div class="rp-time num" data-cptime>0:00</div><div class="rp-bar"><span data-cpbar></span></div><div class="rp-sub" data-cpgoal style="margin-top:10px"></div>' +
    '<div class="rp-btns"><button class="rp-b" data-act="chronocancel">Annuler</button><button class="rp-b rp-go" data-act="chronostop">Terminer</button></div>' +
    '<button class="rp-min" data-act="chronomin">Réduire</button></div></div>' +
    '<button class="restpill gain num" data-chronopill data-act="chronomax" hidden></button>';
  else h += '<div class="bottom-bar"><div class="inner"><button class="btn danger big" data-act="delworkout" style="flex:1">Supprimer cette séance</button></div></div>';
  return { html: h, wide, active };
}
function sessionCards(w) {
  return '<div class="stack">' + blocks(w.exercises).map(b => b.groupId ? groupCard(w, b) : exCard(w, b.items[0].e, b.items[0].i)).join("") + "</div>";
}
function sessionTable(w) {
  const max = Math.max(1, ...w.exercises.map(e => e.sets.length));
  let h = '<div class="table-wrap"><table class="grid"><thead><tr><th>Exercice</th><th>Séries</th><th>Reps cible</th><th>Repos</th>';
  for (let k = 0; k < max; k++) h += "<th>Série " + (k + 1) + "</th>";
  h += "<th>Notes</th></tr></thead><tbody>";
  blocks(w.exercises).forEach(b => {
    const idx = b.items.map(x => x.i);
    b.items.forEach((x, n) => {
      const e = x.e, i = x.i, time = e.type === "time", grouped = !!b.groupId, lastOfGroup = n === b.items.length - 1;
      h += '<tr class="' + (grouped && !lastOfGroup ? "chained" : "") + '"><td>' +
        (grouped ? '<div class="gtag">' + esc(GROUP_LABEL[e.groupKind] || "Enchaînement") + " · " + LETTERS[n] + "</div>" : "") +
        '<div class="spread" style="align-items:flex-start"><b style="font-size:15px">' + esc(e.name) + '</b><button class="link" data-act="rename" data-i="' + i + '">Renommer</button></div>' +
        (num(e.drops) ? '<div class="muted small">Dégressif · ' + e.drops + " baisse" + (e.drops > 1 ? "s" : "") + "</div>" : "") +
        (!grouped || lastOfGroup ? setActions(grouped ? idx : [i], e.sets.length, grouped ? "Tour" : "Série") : "") + "</td>" +
        "<td>" + e.sets.length + "</td><td>" + esc(e.target || "—") + (time ? " s" : "") + "</td><td>" + (grouped && !lastOfGroup ? "enchaîné" : esc(fmtRest(e.rest))) + "</td>";
      for (let k = 0; k < max; k++) {
        const s = e.sets[k];
        if (!s) { h += "<td></td>"; continue; }
        const d = s.done ? " done-row" : "";
        h += '<td><div class="cellwrap"><div class="cell' + d + '">' + inputsHtml(w, e, i, k, null, "série " + (k + 1)) + (time ? chronoBtn(w, i, k) : "") + okBtn(s, i, k) + "</div>" +
          (s.drops || []).map((y, m) => '<div class="cell drop' + d + '"><span class="dl" aria-hidden="true">↘</span>' + inputsHtml(w, e, i, k, m, "série " + (k + 1) + " baisse " + (m + 1)) + "</div>").join("") + "</div></td>";
      }
      h += "<td>" + noteBox(w, e, i, grouped ? LETTERS[n] : "") + "</td></tr>";
    });
  });
  return h + "</tbody></table></div>";
}
function currentWorkout() { const r = route(); return r.name === "session" ? getItem(r.args[0]) : null; }
function fillFrom(set, src, type) {
  if (!src) return;
  for (const f of type === "time" ? ["sec"] : ["kg", "reps"]) if ((set[f] === "" || set[f] == null) && src[f] !== "" && src[f] != null) set[f] = src[f];
}
function markDone(w, i, s) {
  const e = w.exercises[i], set = e.sets[s];
  if (!set.done) {
    // champs vides : on reprend la dernière performance (ou la série précédente)
    const lp = lastPerf(w, e);
    const src = (lp && lp.e.sets[s]) || e.sets[s - 1] || null;
    fillFrom(set, src, e.type);
    (set.drops || []).forEach((d, n) => fillFrom(d, src && src.drops && src.drops[n], e.type));
    set.done = true;
    afterSet(w, i, s);
  } else set.done = false;
  put("workout", w);
  render();
}
// repos : après chaque série, ou seulement à la fin du tour pour un superset / biset / triset
function afterSet(w, i, s) {
  if (w.endedAt) return;
  const e = w.exercises[i];
  if (e.groupId) {
    const mem = w.exercises.filter(x => x.groupId === e.groupId);
    if (!mem.every(x => !x.sets[s] || x.sets[s].done)) return;
    startRest(mem[0].rest);
  } else startRest(e.rest);
}
// arrête le chrono de gainage : le temps est noté dans la série, qui est validée, puis le repos démarre
function stopChrono(w) {
  const c = db.live.chrono; if (!c || c.wid !== w.id) return;
  const set = w.exercises[c.i] && w.exercises[c.i].sets[c.s];
  db.live.chrono = null;
  if (!set) return;
  set.sec = String(Math.round((Date.now() - c.start) / 1000)); set.done = true;
  afterSet(w, c.i, c.s);
  put("workout", w);
}
function startRest(sec) {
  sec = num(sec) || 0;
  if (sec <= 0) return;
  db.live.restEnd = Date.now() + sec * 1000; db.live.restTotal = sec * 1000; db.live.restAlerted = false; db.live.restMin = false; save();
}

/* ================= Écran : programmes ================= */
function viewPrograms() {
  const ts = templates();
  return '<div class="page-head"><h1>Programmes</h1><button class="btn primary" data-act="newtpl">+ Nouveau programme</button></div>' +
    '<p class="muted small">Tes programmes et leurs séances. Les modifications servent pour les prochaines fois.</p>' +
    '<div class="list">' + (ts.length ? ts.map(t => '<a href="#/program/' + t.id + '"><div><b>' + esc(t.name) + '</b><div class="muted small">' +
      t.variants.map(v => esc(vLabel(v.name)) + " : " + v.exercises.length + " exo").join(" · ") + '</div></div><span class="muted">›</span></a>').join("") : '<div class="empty">Aucun programme.</div>') + "</div>";
}
function exFields(e, k, letter, inGroup) {
  const time = e.type === "time", d = num(e.drops) || 0;
  return (inGroup ? '<div class="spread"><b><span class="letter">' + letter + '</span><span data-title="' + k + '">' + esc(e.name) + '</span></b><button class="btn sm danger" data-act="delex" data-e="' + k + '">Retirer</button></div>' : "") +
    '<div class="ed-grid"><label class="fl full">Nom<input class="f" list="exnames" autocomplete="off" data-p="name" data-e="' + k + '" value="' + esc(e.name) + '"></label>' +
    '<label class="fl">Type<select class="f" data-p="type" data-e="' + k + '"><option value="reps"' + (!time ? " selected" : "") + '>Poids × reps</option><option value="time"' + (time ? " selected" : "") + ">Temps (gainage)</option></select></label>" +
    (inGroup ? "" : '<label class="fl">Séries<input class="f" type="number" min="1" max="20" inputmode="numeric" data-p="sets" data-e="' + k + '" value="' + esc(e.sets) + '"></label>') +
    '<label class="fl">' + (time ? "Temps cible (s)" : "Reps cible") + '<input class="f" data-p="target" data-e="' + k + '" value="' + esc(e.target) + '" placeholder="' + (time ? "45" : "8-10") + '"></label>' +
    (inGroup ? "" : '<label class="fl">Repos (s)<input class="f" type="number" min="0" step="5" inputmode="numeric" data-p="rest" data-e="' + k + '" value="' + esc(e.rest) + '"></label>') +
    (time ? "" : '<label class="fl">Dégressif<select class="f" data-p="drops" data-e="' + k + '">' + [0, 1, 2, 3].map(n => '<option value="' + n + '"' + (d === n ? " selected" : "") + ">" + (n ? "Oui · " + n + " baisse" + (n > 1 ? "s" : "") : "Non") + "</option>").join("") + "</select></label>") +
    '<label class="fl full">Notes<textarea class="f" data-p="note" data-e="' + k + '" placeholder="Réglages de la machine, consignes…">' + esc(e.note) + "</textarea></label></div>";
}
function viewProgram(tid, vid) {
  const t = getItem(tid);
  if (!t) return '<a class="back" href="#/programs">‹ Programmes</a><div class="card empty">Programme introuvable.</div>';
  const v = t.variants.find(x => x.id === vid) || t.variants[0];
  let h = '<a class="back" href="#/programs">‹ Programmes</a>' +
    '<label class="fl" style="margin-top:8px">Nom du programme<input class="f" data-p="tname" value="' + esc(t.name) + '" style="font-size:20px;font-weight:700"></label>' +
    '<div class="section-title">Séances</div><div class="tabs">' +
    t.variants.map(x => '<button class="' + (v && x.id === v.id ? "on" : "") + '" data-act="tab" data-v="' + x.id + '"' + (v && x.id === v.id ? " data-vtab" : "") + ">" + esc(vLabel(x.name)) + "</button>").join("") +
    '<button data-act="addvar">+ Séance</button></div>';
  if (!v) return h;
  h += '<div class="card"><label class="fl">Nom de la séance<input class="f" data-p="vname" value="' + esc(vLabel(v.name)) + '"></label>' +
    '<div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn sm" data-act="dupvar">Dupliquer cette séance</button>' +
    (t.variants.length > 1 ? '<button class="btn sm danger" data-act="delvar">Supprimer cette séance</button>' : "") + "</div></div>";
  h += '<datalist id="exnames">' + knownNames().map(n => '<option value="' + esc(n) + '"></option>').join("") + "</datalist>";
  h += '<div class="section-title">Exercices (' + v.exercises.length + ')</div><div class="stack">';
  const bl = blocks(v.exercises);
  bl.forEach((blk, bi) => {
    const moves = (bi > 0 ? '<button class="btn sm" data-act="up" data-b="' + bi + '" aria-label="Monter">↑</button>' : "") +
      (bi < bl.length - 1 ? '<button class="btn sm" data-act="down" data-b="' + bi + '" aria-label="Descendre">↓</button>' : "");
    if (blk.groupId) {
      const f = blk.items[0].e, fi = blk.items[0].i, label = GROUP_LABEL[f.groupKind] || "Enchaînement";
      h += '<div class="card group"><div class="spread"><div class="group-tag">' + esc(label) + " · " + blk.items.length + ' exercices enchaînés</div><div class="row">' + moves + "</div></div>" +
        '<div class="ed-grid"><label class="fl">Enchaînement<select class="f" data-p="gkind" data-e="' + fi + '">' +
        (blk.items.length >= 3 ? '<option value="triset" selected>Triset</option>' : '<option value="superset"' + (f.groupKind !== "biset" ? " selected" : "") + '>Superset</option><option value="biset"' + (f.groupKind === "biset" ? " selected" : "") + ">Biset</option>") + "</select></label>" +
        '<label class="fl">Tours (séries)<input class="f" type="number" min="1" max="20" inputmode="numeric" data-p="gsets" data-e="' + fi + '" value="' + esc(f.sets) + '"></label>' +
        '<label class="fl">Repos après le tour (s)<input class="f" type="number" min="0" step="5" inputmode="numeric" data-p="grest" data-e="' + fi + '" value="' + esc(f.rest) + '"></label></div>';
      blk.items.forEach((x, n) => { h += '<div class="member">' + exFields(x.e, x.i, LETTERS[n], true) + "</div>"; });
      h += '<div class="row" style="margin-top:12px;flex-wrap:wrap">' + (blk.items.length < 4 ? '<button class="btn sm" data-act="addmember" data-e="' + fi + '">+ Ajouter un exercice au ' + esc(label.toLowerCase()) + "</button>" : "") +
        '<button class="btn sm" data-act="ungroup" data-e="' + fi + '">Séparer</button><button class="btn sm danger" data-act="delgroup" data-e="' + fi + '">Supprimer</button></div></div>';
    } else {
      const x = blk.items[0];
      h += '<div class="card"><div class="spread"><b><span data-title="' + x.i + '">' + esc(x.e.name) + '</span></b><div class="row">' + moves +
        '<button class="btn sm danger" data-act="delex" data-e="' + x.i + '">Supprimer</button></div></div>' + exFields(x.e, x.i, "", false) +
        (bi < bl.length - 1 && !bl[bi + 1].groupId ? '<button class="link" style="margin-top:6px" data-act="link" data-b="' + bi + '">Enchaîner avec l\'exercice suivant (superset / biset)</button>' : "") + "</div>";
    }
  });
  h += '<button class="btn block primary" data-act="addtplex">+ Ajouter un exercice</button></div>' +
    '<div style="margin-top:32px"><button class="btn danger" data-act="deltpl">Supprimer le programme « ' + esc(t.name) + " »</button></div>";
  return h;
}
function moveBlock(v, bi, dir) {
  const bl = blocks(v.exercises), j = bi + dir;
  if (j < 0 || j >= bl.length) return false;
  const x = bl[bi]; bl[bi] = bl[j]; bl[j] = x;
  v.exercises = bl.flatMap(b => b.items.map(it => it.e));
  return true;
}
const ADD_CHOICES = [
  ["simple", "Exercice simple", "Séries classiques avec repos entre chaque série"],
  ["degressif", "Dégressif", "Après la série, tu baisses la charge et tu continues sans repos"],
  ["superset", "Superset", "2 exercices enchaînés sans repos (souvent des muscles opposés)"],
  ["biset", "Biset", "2 exercices enchaînés sans repos pour le même muscle"],
  ["triset", "Triset", "3 exercices enchaînés sans repos"],
];
function choose(title, opts) {
  return new Promise(res => {
    const d = document.createElement("div"); d.className = "modal";
    d.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h3>' + esc(title) + '</h3><div class="stack" style="gap:8px">' +
      opts.map(o => '<button class="btn block choice" data-c="' + o[0] + '"><b>' + esc(o[1]) + "</b>" + (o[2] ? '<span class="choice-desc">' + esc(o[2]) + "</span>" : "") + "</button>").join("") +
      '</div><div class="modal-btns"><button class="btn" data-c="">Annuler</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener("click", e => {
      if (e.target === d) { d.remove(); res(null); return; }
      const b = e.target.closest("[data-c]"); if (b) { d.remove(); res(b.dataset.c || null); }
    });
  });
}
// demande le nom d'un ou plusieurs exercices, avec la liste des exercices déjà connus
function askNames(title, n, text) {
  return new Promise(res => {
    const d = document.createElement("div"); d.className = "modal";
    let f = "";
    for (let k = 0; k < n; k++) f += '<label class="fl">' + (n > 1 ? "Exercice " + LETTERS[k] : "Nom de l'exercice") + '<input class="f" list="exnames-m" autocomplete="off" data-k="' + k + '" placeholder="Choisis ou tape un nom"></label>';
    d.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h3>' + esc(title) + "</h3>" + (text ? "<p>" + esc(text) + "</p>" : "") + f +
      '<datalist id="exnames-m">' + knownNames().map(x => '<option value="' + esc(x) + '"></option>').join("") + "</datalist>" +
      '<p class="msg err" data-m></p><div class="modal-btns"><button class="btn" data-r="0">Annuler</button><button class="btn primary" data-r="1">Ajouter</button></div></div>';
    document.body.appendChild(d);
    const ins = Array.from(d.querySelectorAll("input"));
    ins[0].focus();
    const ok = () => {
      const vals = ins.map(x => x.value.trim());
      if (vals.some(x => !x)) { d.querySelector("[data-m]").textContent = "Donne un nom à chaque exercice."; return; }
      d.remove(); res(vals);
    };
    ins.forEach((x, k) => x.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); if (ins[k + 1]) ins[k + 1].focus(); else ok(); } }));
    d.addEventListener("click", e => {
      if (e.target === d) { d.remove(); res(null); return; }
      const b = e.target.closest("[data-r]"); if (!b) return;
      if (b.dataset.r === "1") ok(); else { d.remove(); res(null); }
    });
  });
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
  return '<a href="#/session/' + w.id + '"><div><b>' + esc(w.templateName) + '</b> <span class="muted">· ' + esc(vLabel(w.variantName)) + '</span><div class="muted small">' +
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
const DAY = 86400000;
function weekStart(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
function prevWeek(t) { const d = new Date(t); d.setDate(d.getDate() - 7); return d.getTime(); }
function viewProgress() {
  const ws = finished(), now = Date.now(), goal = num(settings().goal) || 5;
  let h = '<div class="page-head"><h1>Stats</h1></div>';
  if (!ws.length) return h + '<div class="card empty">Termine une première séance pour voir tes stats.</div>';
  const perWeek = {}; ws.forEach(w => { const k = weekStart(w.startedAt); perWeek[k] = (perWeek[k] || 0) + 1; });
  const cur = weekStart(now), thisWeek = perWeek[cur] || 0;
  const m0 = new Date(now); m0.setHours(0, 0, 0, 0); m0.setDate(1);
  const thisMonth = ws.filter(w => w.startedAt >= m0.getTime()).length;
  // semaines d'affilée avec l'objectif atteint (la semaine en cours compte si l'objectif est déjà atteint)
  let streak = 0, wk = (perWeek[cur] || 0) >= goal ? cur : prevWeek(cur);
  while ((perWeek[wk] || 0) >= goal) { streak++; wk = prevWeek(wk); }
  const durs = ws.map(w => w.endedAt - w.startedAt).filter(d => d > 0 && d < 6 * 3600000);
  const avg = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length / 60000) : null;
  const pct = Math.min(100, Math.round(100 * thisWeek / goal));
  h += '<div class="stats k3">' +
    '<div class="card stat"><div class="muted small">Cette semaine</div><div class="v num">' + thisWeek + " <small>/ " + goal + '</small></div><div class="meter" role="img" aria-label="' + thisWeek + " séances sur " + goal + '"><span style="width:' + pct + '%"></span></div></div>' +
    '<div class="card stat"><div class="muted small">Ce mois-ci</div><div class="v num">' + thisMonth + "</div></div>" +
    '<div class="card stat"><div class="muted small">Au total</div><div class="v num">' + ws.length + "</div></div>" +
    '<div class="card stat"><div class="muted small">Semaines objectif atteint</div><div class="v num">' + streak + " <small>d'affilée</small></div></div>" +
    '<div class="card stat"><div class="muted small">Durée moyenne</div><div class="v num">' + (avg != null ? avg + " <small>min</small>" : "—") + "</div></div>" +
    '<div class="card stat"><div class="muted small">Séries validées</div><div class="v num">' + ws.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.filter(x => x.done).length, 0), 0) + "</div></div>" +
    "</div>";
  // séances par semaine (8 dernières), avec la ligne d'objectif
  const weeks = []; let t = cur; for (let k = 0; k < 8; k++) { weeks.unshift(t); t = prevWeek(t); }
  const vals = weeks.map(k => perWeek[k] || 0), max = Math.max(goal, ...vals, 1);
  const W = 360, H = 150, top = 18, bw = W / weeks.length, y = v => H - (v / max) * (H - top);
  let svg = '<svg class="chart" viewBox="0 0 ' + W + " " + (H + 26) + '" role="img" aria-label="Séances par semaine sur les 8 dernières semaines, objectif ' + goal + '">';
  svg += '<line class="base" x1="0" x2="' + W + '" y1="' + H + '" y2="' + H + '"></line>';
  weeks.forEach((k, n) => {
    const v = vals[n], x = n * bw + bw * 0.22, w = bw * 0.56, d = new Date(k), lab = pad(d.getDate()) + "/" + pad(d.getMonth() + 1);
    const tip = "Semaine du " + lab + " : " + v + " séance" + (v > 1 ? "s" : "");
    svg += "<g><title>" + esc(tip) + "</title>" + '<rect class="hit" x="' + n * bw + '" y="0" width="' + bw + '" height="' + H + '"></rect>';
    if (v > 0) { const hh = H - y(v), r = Math.min(4, hh / 2, w / 2); svg += '<path class="bar' + (k === cur ? "" : " dim") + '" d="M' + x + "," + H + "V" + (y(v) + r) + "Q" + x + "," + y(v) + " " + (x + r) + "," + y(v) + "H" + (x + w - r) + "Q" + (x + w) + "," + y(v) + " " + (x + w) + "," + (y(v) + r) + "V" + H + 'Z"></path>'; }
    svg += '<text x="' + (n * bw + bw / 2) + '" y="' + (H + 18) + '" text-anchor="middle">' + lab + "</text></g>";
    if (k === cur) svg += '<text x="' + (n * bw + bw / 2) + '" y="' + (y(v) - 6) + '" text-anchor="middle" style="font-weight:700;fill:var(--ink)">' + v + "</text>";
  });
  svg += '<line class="goal" x1="0" x2="' + W + '" y1="' + y(goal) + '" y2="' + y(goal) + '"></line><text x="4" y="' + (y(goal) - 6) + '">Objectif ' + goal + "</text></svg>";
  h += '<div class="card" style="margin-top:12px"><div class="muted small" style="font-weight:600;margin-bottom:8px">Séances par semaine</div>' + svg + "</div>";
  // par programme
  const byTpl = {};
  ws.forEach(w => { const k = w.templateId; (byTpl[k] = byTpl[k] || { name: w.templateName, n: 0, last: 0 }); byTpl[k].n++; byTpl[k].last = Math.max(byTpl[k].last, w.startedAt); const t = getItem(k); if (t) byTpl[k].name = t.name; });
  h += '<div class="section-title">Par programme</div><div class="list">' + Object.values(byTpl).sort((a, b) => b.n - a.n).map(x =>
    '<div><div><b>' + esc(x.name) + '</b><div class="muted small">Dernière : ' + esc(fmtDate(x.last)) + '</div></div><span class="num"><b>' + x.n + '</b> <span class="muted small">séance' + (x.n > 1 ? "s" : "") + "</span></span></div>").join("") + "</div>";
  // progression par exercice
  const ps = progressData();
  if (ps.length) h += '<div class="section-title">Progression par exercice</div><div class="list">' + ps.map(p => {
    const vs = p.entries.map(x => x.best).filter(x => x != null);
    const rec = vs.length ? Math.max(...vs) : null;
    return '<a href="#/progress/' + encodeURIComponent(p.key) + '"><div><b>' + esc(p.name) + '</b><div class="muted small">' + p.entries.length + " séance" + (p.entries.length > 1 ? "s" : "") +
      " · dernière " + esc(fmtDate(p.entries[p.entries.length - 1].w.startedAt)) + "</div></div>" +
      '<span class="small"><b>' + (rec != null ? fmtNum(rec) + unitOf(p) : "—") + '</b> <span class="muted">record</span></span></a>';
  }).join("") + "</div>";
  return h;
}
function viewProgressDetail(key) {
  const p = progressData().find(x => x.key === key);
  if (!p) return '<a class="back" href="#/progress">‹ Stats</a><div class="card empty">Pas de données.</div>';
  const vals = p.entries.map(x => x.best).filter(x => x != null);
  const rec = vals.length ? Math.max(...vals) : null;
  const last = p.entries[p.entries.length - 1];
  const pts = p.entries.slice(-16);
  const max = Math.max(1, ...pts.map(x => x.best || 0));
  const W = 360, H = 170, bw = Math.min(W / pts.length, 44), x0 = (W - bw * pts.length) / 2;
  let svg = '<svg class="chart" viewBox="0 0 ' + W + " " + (H + 24) + '" role="img" aria-label="' + esc((p.type === "time" ? "Meilleur temps" : "Charge maximale") + " par séance pour " + p.name) + '">';
  pts.forEach((x, k) => {
    const v = x.best || 0, bh = Math.max(2, (v / max) * (H - 24));
    svg += '<rect class="b' + (v === rec ? " top" : "") + '" x="' + (x0 + k * bw + bw * 0.15) + '" y="' + (H - bh) + '" width="' + (bw * 0.7) + '" height="' + bh + '" rx="4"><title>' + esc(fmtDate(x.w.startedAt) + " : " + (x.best != null ? fmtNum(x.best) + unitOf(p) : "—")) + "</title></rect>";
    if (v === rec || k === pts.length - 1) svg += '<text x="' + (x0 + k * bw + bw / 2) + '" y="' + (H - bh - 6) + '" text-anchor="middle">' + (x.best != null ? fmtNum(x.best) : "") + "</text>";
    if (pts.length <= 12 || k % 2 === 0) {
      const d = new Date(x.w.startedAt);
      svg += '<text x="' + (x0 + k * bw + bw / 2) + '" y="' + (H + 16) + '" text-anchor="middle">' + pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "</text>";
    }
  });
  svg += "</svg>";
  return '<a class="back" href="#/progress">‹ Stats</a><div class="page-head"><h1>' + esc(p.name) + "</h1></div>" +
    '<div class="stats"><div class="card stat"><div class="muted small">Record</div><div class="v">' + (rec != null ? fmtNum(rec) + unitOf(p) : "—") + "</div></div>" +
    '<div class="card stat"><div class="muted small">Dernière séance</div><div class="v">' + (last.best != null ? fmtNum(last.best) + unitOf(p) : "—") + "</div></div></div>" +
    '<div class="card" style="margin-top:12px"><div class="muted small" style="font-weight:600;margin-bottom:8px">' + (p.type === "time" ? "Meilleur temps par séance (s)" : "Charge maximale par séance (kg)") + "</div>" + svg + "</div>" +
    '<div class="section-title">Historique</div><div class="list">' + p.entries.slice().reverse().map(x =>
      '<a href="#/session/' + x.w.id + '"><div><b>' + esc(fmtDate(x.w.startedAt)) + '</b><div class="muted small">' + esc(x.w.templateName) + " · " + esc(vLabel(x.w.variantName)) + '</div></div><span class="small" style="text-align:right">' + esc(exSummary(x.e)) + "</span></a>").join("") + "</div>";
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
    '<div class="card"><b>Objectif de séances par semaine</b><div style="margin-top:10px">' + seg("goal", [["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"], ["6", "6"], ["7", "7"]]) + "</div></div>" +
    '<div class="card"><b>Compte</b><div style="margin-top:8px">' +
    (db.auth ? '<div class="small">Connecté : ' + esc(db.auth.user.email) + "</div><div style=\"margin-top:6px\">" + syncBadge() + '</div><div class="small msg err" data-sync-error>' + (syncState.status === "err" ? esc(syncState.error) : "") + "</div>" +
      '<div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm" data-act="syncnow">Synchroniser maintenant</button><button class="btn sm" data-act="logout">Se déconnecter</button></div>'
      : '<div class="small muted">Sans compte : tes données restent sur cet appareil.</div><button class="btn sm primary" style="margin-top:8px" data-act="tologin">Se connecter / créer un compte</button>') +
    "</div></div>" +
    '<div class="card"><b>Sauvegarde</b><div class="small muted" style="margin-top:4px">Copie de secours de toutes tes données (texte à garder dans une note).</div>' +
    '<div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm" data-act="export">Copier la sauvegarde</button><button class="btn sm" data-act="import">Restaurer…</button></div></div>' +
    '<div class="muted small">' + esc(ver) + '</div><div class="credit">Créé par YL</div></div>';
}

/* ================= Minuteurs ================= */
function tick() {
  const now = Date.now(), L = db.live || {};
  document.querySelectorAll('[data-tick="elapsed"]').forEach(el => { const w = getItem(el.dataset.id); if (w) el.textContent = fmtDur((w.endedAt || now) - w.startedAt); });
  // repos
  if (L.restEnd && now >= L.restEnd && !L.restAlerted) { L.restAlerted = true; L.restEnd = null; L.restMin = false; save(); signal(); restDone(); }
  const pop = document.querySelector("[data-restpop]"), pill = document.querySelector("[data-restpill]");
  if (pop) {
    const on = !!L.restEnd;
    pop.hidden = !on || !!L.restMin;
    if (pill) pill.hidden = !on || !L.restMin;
    if (on) {
      const left = fmtDur(L.restEnd - now);
      pop.querySelector("[data-rptime]").textContent = left;
      pop.querySelector("[data-rpbar]").style.width = Math.max(0, Math.min(100, 100 * (L.restEnd - now) / (L.restTotal || 1))) + "%";
      if (pill) pill.textContent = "Repos " + left + " · Agrandir";
    }
  }
  // chrono (gainage)
  const c = L.chrono;
  const cpop = document.querySelector("[data-chronopop]"), cpill = document.querySelector("[data-chronopill]");
  if (c) {
    const el = document.querySelector('[data-tick="chrono"]');
    const ms = now - c.start;
    if (el) el.textContent = fmtDur(ms);
    if (!c.alerted && c.target && ms >= c.target * 1000) { c.alerted = true; save(); signal(); }
    const w = currentWorkout(), here = w && w.id === c.wid;
    if (cpop) {
      cpop.hidden = !here || !!c.min;
      if (here) {
        const ex = w.exercises[c.i];
        cpop.querySelector("[data-cpname]").textContent = ex && norm(ex.name) !== "gainage" ? ex.name + " · série " + (c.s + 1) : "Série " + (c.s + 1);
        cpop.querySelector("[data-cptime]").textContent = fmtDur(ms);
        cpop.querySelector("[data-cpbar]").style.width = (c.target ? Math.min(100, 100 * ms / (c.target * 1000)) : 0) + "%";
        cpop.querySelector("[data-cpgoal]").textContent = c.target ? (c.alerted ? "Objectif atteint !" : "Objectif " + fmtNum(c.target) + " s") : "";
        cpop.querySelector(".gain-box").classList.toggle("reached", !!c.alerted);
      }
    }
    if (cpill) { cpill.hidden = !here || !c.min; cpill.textContent = "Gainage " + fmtDur(ms) + " · Agrandir"; }
  } else {
    if (cpop) cpop.hidden = true;
    if (cpill) cpill.hidden = true;
  }
}
setInterval(tick, 250);
// fin du repos : l'appli clignote (sombre / clair) pendant 5 s avec un message au centre
function restDone() {
  document.querySelectorAll(".restpop.done").forEach(x => x.remove());
  const d = document.createElement("div"); d.className = "restpop done"; d.setAttribute("role", "alert");
  d.innerHTML = '<div class="rp-box"><div class="rp-end">Pause terminée, au boulot !</div></div>';
  document.body.appendChild(d);
  const close = () => { d.remove(); clearInterval(flashTimer); flashTimer = null; applyTheme(); };
  d.addEventListener("click", close);
  setTimeout(() => { if (d.isConnected) d.remove(); }, 5000);
  clearInterval(flashTimer);
  const root = document.documentElement; let n = 0;
  flashTimer = setInterval(() => {
    n++; root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    if (n >= 10) { clearInterval(flashTimer); flashTimer = null; applyTheme(); }
  }, 500);
}

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
    case "addset": if (w) { b.dataset.g.split(",").map(Number).forEach(k => { const ex = w.exercises[k]; ex.sets.push(blankSet(ex.drops)); }); put("workout", w); render(); } break;
    case "delset": if (w) { b.dataset.g.split(",").map(Number).forEach(k => { const ex = w.exercises[k]; if (ex.sets.length > 1) ex.sets.pop(); }); put("workout", w); render(); } break;
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
      const add = await ask({ title: "L'ajouter au programme ?", text: "L'ajouter aussi à « " + w.templateName + " · " + vLabel(w.variantName) + " » pour les prochaines fois ?", ok: "Oui", cancel: "Juste aujourd'hui" });
      if (add) { const t = getItem(w.templateId); const v = t && t.variants.find(x => x.id === w.variantId); if (v) { v.exercises.push(te); put("template", t); } }
      w.exercises.push({ exId: te.id, name: te.name, type: te.type, target: te.target, rest: te.rest, drops: 0, groupId: null, groupKind: null, sets: Array.from({ length: te.sets }, () => blankSet(0)) });
      put("workout", w); render();
    } break;
    case "chronostop": if (w) { stopChrono(w); save(); render(); } break;
    case "chronocancel": db.live.chrono = null; save(); render(); break;
    case "chronomin": if (db.live.chrono) { db.live.chrono.min = true; save(); tick(); } break;
    case "chronomax": if (db.live.chrono) { db.live.chrono.min = false; save(); tick(); } break;
    case "chrono": if (w) {
      const c = db.live.chrono;
      if (c && c.wid === w.id && c.i === i && c.s === s) {
        stopChrono(w);
      } else {
        db.live.chrono = { wid: w.id, i, s, start: Date.now(), target: num(w.exercises[i].target), alerted: false };
        db.live.restEnd = null;
      }
      save(); render();
    } break;
    case "skiprest": db.live.restEnd = null; db.live.restMin = false; save(); tick(); break;
    case "restadd": if (db.live.restEnd) { const d = +b.dataset.v * 1000; db.live.restEnd = Math.max(Date.now() + 1000, db.live.restEnd + d); db.live.restTotal = Math.max(1000, (db.live.restTotal || 0) + d); save(); tick(); } break;
    case "restmin": db.live.restMin = true; save(); tick(); break;
    case "restmax": db.live.restMin = false; save(); tick(); break;
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
      const n = await ask({ title: "Nouveau programme", input: "", ok: "Créer" });
      if (!n) return;
      const t = { id: "tpl-" + uid(), name: n, order: templates().length, variants: [1, 2, 3].map(k => ({ id: "v" + k, name: "Séance " + k, exercises: [] })) };
      put("template", t); go("program/" + t.id);
    } break;
    case "tab": { const { t } = currentProgram(); if (t) go("program/" + t.id + "/" + b.dataset.v); } break;
    case "addvar": { const { t } = currentProgram(); if (!t) return; const v = { id: "v" + uid(), name: "Séance " + (t.variants.length + 1), exercises: [] }; t.variants.push(v); put("template", t); go("program/" + t.id + "/" + v.id); } break;
    case "dupvar": { const { t, v } = currentProgram(); if (!v) return; const c = { id: "v" + uid(), name: v.name + " (copie)", exercises: v.exercises.map(e => Object.assign({}, e, { id: "e-" + uid() })) }; t.variants.push(c); put("template", t); go("program/" + t.id + "/" + c.id); } break;
    case "delvar": { const { t, v } = currentProgram(); if (!v || t.variants.length < 2) return; if (!await ask({ title: "Supprimer « " + vLabel(v.name) + " » ?", text: "L'historique des séances déjà faites est conservé.", ok: "Supprimer", danger: true })) return; t.variants = t.variants.filter(x => x !== v); put("template", t); go("program/" + t.id); } break;
    case "addtplex": {
      const { t, v } = currentProgram(); if (!v) return;
      const kind = await choose("Ajouter", ADD_CHOICES); if (!kind) return;
      const n = GROUP_SIZE[kind] || 1;
      const names = await askNames(GROUP_LABEL[kind] || (kind === "degressif" ? "Exercice en dégressif" : "Nouvel exercice"), n,
        n > 1 ? "Ces " + n + " exercices s'enchaînent sans repos ; le repos vient après le tour complet." : ""); if (!names) return;
      const gid = n > 1 ? "g-" + uid() : null;
      names.forEach(name => {
        const e = Object.assign(newExercise(), { name });
        if (kind === "degressif") e.drops = 2;
        if (gid) { e.groupId = gid; e.groupKind = kind; }
        v.exercises.push(e);
      });
      put("template", t); render();
    } break;
    case "addmember": {
      const { t, v } = currentProgram(); if (!v) return;
      const f = v.exercises[+b.dataset.e]; if (!f || !f.groupId) return;
      const names = await askNames("Ajouter au " + (GROUP_LABEL[f.groupKind] || "groupe").toLowerCase(), 1); if (!names) return;
      const last = v.exercises.reduce((m, e, k) => e.groupId === f.groupId ? k : m, -1);
      v.exercises.splice(last + 1, 0, Object.assign(newExercise(), { name: names[0], groupId: f.groupId, groupKind: f.groupKind, sets: f.sets, rest: f.rest }));
      cleanGroups(v); put("template", t); render();
    } break;
    case "link": {
      const { t, v } = currentProgram(); if (!v) return;
      const bl = blocks(v.exercises), bi = +b.dataset.b; if (!bl[bi] || !bl[bi + 1]) return;
      const kind = await choose("Enchaîner les deux exercices", ADD_CHOICES.filter(c => c[0] === "superset" || c[0] === "biset")); if (!kind) return;
      const a1 = bl[bi].items[0].e, a2 = bl[bi + 1].items[0].e, gid = "g-" + uid();
      [a1, a2].forEach(e => { e.groupId = gid; e.groupKind = kind; e.sets = a1.sets; e.rest = a1.rest; });
      put("template", t); render();
    } break;
    case "ungroup": {
      const { t, v } = currentProgram(); if (!v) return;
      const f = v.exercises[+b.dataset.e]; if (!f || !f.groupId) return;
      const gid = f.groupId; v.exercises.forEach(e => { if (e.groupId === gid) { delete e.groupId; delete e.groupKind; } });
      put("template", t); render();
    } break;
    case "delgroup": {
      const { t, v } = currentProgram(); if (!v) return;
      const f = v.exercises[+b.dataset.e]; if (!f || !f.groupId) return;
      if (!await ask({ title: "Supprimer ce " + (GROUP_LABEL[f.groupKind] || "groupe").toLowerCase() + " ?", text: "Tous ses exercices seront retirés de la séance.", ok: "Supprimer", danger: true })) return;
      const gid = f.groupId; v.exercises = v.exercises.filter(e => e.groupId !== gid);
      put("template", t); render();
    } break;
    case "delex": { const { t, v } = currentProgram(); if (!v) return; const ex = v.exercises[+b.dataset.e]; if (!await ask({ title: (ex.groupId ? "Retirer" : "Supprimer") + " « " + ex.name + " » ?", ok: ex.groupId ? "Retirer" : "Supprimer", danger: true })) return; v.exercises.splice(+b.dataset.e, 1); cleanGroups(v); put("template", t); render(); } break;
    case "up": case "down": { const { t, v } = currentProgram(); if (!v) return; if (moveBlock(v, +b.dataset.b, a === "up" ? -1 : 1)) { put("template", t); render(); } } break;
    case "deltpl": { const { t } = currentProgram(); if (!t) return; if (!await ask({ title: "Supprimer « " + t.name + " » ?", text: "Ses séances et exercices seront supprimés. L'historique des séances déjà faites est conservé.", ok: "Supprimer", danger: true })) return; remove(t.id); go("programs"); } break;

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
    const set = ex.sets[+el.dataset.s]; if (!set) return;
    let tgt = set;
    if ("d" in el.dataset) { set.drops = set.drops || []; tgt = set.drops[+el.dataset.d] = set.drops[+el.dataset.d] || { kg: "", reps: "" }; }
    tgt[el.dataset.f] = el.value.replace(/[^\d.,]/g, "");
    if (el.value !== tgt[el.dataset.f]) el.value = tgt[el.dataset.f];
    putLater("workout", w);
    return;
  }
  if (el.dataset.p) {
    const { t, v } = currentProgram(); if (!t) return;
    const p = el.dataset.p;
    if (p === "tname") { t.name = el.value; putLater("template", t); return; }
    if (p === "vname") { v.name = el.value; putLater("template", t); const tab = $app.querySelector("[data-vtab]"); if (tab) tab.textContent = el.value; return; }
    const ex = v.exercises[+el.dataset.e]; if (!ex) return;
    if (p === "type" || p === "drops" || p === "gkind") return; // géré par « change »
    if (p === "gsets" || p === "grest") {
      const val = num(el.value) == null ? "" : Math.max(0, Math.round(num(el.value)));
      v.exercises.forEach(e => { if (e.groupId && e.groupId === ex.groupId) e[p === "gsets" ? "sets" : "rest"] = val; });
      putLater("template", t); return;
    }
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
    if (ex.type === "time") ex.drops = 0;
    put("template", t); render();
  } else if (el.dataset.p === "drops" || el.dataset.p === "gkind") {
    const { t, v } = currentProgram(); if (!t) return;
    const ex = v.exercises[+el.dataset.e]; if (!ex) return;
    if (el.dataset.p === "drops") ex.drops = +el.value;
    else v.exercises.forEach(e => { if (e.groupId && e.groupId === ex.groupId) e.groupKind = el.value; });
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
