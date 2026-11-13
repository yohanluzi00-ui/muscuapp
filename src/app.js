"use strict";
/* Fiitday — suivi des séances de musculation.
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
// rnd : "down" pour un chrono qui monte (0:01 affiché après 1 s pleine), "up" pour un compte à rebours (0:00 seulement à la fin)
function fmtDur(ms, rnd) {
  const s = Math.max(0, rnd === "down" ? Math.floor(ms / 1000 + 1e-6) : rnd === "up" ? Math.ceil(ms / 1000 - 1e-6) : Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? h + ":" + pad(m) + ":" + pad(x) : m + ":" + pad(x);
}
// formateurs de dates créés une seule fois (bien plus rapide qu'un toLocaleDateString par ligne)
const DF = o => new Intl.DateTimeFormat("fr-FR", o);
const dfShort = DF({ weekday: "short", day: "numeric", month: "short" }), dfLong = DF({ weekday: "long", day: "numeric", month: "long" }),
  dfTime = DF({ hour: "2-digit", minute: "2-digit" }), dfMonth = DF({ month: "long", year: "numeric" });
const dfDay = DF({ day: "numeric", month: "short" });
const fmtDate = t => dfShort.format(t);
const fmtDateLong = t => dfLong.format(t);
const fmtTime = t => dfTime.format(t);
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
  dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
};

/* ================= Stockage local ================= */
function emptyDb() { return { items: {}, lastServerAt: null, auth: null, mode: null, seeded: true, live: {}, owner: null }; }
function load() {
  try { const d = JSON.parse(localStorage.getItem(DB_KEY)); if (d && d.items) return Object.assign(emptyDb(), d); } catch (e) { }
  return emptyDb();
}
let db = load();
if (db.auth && !db.owner) db.owner = db.auth.user.id;
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 300); }
function saveNow() { clearTimeout(saveTimer); try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { console.error(e); } }
window.addEventListener("pagehide", saveNow);

// compteur de modifications : permet de ne recalculer les listes triées qu'après un changement
let dataRev = 0;
function all(kind) { return Object.values(db.items).filter(i => i.kind === kind && !i.deleted).map(i => i.data); }
function getItem(id) { const i = db.items[id]; return i && !i.deleted ? i.data : null; }
function put(kind, data) {
  const prev = db.items[data.id];
  let t = Date.now();
  if (prev && prev.updated_at >= t) t = prev.updated_at + 1;
  db.items[data.id] = { id: data.id, kind, data, updated_at: t, deleted: false, dirty: true };
  dataRev++; save(); scheduleSync();
}
function remove(id) {
  const p = db.items[id]; if (!p) return;
  // le contenu est effacé : seule une marque « supprimé » reste (et part sur les autres appareils)
  db.items[id] = { id, kind: p.kind, data: { id }, deleted: true, dirty: true, updated_at: Math.max(Date.now(), p.updated_at + 1) };
  dataRev++; save(); scheduleSync();
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
document.addEventListener("visibilitychange", () => { if (document.hidden) { flushPending(); saveNow(); } else { sync(); if (window.__fiitdayPending) window.__fiitdayPending(); } });

/* ================= Données ================= */
// identifiants : lettres, chiffres, « _ » et « - » seulement (ils sont insérés dans les attributs HTML)
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const okId = x => typeof x === "string" && ID_RE.test(x);
function validItem(it) {
  if (!it || !okId(it.id) || typeof it.kind !== "string" || !it.data || typeof it.data !== "object") return false;
  if (it.deleted) return true;
  const d = it.data;
  if (d.id !== it.id) return false;
  if (it.kind === "template") return Array.isArray(d.variants) && d.variants.every(v => v && okId(v.id) && Array.isArray(v.exercises) && v.exercises.every(e => e && okId(e.id) && (!e.groupId || okId(e.groupId))));
  if (it.kind === "workout") return okId(d.templateId) && okId(d.variantId) && typeof d.startedAt === "number" && Array.isArray(d.exercises) && d.exercises.every(e => e && okId(e.exId) && (!e.groupId || okId(e.groupId)) && Array.isArray(e.sets));
  return true;
}
// anciens noms « Variante N » → « Séance N » (affichage, et renommage enregistré quand les données sont à jour)
const vLabel = n => String(n == null ? "" : n).replace(/^Variante(?=\s|$)/i, "Séance");
function purgeBody() {
  for (const it of Object.values(db.items)) {
    if (it.kind !== "body" || (it.deleted && Object.keys(it.data || {}).length <= 1)) continue;
    db.items[it.id] = { id: it.id, kind: "body", data: { id: it.id }, updated_at: Math.max(Date.now(), it.updated_at + 1), deleted: true, dirty: true };
    dataRev++; save(); scheduleSync();
  }
}
// notes : chaque séance garde sa propre note ; les anciennes séances (où la note était celle du programme) reçoivent une fois la note actuelle
function freezeNotes() {
  for (const it of Object.values(db.items)) {
    if (it.kind !== "workout" || it.deleted || !it.data || !Array.isArray(it.data.exercises)) continue;
    const w = it.data; let ch = false;
    w.exercises.forEach(e => { if (e.note === undefined) { const te = tplExercise(w, e.exId); e.note = te && te.note ? te.note : ""; ch = true; } });
    if (ch) put("workout", w);
  }
}
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
let wCache = { rev: -1, list: [] };
const workouts = () => { if (wCache.rev !== dataRev) wCache = { rev: dataRev, list: all("workout").sort((a, b) => b.startedAt - a.startedAt) }; return wCache.list; };
const finished = () => workouts().filter(w => w.endedAt);
const activeWorkout = () => workouts().find(w => !w.endedAt) || null;
function settings() { return Object.assign({ id: "settings", theme: "auto", alert: "vibration", goal: "5" }, getItem("settings") || {}); }
function setSetting(k, v) { const s = settings(); s[k] = v; put("settings", s); applyTheme(); render(); }
// réglages de départ d'un exercice de la bibliothèque (type, cible, repos, charge)
const libDefaults = lib => lib.kind === "time" ? Object.assign({ type: "time", target: String(lib.hold || 45), rest: lib.rest || 60 }, lib.hold ? { sets: 2 } : {})
  : lib.kind === "dist" ? { type: "dist", target: String(lib.dist || 1000), rest: lib.rest || 120, load: !!lib.load }
  : { type: /^Poids du corps/.test(lib.gear || "") ? "rep" : "reps", target: (String(lib.reps || "").match(/^\d+(-\d+)?/) || ["8-10"])[0], rest: lib.rest || 90 };
const newExercise = () => ({ id: "e-" + uid(), name: "Nouvel exercice", type: "reps", sets: 3, target: "8-10", rest: 90, note: "" });
const blankSet = drops => ({ kg: "", reps: "", sec: "", done: false, drops: Array.from({ length: Math.max(0, num(drops) || 0) }, () => ({ kg: "", reps: "" })) });
// baisses d'une série en dégressif : toutes les séries, ou seulement la dernière (dropScope "last")
// nombre de baisses en dégressif ; jamais pour un exercice en temps (d'anciennes valeurs pouvaient rester cachées)
const restNextOf = (e, v) => (e && e.restNext != null ? num(e.restNext) || 0 : num(v && v.restBetween) || 0);
const dropsOf = e => (e && (e.type === "reps" || !e.type) ? num(e.drops) : 0) || 0;
// type « dist » (course, rameur, Hyrox) : distance cible en m, temps mesuré, charge facultative
const fmtClock = sec => { sec = Math.round(num(sec) || 0); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ":" + pad(m) : m) + ":" + pad(s); };
// temps tenu (gainage, étirement) : « 45 s », puis « 1:15 » dès 60 s
const fmtHold = v => { const n = num(v); return n == null ? "" : n >= 60 ? fmtClock(n) : fmtNum(n) + " s"; };
// « 4:05 », « 405 » (= 4 min 05) ou « 45 » (= 45 s) → secondes
function parseClock(t) {
  t = String(t || "").trim(); if (!t) return null;
  if (t.includes(":")) { const p = t.split(":").map(x => num(x)); if (p.some(x => x == null)) return null; return p.reduce((a, x) => a * 60 + x, 0); }
  const d = t.replace(/\D/g, ""); if (!d) return null;
  return d.length <= 2 ? +d : +d.slice(0, -2) * 60 + Math.min(59, +d.slice(-2));
}
const dropsFor = (e, k, n) => (dropsOf(e) && (e.dropScope !== "last" || k === n - 1)) ? dropsOf(e) : 0;
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
const setHasData = (s, type) => type === "time" || type === "dist" ? num(s.sec) != null : (num(s.kg) != null || num(s.reps) != null);
const exHasData = e => e.sets.some(s => setHasData(s, e.type));

function oneLabel(s, type) {
  if (type === "time") return num(s.sec) != null ? fmtHold(s.sec) : "—";
  if (type === "dist") return num(s.sec) != null ? fmtClock(s.sec) + (num(s.kg) != null ? " · " + fmtNum(num(s.kg)) + " kg" : "") : "—";
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
let lpCache = { rev: -1, map: new Map() };
function lastPerf(w, ex) {
  // même résultat tant qu'aucune séance n'a changé : évite de tout reparcourir à chaque champ affiché
  if (lpCache.rev !== dataRev) lpCache = { rev: dataRev, map: new Map() };
  const key = w.id + "|" + w.startedAt + "|" + ex.exId + "|" + norm(ex.name) + "|" + ex.type;
  if (lpCache.map.has(key)) return lpCache.map.get(key);
  const res = lastPerfCompute(w, ex);
  lpCache.map.set(key, res);
  return res;
}
function lastPerfCompute(w, ex) {
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
function signal(noVib) { const a = settings().alert; if (a === "son" || a === "les deux") beep(); if (!noVib && (a === "vibration" || a === "les deux")) vibrate(); }
// montre connectée (appli Android) : le repos et le chrono arrivent sur la montre, qui vibre à la fin
const nativeWatch = () => !!(Native && typeof Native.startChrono === "function");
const watchOn = () => nativeWatch() && settings().watch === "oui";
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
      (o.html || "") + (o.text ? "<p>" + esc(o.text) + "</p>" : "") +
      (o.input !== undefined ? (o.code ? '<input class="f code-in" aria-label="' + esc(o.title) + '" maxlength="12" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="ex. K7P2X9QM" value="' + esc(o.input) + '">' : o.multiline ? '<textarea class="f" rows="6" aria-label="' + esc(o.title) + '">' + esc(o.input) + "</textarea>" : o.suggest ? '<div class="fl"><input class="f" data-suggest autocomplete="off" maxlength="80" placeholder="Tape un nom ou un muscle" aria-label="' + esc(o.title) + '" value="' + esc(o.input) + '"><div class="sugg" hidden></div></div>' : '<input class="f" aria-label="' + esc(o.title) + '" value="' + esc(o.input) + '">') : "") +
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
// fonction SQL (rpc) : renvoie son résultat JSON (null si vide)
async function rpc(name, args) {
  await ensureToken();
  const go = () => fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, { method: "POST", body: JSON.stringify(args || {}),
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + db.auth.access_token, "Content-Type": "application/json" } });
  let r = await go();
  if (r.status === 401) { await ensureToken(true); r = await go(); }
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { }
  if (!r.ok) { const e = new Error((j && j.message) || t || ("Erreur " + r.status)); e.status = r.status; e.code = j && j.code; throw e; }
  return j;
}
const syncState = { status: "idle", at: null, error: "" };
async function authReq(path, body) {
  const r = await fetch(SUPABASE_URL + "/auth/v1/" + path, { method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error_description || j.msg || j.message || j.error || ("Erreur " + r.status)); e.status = r.status; e.code = j.error_code || j.code; throw e; }
  return j;
}
function setSession(j) {
  db.auth = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, user: { id: j.user.id, email: j.user.email, name: (j.user.user_metadata && j.user.user_metadata.first_name) || "" } };
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
  syncing = true; if (syncState.status !== "ok") { syncState.status = "busy"; updateSyncBadges(); } // déjà synchronisé : la synchro de fond ne change pas le texte (pas de saut à l'écran)
  let changed = false;
  try {
    // 1) récupérer ce qui a changé sur le serveur
    let since = db.lastServerAt, maxSeen = db.lastServerAt;
    for (let page = 0; page < 50; page++) {
      let q = "items?select=id,kind,data,updated_at,deleted,server_at&order=server_at.asc&limit=1000";
      if (since) q += "&server_at=gte." + encodeURIComponent(since);
      const rows = await rest("GET", q);
      for (const r of rows) {
        if (r && (!maxSeen || r.server_at > maxSeen)) maxSeen = r.server_at;
        if (!validItem(r)) { console.warn("élément ignoré (format inattendu)", r && r.id); continue; }
        const loc = db.items[r.id];
        const ru = Number(r.updated_at);
        if (!loc || ru > loc.updated_at || (!loc.dirty && ru !== loc.updated_at)) {
          db.items[r.id] = { id: r.id, kind: r.kind, data: r.data, updated_at: ru, deleted: r.deleted, dirty: false };
          changed = true; dataRev++;
        }
      }
      if (rows.length < 1000) break;
      since = rows[rows.length - 1].server_at;
    }
    db.lastServerAt = maxSeen;
    purgeBody(); // plus de page Corps : les anciennes mesures sont effacées, contenu compris
    freezeNotes(); renameVariants(); // après la récupération : les données sont à jour, aucun risque d'écraser une modif récente
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
  const html = syncBadge(); document.querySelectorAll("[data-sync]").forEach(el => { if (el.outerHTML !== html) el.outerHTML = html; });
  const e = document.querySelector("[data-sync-error]"); if (e) e.textContent = syncState.status === "err" ? syncState.error : "";
}

/* ================= Navigation ================= */
const safeDecode = x => { try { return decodeURIComponent(x); } catch (e) { return ""; } };
function route() { const h = location.hash.replace(/^#\/?/, ""); const p = h.split("/"); return { name: p[0] || "home", args: p.slice(1).map(safeDecode) }; }
const go = path => { location.hash = "#/" + path; };
/* Retour à la même position : chaque page de l'historique garde sa position de défilement. Revenir sur une page déjà vue
   (« ‹ Retour » vers la page d'où l'on vient, bouton retour du téléphone ou du navigateur) la remet exactement où elle était ;
   une nouvelle page s'ouvre en haut. */
try { history.scrollRestoration = "manual"; } catch (e) { }
const navKey = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
let scrollPos = {}; try { scrollPos = JSON.parse(sessionStorage.getItem("fiitday-scroll") || "{}") || {}; } catch (e) { }
let navRestoring = false, navRestoreId = 0, scrollSaveT = null;
const sameHash = (a, b) => { try { return decodeURIComponent(a) === decodeURIComponent(b); } catch (e) { return a === b; } };
function keepScrollPos() {
  try { const ks = Object.keys(scrollPos); if (ks.length > 80) ks.slice(0, ks.length - 80).forEach(k => delete scrollPos[k]); sessionStorage.setItem("fiitday-scroll", JSON.stringify(scrollPos)); } catch (e) { }
}
window.addEventListener("scroll", () => {
  const st = history.state; if (navRestoring || !st || !st.k) return;
  scrollPos[st.k] = Math.round(window.scrollY);
  clearTimeout(scrollSaveT); scrollSaveT = setTimeout(keepScrollPos, 300);
}, { passive: true });
// remet la page à sa position ; un contenu affiché un peu après (liste des exercices…) est attendu jusqu'à 2 s, sauf si tu fais défiler toi-même
function applyScroll(y) {
  const id = ++navRestoreId, t0 = Date.now();
  navRestoring = true;
  const stop = () => { if (id !== navRestoreId) return; navRestoring = false; ["touchstart", "wheel", "keydown"].forEach(ev => window.removeEventListener(ev, stop, true)); };
  ["touchstart", "wheel", "keydown"].forEach(ev => window.addEventListener(ev, stop, true));
  const step = () => {
    if (id !== navRestoreId || !navRestoring) return;
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.min(y, max));
    if (max >= y || Date.now() - t0 > 2000) { stop(); return; }
    setTimeout(step, 50);
  };
  step();
}
function afterNavigate(oldHash) {
  const st = history.state;
  if (st && st.k) { applyScroll(scrollPos[st.k] || 0); return; } // page déjà vue : même position qu'avant
  history.replaceState({ k: navKey(), prev: oldHash || "" }, "");
  navRestoreId++; navRestoring = false; window.scrollTo(0, 0);
}
window.addEventListener("hashchange", e => {
  let old = ""; try { old = e.oldURL ? new URL(e.oldURL).hash : ""; } catch (err) { }
  navRestoring = true; flushPending(); render(); afterNavigate(old);
});
// changement de page qui remplace la page actuelle dans l'historique (fiche suivante en glissant) : le « Retour » reste le même
window.__navReplace = hash => {
  const prev = (history.state || {}).prev || "";
  history.replaceState({ k: navKey(), prev }, "", hash);
  navRestoring = true; flushPending(); render(); navRestoreId++; navRestoring = false; window.scrollTo(0, 0);
};
// « ‹ Retour » vers la page d'où l'on vient : on revient en arrière dans l'historique (donc à la même position)
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest("a.back"); if (!a || e.defaultPrevented || e.button) return;
  const st = history.state, href = a.getAttribute("href");
  if (st && st.prev && href && sameHash(href, st.prev)) { e.preventDefault(); history.back(); }
}, true);
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

const LEGAL = { version: "2026-11-09", privacy: "https://fiitday.com/confidentialite.html", legal: "https://fiitday.com/mentions-legales.html", deletion: "https://fiitday.com/suppression-compte.html" };
let consentAsked = false, nameAsked = false;
const firstName = () => settings().firstName || (db.auth && db.auth.user && db.auth.user.name) || "";
async function askNameIfNeeded() {
  if (nameAsked || !db.auth || (!db.lastServerAt && !syncState.at) || firstName() || !settings().consentAt) return;
  nameAsked = true;
  const n = await ask({ title: "Comment t'appelles-tu ?", text: "Ton prénom s'affichera sur l'accueil. Tu peux le changer dans Réglages.", input: "", ok: "Enregistrer", cancel: "Plus tard" });
  if (!n) return;
  const st = settings(); st.firstName = n.slice(0, 40); put("settings", st); render();
}
async function askConsentIfNeeded() {
  // attendre une première synchro réussie (même si le compte est encore vide)
  if (consentAsked || !db.auth || (!db.lastServerAt && !syncState.at) || settings().consentAt) return;
  consentAsked = true;
  const ok = await ask({ title: "Confidentialité", text: "Pour continuer à utiliser ton compte, confirme que tu as 15 ans ou plus et que tu acceptes la politique de confidentialité (lisible dans Réglages › Informations légales), y compris l'enregistrement de tes données d'entraînement.", ok: "J'accepte", cancel: "Plus tard" });
  if (!ok) return;
  const st = settings(); st.consentAt = new Date().toISOString(); st.consentVersion = LEGAL.version; put("settings", st);
}
// menu : 4 onglets ; l'historique est dans Stats, les programmes Fiitday (bientôt) en carte sur l'accueil
const NAV = [["home", "Accueil", "home"], ["exercices", "Exercices", "dumbbell"], ["progress", "Stats", "chart"], ["settings", "Réglages", "gear"]];
// Remplacer l'écran retire le champ actif : son « blur »/« change » peut redemander un rendu pendant celui-ci.
let rendering = false;
function render() {
  if (rendering) { setTimeout(render, 0); return; }
  rendering = true;
  try { renderNow(); }
  catch (e) {
    console.error(e);
    $app.innerHTML = '<div class="login"><h1>Oups</h1><p class="muted">Un problème d\'affichage est survenu. Tes données ne sont pas perdues.</p><button type="button" class="btn primary big" data-act="reload">Revenir à l\'accueil</button></div>';
  } finally { rendering = false; }
}
let localFixed = false; // sans compte : anciens noms et anciennes mesures corrigés une fois par lancement
function renderNow() {
  applyTheme();
  if (!db.auth && db.mode !== "local") { keepScreen(false); $app.innerHTML = viewLogin(); return; }
  // un nouvel utilisateur arrive sur une page vierge : plus de programmes créés d'office
  // (les programmes déjà enregistrés dans un compte ne sont pas touchés)
  if (!db.auth && !localFixed) { localFixed = true; freezeNotes(); renameVariants(); purgeBody(); }
  const r = route();
  let body, wide = false, immersive = false;
  switch (r.name) {
    case "session": { const v = viewSession(r.args[0]); body = v.html; wide = v.wide; immersive = v.active; break; }
    case "programs": body = viewPrograms(); break;
    case "program": body = viewProgram(r.args[0], r.args[1]); break;
    case "history": body = viewHistory(); break;
    case "progress": if (r.args[0]) { history.replaceState(history.state, "", "#/evolution/" + encodeURIComponent(r.args[0])); body = viewEvolutionDetail(r.args[0]); } else body = viewProgress(); break; // ancien lien d'un exercice
    case "evolution": body = r.args[0] ? viewEvolutionDetail(r.args[0]) : viewEvolution(); break;
    case "calendar": body = viewCalendar(r.args[0], r.args[1]); break;
    case "body": history.replaceState(history.state, "", "#/progress"); body = viewProgress(); break; // ancienne page Corps
    case "s":
    case "import": {
      const code = r.name === "s" ? SHARE_SHORT + r.args[0] : r.args[0];
      history.replaceState(history.state, "", "#/home");
      body = viewHome();
      setTimeout(() => importShared(code), 0);
      break;
    }
    case "settings": body = viewSettings(); break;
    case "faq": body = viewFaq(r.args[0]); if (r.args[0]) setTimeout(() => { const d = document.getElementById("faq-" + r.args[0]); if (d) d.scrollIntoView({ block: "start" }); }, 60); break;
    case "exercices": body = '<div id="exo-root"><div class="page-head"><h1>Exercices</h1></div><div class="card empty">Chargement des exercices…</div></div>'; break;
    default: body = viewHome();
  }
  const tab = { faq: "settings", session: "home", program: "home", import: "home", s: "home", calendar: "progress", evolution: "progress", history: "progress", programs: "home", body: "progress" }[r.name] || (NAV.some(n => n[0] === r.name) ? r.name : "home");
  $app.innerHTML = '<div class="shell' + (immersive ? " hide-nav" : "") + '"><nav class="nav" aria-label="Navigation"><div class="brand">Fiitday</div>' +
    NAV.map(n => '<a href="#/' + n[0] + '" class="' + (n[0] === tab ? "on" : "") + '"' + (n[0] === tab ? ' aria-current="page"' : "") + ">" + ICON[n[2]] + "<span>" + n[1] + "</span></a>").join("") +
    '</nav><main class="main' + (wide ? " wide" : "") + '">' + body + "</main></div>";
  keepScreen(immersive);
  if (r.name === "exercices") mountExercises(r.args[0], r.args[1]);
  tick();
  setTimeout(() => askConsentIfNeeded().then(askNameIfNeeded), 800);
}

/* ================= Écran : exercices (bibliothèque 3D, chargée à la demande) ================= */
let exoMod = null, exoReturn = null, stretchSeq = null; // stretchSeq : suite d'étirements proposée après une séance
function mountExercises(id, arg) {
  const root = document.getElementById("exo-root"); if (!root) return;
  if (!id || id === "etirements") { exoReturn = null; stretchSeq = null; } // liste ouverte directement : retour normal
  const back = id && exoReturn ? { href: exoReturn, label: /^#\/session/.test(exoReturn) ? "Retour à la séance" : /^#\/(home)?$/.test(exoReturn) ? "Accueil" : "Retour au programme" } : null;
  const ready = exoMod ? Promise.resolve(exoMod) : import("./exercices.js?v=" + encodeURIComponent(window.APP_BUILD || "")).then(m => (exoMod = m));
  ready.then(m => { if (root.isConnected) m.mount(root, id && /^[a-z0-9-]{1,60}$/.test(id) ? id : null, { add: addLibraryExercise, back, seq: stretchSeq }, /^[a-z]{1,12}$/.test(arg || "") ? arg : null); })
    .catch(err => { console.error(err); if (root.isConnected) root.innerHTML = '<div class="page-head"><h1>Exercices</h1></div><div class="card empty">Impossible de charger les exercices' + (navigator.onLine === false ? " sans connexion la première fois" : "") + '. Réessaie dans un instant.</div>'; });
}
// « Ajouter à une séance » depuis la fiche d'un exercice
async function addLibraryExercise(x) {
  const opts = [];
  templates().forEach(t => t.variants.forEach(v => opts.push(["t:" + t.id + ":" + v.id, t.name + " · " + vLabel(v.name), v.exercises.length + " exercice" + (v.exercises.length > 1 ? "s" : "")])));
  if (!opts.length) { toast(templates().length ? "Crée d'abord une séance dans un de tes programmes (Accueil › + Nouvelle séance)" : "Crée d'abord un programme depuis l'accueil"); return; }
  const c = await choose("Ajouter « " + x.name + " » à…", opts); if (!c) return;
  const [, tid, vid] = c.split(":"); const t = getItem(tid); const v = t && t.variants.find(y => y.id === vid); if (!v) return;
  const reps = (String(x.reps || "").match(/^\d+(-\d+)?/) || [""])[0];
  const e = Object.assign(newExercise(), { name: String(x.name).slice(0, 80) }, x.time ? Object.assign({ type: "time", target: String(num(x.hold) || 45), rest: x.hold ? Math.max(0, Math.min(600, num(x.rest) || 15)) : 60 }, x.hold ? { sets: 2 } : {}) : x.dist ? { type: "dist", target: String(x.dist), rest: Math.max(0, Math.min(600, num(x.rest) || 120)), load: !!x.load } : Object.assign({ target: reps || "8-10", rest: Math.max(0, Math.min(600, num(x.rest) || 90)) }, x.bw ? { type: "rep" } : {}));
  v.exercises.push(e); put("template", t);
  toast("Ajouté à « " + t.name + " · " + vLabel(v.name) + " »");
}

/* ================= Écran : connexion ================= */
let loginMode = "in", loginEmail = "", loginName = ""; // écran de connexion : « in » se connecter, « up » créer un compte
function viewLogin() {
  if (db.verify) return '<div class="login"><img class="logo" src="icon-192.png" alt="" width="72" height="72"><h1>Vérifie ton e-mail</h1>' +
    '<p class="muted">Nous avons envoyé un code à <b>' + esc(db.verify) + '</b>. Saisis-le ci-dessous pour activer ton compte.</p>' +
    '<form data-form="verify" class="stack">' +
    '<label class="fl">Code reçu par e-mail<input class="f code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" pattern="[0-9 ]*" required></label>' +
    '<button class="btn primary big" type="submit">Valider</button></form>' +
    '<p class="msg" data-msg role="status"></p>' +
    '<p class="muted small">Pas reçu ? Regarde dans les spams, ou</p><button class="btn" data-act="resend">Renvoyer le code</button>' +
    '<button class="link" data-act="changemail">Changer d\'adresse e-mail</button></div>';
  const up = loginMode === "up", em = esc(loginEmail);
  // (le mode « sans compte » existe toujours dans le code, mais n'est plus proposé sur cet écran)
  return '<div class="login"><img class="logo" src="icon-192.png" alt="" width="72" height="72"><h1>Fiitday</h1>' +
    '<p class="muted">' + (up ? "Crée ton compte pour enregistrer tes séances sur ton téléphone et sur ton ordinateur." : "Connecte-toi pour retrouver tes séances sur ton téléphone et sur ton ordinateur.") + "</p>" +
    '<form data-form="login" class="stack">' +
    (up ? '<label class="fl">Prénom<input class="f" name="firstname" autocomplete="given-name" maxlength="40" value="' + esc(loginName) + '"></label>' : "") +
    '<label class="fl">E-mail<input class="f" type="email" name="email" autocomplete="email" value="' + em + '" required></label>' +
    '<label class="fl">Mot de passe<input class="f" type="password" name="password" minlength="' + (up ? 8 : 6) + '" autocomplete="' + (up ? "new-password" : "current-password") + '" required></label>' +
    (up
      ? '<label class="consent"><input type="checkbox" name="consent" id="consent"><span>Pour créer un compte : j\'ai 15 ans ou plus et j\'accepte la <a href="' + LEGAL.privacy + '" target="_blank" rel="noopener">politique de confidentialité</a>, y compris l\'enregistrement de mes données d\'entraînement.</span></label>' +
        '<button class="btn primary big" type="submit" value="up">Créer mon compte</button>'
      : '<button class="btn primary big" type="submit" value="in">Se connecter</button>') +
    "</form>" +
    '<p class="msg" data-msg role="status"></p>' +
    (up ? '<button class="link" data-act="loginmode" data-m="in">J\'ai déjà un compte : me connecter</button>'
        : '<button class="link" data-act="loginmode" data-m="up">Créer un compte</button>') + "</div>";
}
function authMessage(e) {
  const m = String(e.message || "");
  if (/invalid login credentials/i.test(m)) return "E-mail ou mot de passe incorrect.";
  if (/email not confirmed/i.test(m)) return "Ton e-mail n'est pas encore vérifié.";
  if (/expired|invalid/i.test(m) && /token|otp|code/i.test(m)) return "Code incorrect ou expiré. Vérifie-le ou demande un nouveau code.";
  if (/rate limit/i.test(m)) return "Trop d'e-mails envoyés pour le moment. Réessaie un peu plus tard.";
  if (/security purposes|only request this after/i.test(m)) return "Patiente une minute avant de redemander un code.";
  if (/already registered|already exists/i.test(m)) return "Un compte existe déjà avec cet e-mail : clique sur « Se connecter ».";
  if (/password/i.test(m) && /6|8|short|weak|characters/i.test(m)) return "Mot de passe trop faible : au moins 8 caractères.";
  if (m === "Failed to fetch") return "Pas de connexion internet.";
  return m;
}
async function afterLogin() {
  loginMode = "in"; loginEmail = "";
  db.verify = null; db.seeded = true; db.lastServerAt = null;
  const uidNow = db.auth.user.id;
  if (db.owner && db.owner !== uidNow) {
    // données laissées par un AUTRE compte sur cet appareil (session expirée) : on ne les mélange pas
    db.items = {}; db.live = {}; dataRev++;
  } else if (!db.owner) {
    // données saisies sans compte : elles sont envoyées au compte
    Object.values(db.items).forEach(i => { if (i.updated_at > 0) i.dirty = true; });
  }
  db.owner = uidNow;
  saveNow(); render(); await sync();
  if (db.pendingConsent || db.pendingName) {
    const st = settings();
    if (db.pendingConsent) { st.consentAt = db.pendingConsent; st.consentVersion = LEGAL.version; }
    if (db.pendingName) st.firstName = db.pendingName;
    delete db.pendingConsent; delete db.pendingName; put("settings", st);
  }
  render();
}
async function onVerify(form) {
  const msg = $app.querySelector("[data-msg]");
  const token = form.code.value.replace(/\D/g, "");
  if (token.length < 6) { msg.className = "msg err"; msg.textContent = "Le code fait au moins 6 chiffres."; return; }
  msg.className = "msg"; msg.textContent = "Vérification…";
  form.querySelectorAll("button").forEach(b => { b.disabled = true; });
  try {
    const j = await authReq("verify", { type: "signup", email: db.verify, token });
    if (!j.access_token) throw new Error("Code incorrect ou expiré");
    setSession(j); toast("E-mail vérifié, bienvenue !");
    await afterLogin();
  } catch (e) {
    msg.className = "msg err"; msg.textContent = authMessage(e);
  } finally {
    form.querySelectorAll("button").forEach(b => { b.disabled = false; });
  }
}
async function onLogin(form, mode) {
  const msg = $app.querySelector("[data-msg]");
  const email = form.email.value.trim(), password = form.password.value;
  msg.className = "msg"; msg.textContent = mode === "up" ? "Création du compte…" : "Connexion…";
  form.querySelectorAll("button").forEach(b => { b.disabled = true; });
  try {
    if (mode === "up") {
      const fname = form.firstname.value.trim().slice(0, 40);
      if (password.length < 8) { msg.className = "msg err"; msg.textContent = "Choisis un mot de passe d'au moins 8 caractères."; return; }
      if (!fname) { msg.className = "msg err"; msg.textContent = "Indique ton prénom."; return; }
      if (!form.consent.checked) { msg.className = "msg err"; msg.textContent = "Coche la case de consentement pour créer ton compte."; return; }
      const consentAt = new Date().toISOString();
      const j = await authReq("signup", { email, password, data: { consent_at: consentAt, consent_version: LEGAL.version, first_name: fname } });
      // e-mail déjà inscrit : Supabase renvoie un utilisateur sans identité
      if (j.user && Array.isArray(j.user.identities) && j.user.identities.length === 0) throw new Error("already registered");
      db.pendingConsent = consentAt; db.pendingName = fname;
      if (!j.access_token) { db.verify = email; saveNow(); render(); return; } // code de vérification envoyé par e-mail
      setSession(j);
    } else {
      try { setSession(await authReq("token?grant_type=password", { email, password })); }
      catch (e) {
        if (/email not confirmed/i.test(e.message)) { // compte créé mais e-mail jamais vérifié : on renvoie un code
          db.verify = email; saveNow(); render();
          try { await authReq("resend", { type: "signup", email }); } catch (e2) { }
          const m2 = $app.querySelector("[data-msg]"); if (m2) m2.textContent = "Ton e-mail n'est pas encore vérifié : un nouveau code vient de t'être envoyé.";
          return;
        }
        throw e;
      }
    }
    await afterLogin();
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
  let h = '<div class="page-head"><div><div class="muted small">' + esc(fmtDateLong(Date.now())) + '</div><h1>Bonjour' + (firstName() ? " " + esc(firstName()) : "") + '</h1></div></div>' +
    homeStretch(act) +
    '<div class="home-actions"><button class="btn primary" data-act="newtpl">+ Nouveau programme</button><button class="btn" data-act="importvar">Importer</button></div>';
  if (act) {
    h += '<div class="hero"><div class="small" style="opacity:.75">Séance en cours</div><div style="font-size:21px;font-weight:800;margin-top:2px">' + esc(act.templateName) + " · " + esc(vLabel(act.variantName)) + "</div>" +
      '<div class="small" style="opacity:.8;margin-top:4px">Commencée à ' + fmtTime(act.startedAt) + ' · <span class="num" data-tick="elapsed" data-id="' + act.id + '"></span></div>' +
      '<a class="btn primary block big" href="#/session/' + act.id + '">Reprendre la séance</a></div>';
  }
  const ts = templates();
  h += '<div class="section-title">Mes programmes</div><div class="stack" data-sortable="tpl">';
  if (!ts.length) h += '<div class="card welcome"><h2>Bienvenue sur Fiitday</h2><p class="muted">Commence par créer ton premier programme avec « + Nouveau programme » (par exemple « Push » ou « Haut du corps »), puis ajoute ses séances et ses exercices. Une séance reçue d\'un ami ? Appuie sur « Importer ».</p></div>';
  for (const t of ts) {
    const st = variantStats(t);
    const lastAny = st.filter(x => x.last).sort((a, b) => b.last.startedAt - a.last.startedAt)[0];
    // variante suggérée : jamais faite, sinon celle faite il y a le plus longtemps (en suivant l'ordre)
    let sugg = null;
    if (st.length > 1) {
      const never = st.find(x => !x.last);
      sugg = never ? never.v.id : st.slice().sort((a, b) => a.last.startedAt - b.last.startedAt)[0].v.id;
    }
    h += '<div class="card tpl" data-sort-id="' + t.id + '"><div class="spread"><h2>' + esc(t.name) + "</h2>" +
      '<span class="tpl-side"><span class="muted small">' + (lastAny ? "Dernière : " + esc(fmtDate(lastAny.last.startedAt)) + " (" + esc(vLabel(lastAny.v.name)) + ")" : t.variants.length ? "Jamais faite" : "Aucune séance") + "</span>" +
      (ts.length > 1 ? '<span class="grip" data-drag title="Maintiens et fais glisser pour changer l\'ordre">' + GRIP + "</span>" : "") + "</span></div>" +
      '<div class="variants">' + st.map(x => {
        const n = x.v.exercises.length;
        return '<button class="variant' + (x.v.id === sugg ? " sugg" : "") + '" data-act="start" data-t="' + t.id + '" data-v="' + x.v.id + '"><b>' + esc(vLabel(x.v.name)) + "</b>" +
          "<span>" + (n ? n + " exercice" + (n > 1 ? "s" : "") : "vide — à remplir") + "</span>" +
          "<span>" + (x.v.id === sugg ? '<span class="tag">Suggérée</span> · ' : "") + (x.last ? esc(ago(x.last.startedAt)) : "jamais faite") + "</span></button>";
      }).join("") + '<button class="variant add" data-act="homeaddvar" data-t="' + t.id + '" aria-label="Nouvelle séance dans ' + esc(t.name) + '"><b>+ Nouvelle séance</b><span>Ajouter une séance à ce programme</span></button></div></div>';
  }
  h += "</div>";
  h += '<div class="section-title">Découvrir</div><div class="home-more"><a class="card" href="#/exercices/etirements"><b>Étirements</b><span class="muted small">Haut, milieu et bas du corps, avec les conseils</span></a>' +
    '<a class="card" href="#/programs"><b>Programmes Fiitday</b><span class="muted small"><span class="tag">Bientôt</span> Programmes prêts à l\'emploi et cardio</span></a></div>';
  const recent = finished().slice(0, 3);
  if (recent.length) {
    h += '<div class="section-title">Dernières séances</div><div class="list">' + recent.map(historyRow).join("") + "</div>";
  }
  return h;
}
// fenêtre affichée en touchant une séance sur l'accueil : « Modifier » | « C'est parti », et « Retour » en dessous
function startChoice(t, v) {
  return new Promise(res => {
    const n = v.exercises.length, title = t.name + " · " + vLabel(v.name);
    const d = document.createElement("div"); d.className = "modal";
    d.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h3>' + esc(title) + "</h3><p>" + n + " exercice" + (n > 1 ? "s" : "") + "</p>" +
      '<div class="modal-btns"><button class="btn" data-c="edit">Modifier</button><button class="btn primary" data-c="go">C\'est parti</button></div>' +
      '<button class="linkbtn" data-c="">Retour</button></div>';
    document.body.appendChild(d);
    d.addEventListener("click", e => {
      if (e.target === d) { d.remove(); res(null); return; }
      const b = e.target.closest("[data-c]"); if (b) { d.remove(); res(b.dataset.c || null); }
    });
  });
}
// « Lancer la séance 1 » (nom par défaut) ou « Lancer « Push A » »
const launchLabel = v => { const n = vLabel(v.name); return /^séance\b/i.test(n) ? "la " + n.charAt(0).toLowerCase() + n.slice(1) : "« " + n + " »"; };
async function startWorkout(tid, vid, direct) {
  const t = getItem(tid); if (!t) return;
  const v = t.variants.find(x => x.id === vid); if (!v) return;
  if (!v.exercises.length) { toast("Ajoute d'abord des exercices à cette séance"); go("program/" + tid + "/" + vid); return; }
  const choice = direct ? "go" : await startChoice(t, v);
  if (choice === "edit") { go("program/" + tid + "/" + vid); return; }
  if (choice !== "go") return;
  const act = activeWorkout();
  if (act) {
    const ok = await ask({ title: "Une séance est déjà en cours", text: act.templateName + " · " + vLabel(act.variantName) + "\nLa terminer et commencer celle-ci ?", ok: "Oui, la terminer" });
    if (!ok) return;
    act.endedAt = Date.now(); put("workout", act);
  }
  const w = {
    id: "w-" + uid(), templateId: t.id, variantId: v.id, templateName: t.name, variantName: v.name, startedAt: Date.now(), endedAt: null,
    exercises: v.exercises.map(e => ({ exId: e.id, name: e.name, note: e.note || "", type: e.type, target: e.target, rest: e.rest, load: !!e.load, restNext: restNextOf(e, v), drops: dropsOf(e), groupId: e.groupId || null, groupKind: e.groupKind || null,
      dropScope: e.dropScope === "last" ? "last" : "all",
      sets: (n => Array.from({ length: n }, (_, k) => blankSet(dropsFor(e, k, n))))(Math.max(1, num(e.sets) || 1)) })),
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
  return { kg: f("kg") || "kg", reps: f("reps") || "reps", sec: has && num(src.sec) != null ? fmtHold(src.sec) : "—", clock: has && num(src.sec) != null ? fmtClock(src.sec) : "m:ss" };
}
function inputsHtml(w, e, i, k, d, label) {
  const s = e.sets[k], v = d == null ? s : ((s.drops || [])[d] || {}), ph = phOf(w, e, k, d);
  const a = ' data-i="' + i + '" data-s="' + k + '"' + (d == null ? "" : ' data-d="' + d + '"');
  if (e.type === "time") return '<input class="ro" readonly tabindex="-1" aria-readonly="true" aria-label="Temps ' + label + ' (rempli par le chrono)" data-f="sec"' + a + ' value="' + esc(fmtHold(v.sec)) + '" placeholder="' + esc(ph.sec) + '">';
  if (e.type === "rep") return '<input inputmode="numeric" aria-label="Répétitions ' + label + '" data-f="reps"' + a + ' value="' + esc(v.reps) + '" placeholder="' + esc(ph.reps) + '">';
  if (e.type === "dist") return (e.load ? '<input inputmode="decimal" aria-label="Kilos ' + label + '" data-f="kg"' + a + ' value="' + esc(v.kg) + '" placeholder="' + esc(ph.kg) + '">' : "") +
    '<input inputmode="numeric" aria-label="Temps ' + label + ' (minutes:secondes)" data-f="clock"' + a + ' value="' + (num(v.sec) != null ? fmtClock(v.sec) : "") + '" placeholder="' + esc(ph.clock) + '">';
  return '<input inputmode="decimal" aria-label="Kilos ' + label + '" data-f="kg"' + a + ' value="' + esc(v.kg) + '" placeholder="' + esc(ph.kg) + '">' +
    '<input inputmode="numeric" aria-label="Répétitions ' + label + '" data-f="reps"' + a + ' value="' + esc(v.reps) + '" placeholder="' + esc(ph.reps) + '">';
}
function chronoBtn(w, i, s) {
  const c = db.live.chrono, run = c && c.wid === w.id && c.i === i && c.s === s;
  return '<button class="chrono' + (run ? " run" : "") + '" data-act="chrono" data-i="' + i + '" data-s="' + s + '" aria-label="' + (run ? "Arrêter le chrono" : "Lancer le chrono") + '">' +
    (run ? ICON.stop + '<span class="num" data-tick="chrono">0:00</span>' : ICON.play + (w.exercises[i] && w.exercises[i].type === "dist" && w.exercises[i].load ? "" : '<span class="cl">Chrono</span>')) + "</button>";
}
function okBtn(s, i, k) {
  return '<button class="ok' + (s.done ? " on" : "") + '" data-act="done" data-i="' + i + '" data-s="' + k + '" aria-label="Valider la série ' + (k + 1) + '" aria-pressed="' + !!s.done + '">✓</button>';
}
// une série (et ses baisses) dans la grille des cartes
function setRows(w, e, i, k, label) {
  const s = e.sets[k], d = s.done ? " done-row" : "";
  let h = '<div class="n">' + label + '</div><div class="set' + d + '">' + inputsHtml(w, e, i, k, null, "série " + (k + 1)) + (e.type === "time" || e.type === "dist" ? chronoBtn(w, i, k) : "") + "</div>" + okBtn(s, i, k);
  (s.drops || []).forEach((x, n) => {
    h += '<div class="n drop" title="Baisse ' + (n + 1) + '">↘</div><div class="set' + d + '">' + inputsHtml(w, e, i, k, n, "série " + (k + 1) + " baisse " + (n + 1)) + "</div><div></div>";
  });
  return h;
}
function metaText(e, inGroup, live) {
  const time = e.type === "time";
  const tg = e.type === "dist" ? esc(fmtNum(num(e.target) || 0)) + " m" : time ? esc(fmtHold(e.target) || "—") : esc(e.target || "—");
  let t = inGroup ? "Cible " + tg + (time || e.type === "dist" ? "" : " reps") : e.sets.length + " × " + tg + (live ? "" : " · repos " + esc(fmtRest(e.rest)));
  const d = dropsOf(e);
  if (d) t += " · dégressif (" + d + " baisse" + (d > 1 ? "s" : "") + (e.dropScope === "last" ? ", dernière série" : "") + ")";
  if (!inGroup && num(e.restNext)) t += " · puis " + esc(fmtRest(e.restNext)) + " avant le suivant";
  return t;
}
function exHead(w, e, i, letter) {
  const lib = libFor(e.name), live = !w.endedAt, time = e.type === "time";
  const chips = (lib ? '<button class="chip-mini" data-act="exoview" data-id="' + lib.id + '">' + ICON.play + "Voir le mouvement</button>" : "") +
    (live && !letter ? '<button class="chip-mini" data-act="sesspick" data-sf="rest" data-i="' + i + '">Repos ' + esc(fmtSecs(num(e.rest) || 0)) + " ✎</button>" : "") +
    (live && time ? '<button class="chip-mini" data-act="sesspick" data-sf="target" data-i="' + i + '">Objectif ' + esc(fmtSecs(num(e.target) || 0)) + " ✎</button>" : "");
  return '<div class="spread"><div class="ex-name">' + (letter ? '<span class="letter">' + letter + "</span>" : "") + esc(e.name) + '</div><button class="link" data-act="rename" data-i="' + i + '">Renommer</button></div>' +
    '<div class="ex-meta">' + metaText(e, !!letter, live) + "</div>" + (chips ? '<div class="ex-chips">' + chips + "</div>" : "");
}
function setActions(idx, count, word) {
  const g = idx.join(",");
  return '<div class="ex-actions"><button class="btn sm" data-act="addset" data-g="' + g + '">+ ' + word + "</button>" +
    (count > 1 ? '<button class="btn sm" data-act="delset" data-g="' + g + '">− ' + word + "</button>" : "") + "</div>";
}
function noteBox(w, e, i, letter) {
  const te = e.note == null ? tplExercise(w, e.exId) : null, note = e.note != null ? e.note : (te && te.note) || ""; // la note de CETTE séance
  return '<textarea class="f" data-f="note" data-i="' + i + '" placeholder="Notes' + (letter ? " " + letter + " · " + esc(e.name) : " (réglages, sensations…)") + '" aria-label="Notes ' + esc(e.name) + '">' + esc(note) + "</textarea>";
}
function exCard(w, e, i) {
  let rows = '<div class="h">Série</div><div class="h hdr">' + (e.type === "time" ? "<span>Temps</span>" : e.type === "rep" ? "<span>Reps</span>" : e.type === "dist" ? (e.load ? "<span>Kg</span>" : "") + "<span>Temps</span>" : "<span>Kg</span><span>Reps</span>") + '</div><div class="h"></div>';
  e.sets.forEach((s, k) => { rows += setRows(w, e, i, k, k + 1); });
  return '<section class="card ex">' + exHead(w, e, i, "") + '<div class="sets">' + rows + "</div>" + setActions([i], e.sets.length, "Série") + noteBox(w, e, i, "") + "</section>";
}
function groupCard(w, blk) {
  const first = blk.items[0].e, rounds = Math.max(...blk.items.map(x => x.e.sets.length));
  const gi = blk.items[0].i, live = !w.endedAt;
  let h = '<section class="card ex group"><div class="group-tag">' + esc(GROUP_LABEL[first.groupKind] || "Enchaînement") + " · " + rounds + " tour" + (rounds > 1 ? "s" : "") +
    (live ? "" : " · repos " + esc(fmtRest(first.rest)) + " après chaque tour") + "</div>" +
    (live ? '<div class="ex-chips"><button class="chip-mini" data-act="sesspick" data-sf="grest" data-i="' + gi + '">Repos après chaque tour ' + esc(fmtSecs(num(first.rest) || 0)) + " ✎</button></div>" : "");
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
  h += '<div class="add-row" style="margin-top:16px"><button class="btn" data-act="addex">+ Ajouter un exercice</button><button class="btn" data-act="sessstretch">+ Ajouter un étirement</button></div>';
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
      const e = x.e, i = x.i, time = e.type === "time", isDist = e.type === "dist", grouped = !!b.groupId, lastOfGroup = n === b.items.length - 1;
      h += '<tr class="' + (grouped && !lastOfGroup ? "chained" : "") + '"><td>' +
        (grouped ? '<div class="gtag">' + esc(GROUP_LABEL[e.groupKind] || "Enchaînement") + " · " + LETTERS[n] + "</div>" : "") +
        '<div class="spread" style="align-items:flex-start"><b style="font-size:15px">' + esc(e.name) + '</b><button class="link" data-act="rename" data-i="' + i + '">Renommer</button></div>' +
        (libFor(e.name) ? '<button class="chip-mini" data-act="exoview" data-id="' + libFor(e.name).id + '">' + ICON.play + "Voir le mouvement</button>" : "") +
        (dropsOf(e) ? '<div class="muted small">Dégressif · ' + dropsOf(e) + " baisse" + (dropsOf(e) > 1 ? "s" : "") + "</div>" : "") +
        (!grouped || lastOfGroup ? setActions(grouped ? idx : [i], e.sets.length, grouped ? "Tour" : "Série") : "") + "</td>" +
        "<td>" + e.sets.length + "</td><td>" + (isDist ? esc(fmtNum(num(e.target) || 0)) + " m" : time && !w.endedAt ? '<button class="chip-mini" data-act="sesspick" data-sf="target" data-i="' + i + '">' + esc(fmtSecs(num(e.target) || 0)) + " ✎</button>" : time ? esc(fmtHold(e.target) || "—") : esc(e.target || "—")) + "</td><td>" +
        (grouped && !lastOfGroup ? "enchaîné" : !w.endedAt ? '<button class="chip-mini" data-act="sesspick" data-sf="' + (grouped ? "grest" : "rest") + '" data-i="' + (grouped ? idx[0] : i) + '">' + esc(fmtSecs(num(e.rest) || 0)) + " ✎</button>" : esc(fmtRest(e.rest))) + "</td>";
      for (let k = 0; k < max; k++) {
        const s = e.sets[k];
        if (!s) { h += "<td></td>"; continue; }
        const d = s.done ? " done-row" : "";
        h += '<td><div class="cellwrap"><div class="cell' + d + '">' + inputsHtml(w, e, i, k, null, "série " + (k + 1)) + (time || isDist ? chronoBtn(w, i, k) : "") + okBtn(s, i, k) + "</div>" +
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
  for (const f of type === "time" ? ["sec"] : type === "dist" ? ["sec", "kg"] : type === "rep" ? ["reps"] : ["kg", "reps"]) if ((set[f] === "" || set[f] == null) && src[f] !== "" && src[f] != null) set[f] = src[f];
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
    var rec = checkRecord(w, i, s);
  } else set.done = false;
  put("workout", w);
  render();
  if (rec) celebrate(rec);
}
// repos : après chaque série, ou seulement à la fin du tour pour un superset / biset / triset
function afterSet(w, i, s) {
  if (w.endedAt) return;
  const e = w.exercises[i];
  // toute la séance est validée : pas de repos, on félicite et on propose de terminer
  if (w.exercises.every(x => x.sets.every(st => st.done))) {
    db.live.restEnd = null; save();
    whenFree(() => congrats(w.id));
    return;
  }
  const mem = e.groupId ? w.exercises.filter(x => x.groupId === e.groupId) : [e];
  if (e.groupId && !mem.every(x => !x.sets[s] || x.sets[s].done)) return; // tour pas encore fini
  // exercice (ou superset / biset / triset) entièrement validé : repos entre exercices, s'il est réglé
  const exDone = mem.every(x => x.sets.every(st => st.done));
  const next = num(mem[mem.length - 1].restNext) || num(mem[0].restNext) || num(w.restBetween) || 0;
  if (exDone && next > 0) startRest(next, "Repos · exercice suivant");
  else startRest(mem[0].rest);
}
// attend que la fenêtre « Nouveau record » soit fermée avant d'en ouvrir une autre
function whenFree(fn) { setTimeout(() => { if (document.querySelector(".recordpop")) whenFree(fn); else fn(); }, 400); }
async function congrats(wid) {
  const w = getItem(wid); if (!w || w.endedAt) return;
  const name = firstName();
  const ok = await ask({ title: "Félicitations" + (name ? " " + name : "") + " 🥳 !", text: "Tu as validé toutes les séries de ta séance.", ok: "Terminer la séance", cancel: "Continuer" });
  if (ok) finishWorkout(getItem(wid));
}
function finishWorkout(w) {
  if (!w || w.endedAt) return;
  flushPending();
  w.endedAt = Date.now(); put("workout", w); db.live = {}; save(); sync();
  toast("Séance enregistrée"); go("home");
}
// arrête le chrono de gainage : le temps est noté dans la série, qui est validée, puis le repos démarre
const CHRONO_PREP = 5;
// bip court du décompte de préparation (3, 2, 1) et bip plus long au départ
function prepBeep(go) {
  const a = settings().alert;
  if (a === "son" || a === "les deux") {
    const ac = audio(); if (ac) { const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = go ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.45, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + (go ? 0.45 : 0.15));
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + (go ? 0.5 : 0.2)); }
  }
  if (go && (a === "vibration" || a === "les deux")) { try { if (Native && Native.vibrate) Native.vibrate("[250]"); else if (navigator.vibrate) navigator.vibrate(250); } catch (e) { } }
}
function stopChrono(w, at) {
  const c = db.live.chrono; if (!c || c.wid !== w.id) return;
  const t = at || Date.now();
  const set = w.exercises[c.i] && w.exercises[c.i].sets[c.s];
  db.live.chrono = null;
  if (!set) return;
  if (t < c.start) return; // arrêté pendant la préparation : rien n'est noté
  set.sec = String(Math.round((t - c.start) / 1000)); set.done = true;
  afterSet(w, c.i, c.s);
  put("workout", w);
  const rec = checkRecord(w, c.i, c.s);
  if (rec) setTimeout(() => celebrate(rec), 50);
}
function startRest(sec, label) {
  sec = num(sec) || 0;
  if (sec <= 0) return;
  db.live.restEnd = Date.now() + sec * 1000; db.live.restTotal = sec * 1000; db.live.restAlerted = false; db.live.restMin = false; db.live.restLabel = label || ""; save(); setTimeout(armEdge, 0);
}

/* ================= Écran : programmes ================= */
const GRIP = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
function viewPrograms() {
  // page réservée au futur mode premium (programmes prêts à l'emploi, cardio) ; tes programmes se gèrent depuis l'accueil
  return '<div class="page-head"><h1>Programmes</h1></div>' +
    '<div class="card soon"><h2>Bientôt sur Fiitday</h2><p class="muted">Des programmes prêts à l\'emploi et le suivi cardio.</p></div>' +
    '<p class="muted small">Tes propres programmes se créent et se modifient depuis l\'<a href="#/home">Accueil</a> : touche une séance, puis «&nbsp;Modifier&nbsp;».</p>';
}
function exFields(e, k, letter, inGroup) {
  const time = e.type === "time", dist = e.type === "dist", rep = e.type === "rep", d = dropsOf(e);
  return (inGroup ? '<div class="spread"><b><span class="letter">' + letter + '</span><span data-title="' + k + '">' + esc(e.name) + '</span></b><button class="btn sm danger" data-act="delex" data-e="' + k + '">Retirer</button></div>' : "") +
    '<div class="ed-grid"><label class="fl full">Nom<input class="f" data-suggest autocomplete="off" maxlength="80" data-p="name" data-e="' + k + '" value="' + esc(e.name) + '"><div class="sugg" hidden></div></label>' +
    (libFor(e.name) ? '<div class="full" data-exolink="' + k + '"><button type="button" class="chip-mini" data-act="exoview" data-id="' + libFor(e.name).id + '">' + ICON.play + "Voir le mouvement</button></div>" : '<div class="full" data-exolink="' + k + '" hidden></div>') +
    '<label class="fl">Type<select class="f" data-p="type" data-e="' + k + '"><option value="reps"' + (!time && !dist && !rep ? " selected" : "") + '>Poids × reps</option><option value="rep"' + (rep ? " selected" : "") + '>Reps uniquement</option><option value="time"' + (time ? " selected" : "") + '>Temps (gainage)</option><option value="dist"' + (dist ? " selected" : "") + ">Distance (course, Hyrox)</option></select></label>" +
    (inGroup ? "" : '<label class="fl">Séries<input class="f" type="number" min="1" max="20" inputmode="numeric" data-p="sets" data-e="' + k + '" value="' + esc(e.sets) + '"></label>') +
    (dist ? '<label class="fl">Distance (m)<input class="f" type="number" min="1" max="100000" inputmode="numeric" data-p="target" data-e="' + k + '" value="' + esc(e.target) + '" placeholder="1000"></label>' +
      '<label class="fl">Charge<select class="f" data-p="load" data-e="' + k + '"><option value="0"' + (!e.load ? " selected" : "") + '>Sans charge</option><option value="1"' + (e.load ? " selected" : "") + ">Avec charge (kg)</option></select></label>"
    : time ? '<div class="fl"><span>Temps cible</span><button type="button" class="f pick" data-act="picksec" data-sf="target" data-e="' + k + '">' + fmtSecs(num(e.target) || 0) + "</button></div>"
      : '<label class="fl">Reps cible<input class="f" data-p="target" data-e="' + k + '" value="' + esc(e.target) + '" placeholder="8-10"></label>') +
    (inGroup ? "" : '<div class="fl"><span>Repos</span><button type="button" class="f pick" data-act="picksec" data-sf="rest" data-e="' + k + '">' + fmtSecs(num(e.rest) || 0) + "</button></div>") +
    (time || dist || rep ? "" : '<label class="fl">Dégressif<select class="f" data-p="drops" data-e="' + k + '">' + [0, 1, 2, 3].map(n => '<option value="' + n + '"' + (d === n ? " selected" : "") + ">" + (n ? "Oui · " + n + " baisse" + (n > 1 ? "s" : "") : "Non") + "</option>").join("") + "</select></label>") +
    (time || dist || rep || !d ? "" : '<label class="fl">Dégressif sur<select class="f" data-p="dscope" data-e="' + k + '"><option value="all"' + (e.dropScope !== "last" ? " selected" : "") + '>Toutes les séries</option><option value="last"' + (e.dropScope === "last" ? " selected" : "") + ">La dernière série</option></select></label>") +
    '<label class="fl full">Notes<textarea class="f" data-p="note" data-e="' + k + '" placeholder="Réglages de la machine, consignes…">' + esc(e.note) + "</textarea></label></div>";
}
function viewProgram(tid, vid) {
  const t = getItem(tid);
  if (!t) return '<a class="back" href="#/home">‹ Accueil</a><div class="card empty">Programme introuvable.</div>';
  const v = t.variants.find(x => x.id === vid) || t.variants[0];
  const launch = v ? '<button class="btn sm primary" data-act="launchvar" data-t="' + t.id + '" data-v="' + v.id + '">Lancer ' + esc(launchLabel(v)) + "</button>" : "";
  let h = '<div class="spread"><a class="back" href="#/home">‹ Accueil</a>' + launch + "</div>" +
    '<label class="fl" style="margin-top:8px">Nom du programme<input class="f" data-p="tname" maxlength="60" value="' + esc(t.name) + '" style="font-size:20px;font-weight:700"></label>' +
    '<div class="section-title">Séances</div>';
  const delTpl = '<div style="margin-top:32px"><button class="btn danger" data-act="deltpl">Supprimer le programme « ' + esc(t.name) + " »</button></div>";
  if (!t.variants.length) return h + '<div class="card empty-prog"><p class="muted">Ce programme n\'a pas encore de séance. Ajoute la première, puis ses exercices.</p>' +
    '<button class="btn primary block" data-act="addvar">+ Nouvelle séance</button></div>' + delTpl;
  h += '<div class="tabs" data-sortable="var" data-axis="x">' +
    t.variants.map(x => '<button class="' + (v && x.id === v.id ? "on" : "") + '" data-act="tab" data-v="' + x.id + '" data-sort-id="' + x.id + '">' +
      (t.variants.length > 1 ? '<span class="grip" data-drag title="Maintiens et fais glisser pour changer l\'ordre">' + GRIP + "</span>" : "") +
      "<span" + (v && x.id === v.id ? " data-vtab" : "") + ">" + esc(vLabel(x.name)) + "</span></button>").join("") +
    '<button data-act="addvar">+ Séance</button></div>';
  if (!v) return h;
  h += '<div class="card"><label class="fl">Nom de la séance<input class="f" data-p="vname" maxlength="60" value="' + esc(vLabel(v.name)) + '"></label>' +
    '<div class="row" style="margin-top:10px;flex-wrap:wrap">' +
    '<button class="btn sm" data-act="dupvar">Dupliquer cette séance</button><button class="btn sm" data-act="sharevar">Partager cette séance</button>' +
    '<button class="btn sm danger" data-act="delvar">Supprimer cette séance</button>' + "</div></div>";
  h += '<div class="section-title">Exercices (' + v.exercises.length + ')</div><div class="stack">';
  const bl = blocks(v.exercises);
  bl.forEach((blk, bi) => {
    const nextField = bi < bl.length - 1 ? '<div class="fl next-rest"><span>Repos avant l\'exercice suivant</span><button type="button" class="f pick" data-act="picksec" data-sf="next" data-e="' + blk.items[0].i + '">' + fmtSecs(restNextOf(blk.items[0].e, v)) + "</button>" +
      '<span class="small">Démarre quand toutes les séries ' + (blk.groupId ? "du groupe" : "de cet exercice") + " sont validées. « Aucun » : le repos habituel.</span></div>" : "";
    const moves = (bi > 0 ? '<button class="btn sm" data-act="up" data-b="' + bi + '" aria-label="Monter">↑</button>' : "") +
      (bi < bl.length - 1 ? '<button class="btn sm" data-act="down" data-b="' + bi + '" aria-label="Descendre">↓</button>' : "");
    if (blk.groupId) {
      const f = blk.items[0].e, fi = blk.items[0].i, label = GROUP_LABEL[f.groupKind] || "Enchaînement";
      h += '<div class="card group"><div class="spread"><div class="group-tag">' + esc(label) + " · " + blk.items.length + ' exercices enchaînés</div><div class="row">' + moves + "</div></div>" +
        '<div class="ed-grid"><label class="fl">Enchaînement<select class="f" data-p="gkind" data-e="' + fi + '">' +
        (blk.items.length >= 3 ? '<option value="triset" selected>Triset</option>' : '<option value="superset"' + (f.groupKind !== "biset" ? " selected" : "") + '>Superset</option><option value="biset"' + (f.groupKind === "biset" ? " selected" : "") + ">Biset</option>") + "</select></label>" +
        '<label class="fl">Tours (séries)<input class="f" type="number" min="1" max="20" inputmode="numeric" data-p="gsets" data-e="' + fi + '" value="' + esc(f.sets) + '"></label>' +
        '<div class="fl"><span>Repos</span><button type="button" class="f pick" data-act="picksec" data-sf="grest" data-e="' + fi + '">' + fmtSecs(num(f.rest) || 0) + "</button></div></div>";
      blk.items.forEach((x, n) => { h += '<div class="member">' + exFields(x.e, x.i, LETTERS[n], true) + "</div>"; });
      h += nextField;
      h += '<div class="row" style="margin-top:12px;flex-wrap:wrap">' + (blk.items.length < 4 ? '<button class="btn sm" data-act="addmember" data-e="' + fi + '">+ Ajouter un exercice au ' + esc(label.toLowerCase()) + "</button>" : "") +
        '<button class="btn sm" data-act="ungroup" data-e="' + fi + '">Séparer</button><button class="btn sm danger" data-act="delgroup" data-e="' + fi + '">Supprimer</button></div></div>';
    } else {
      const x = blk.items[0];
      h += '<div class="card"><div class="spread"><b><span data-title="' + x.i + '">' + esc(x.e.name) + '</span></b><div class="row">' + moves +
        '<button class="btn sm danger" data-act="delex" data-e="' + x.i + '">Supprimer</button></div></div>' + exFields(x.e, x.i, "", false) + nextField +
        (bi < bl.length - 1 && !bl[bi + 1].groupId ? '<button class="link" style="margin-top:6px" data-act="link" data-b="' + bi + '">Enchaîner avec l\'exercice suivant (superset / biset)</button>' : "") + "</div>";
    }
  });
  h += '<div class="add-row"><button class="btn" data-act="addtplex">+ Ajouter un exercice</button><button class="btn" data-act="addstretch">+ Ajouter un étirement</button></div></div>' + delTpl;
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
// choix d'un ou plusieurs exercices (ou étirements) de la bibliothèque : recherche, filtres, cases à cocher ;
// en musculation, aussi tes propres exercices et un exercice à créer avec le nom tapé
const PK_GROUPS = [["", "Tous"], ["pectoraux", "Pectoraux"], ["dos", "Dos"], ["epaules", "Épaules"], ["bras", "Bras"], ["jambes", "Jambes"], ["abdos", "Abdos"], ["cardio", "Circuit Training"], ["hyrox", "Hyrox"], ["maison", "Sans matériel"], ["own", "Tes exercices"]];
const TYPE_CHOICES = [["reps", "Poids × reps", "Charge et nombre de répétitions"], ["rep", "Reps uniquement", "Pompes, tractions… sans charge"], ["time", "Temps", "Gainage, chaise… avec chrono"], ["dist", "Distance", "Course, rameur, Hyrox… avec chrono"]];
function pickExercises(mode, title) {
  const etir = mode === "etir";
  return new Promise(res => {
    const lib = EXO_LIB.filter(x => etir ? x.cat === "etirement" : x.cat !== "etirement");
    const own = etir ? [] : knownNames().filter(n => !libFor(n)).map(n => ({ id: "own:" + n, n, own: true, nn: norm(n) }));
    const byKey = new Map(); lib.forEach(x => byKey.set(x.id, x)); own.forEach(x => byKey.set(x.id, x));
    const stretchKey = new Map(); if (!etir) EXO_LIB.filter(x => x.cat === "etirement").forEach(x => stretchKey.set(x.id, x)); // trouvés aussi par la recherche
    const picked = [], created = new Map(); // clés dans l'ordre où elles sont cochées ; exercices créés (nom tapé)
    let filt = "", q = "";
    const chips = etir ? [["", "Tous"], ["haut", "Haut"], ["milieu", "Milieu"], ["bas", "Bas"]] : PK_GROUPS.filter(g => g[0] !== "own" || own.length);
    const inFilt = x => !filt || (etir ? x.zone === filt : filt === "own" ? !!x.own : filt === "maison" ? /^Poids du corps/.test(x.gear || "") : !x.own && x.g === filt);
    const sub = x => x.own ? "Tes exercices" : etir || x.cat === "etirement" ? (etir ? "" : "Étirement · ") + x.mus + " · " + x.hold + " s" + (x.side ? " de chaque côté" : "") : x.mus + " · " + x.gear;
    const row = (key, name, s, cls) => '<label class="pk-row' + (cls || "") + '"><input type="checkbox" data-pk="' + esc(key) + '"' + (picked.includes(key) ? " checked" : "") + "><span><b>" + esc(name) + '</b><span class="muted small">' + esc(s) + "</span></span></label>";
    const what = etir ? "étirement" : "exercice";
    const listHtml = () => {
      let h = "";
      created.forEach((c, key) => { h += row(key, c.n, "Ton exercice (réglages modifiables ensuite)", " pk-new"); });
      const qt = q.trim();
      if (qt) {
        const exists = libFor(qt) || own.some(o => o.nn === norm(qt)) || created.has("new:" + qt.slice(0, 80));
        const found = searchExercises(qt), v = found.map(c => byKey.get(c.own ? "own:" + c.n : c.id)).filter(x => x && inFilt(x));
        if (!filt) found.forEach(c => { const x = !c.own && stretchKey.get(c.id); if (x) v.push(x); }); // étirements : après les exercices
        // « Créer » : en premier si rien ne correspond, sinon après les exercices trouvés
        const mk = !etir && !exists ? row("new:" + qt.slice(0, 80), "+ Créer « " + qt.slice(0, 80) + " »", "Ton propre exercice, s'il n'est pas dans la liste", " pk-new") : "";
        return h + (v.length ? v.map(x => row(x.id, x.n, sub(x))).join("") + mk : mk + '<p class="muted small" style="margin:8px 2px">Aucun ' + what + " de la liste ne correspond." + (mk ? " Coche « Créer » pour ajouter le tien." : "") + "</p>");
      }
      const v = lib.concat(own).filter(inFilt);
      const secs = etir ? ["haut", "milieu", "bas"].map(z => [ZONE_NAMES[z], v.filter(x => x.zone === z)])
        : PK_GROUPS.filter(g => g[0] && g[0] !== "maison").map(([g, n]) => [n, v.filter(x => g === "own" ? x.own : !x.own && x.g === g)]);
      return h + secs.filter(s => s[1].length).map(([n, it]) => '<div class="pk-h">' + esc(n) + "</div>" + it.map(x => row(x.id, x.n, sub(x))).join("")).join("");
    };
    const okLabel = () => picked.length ? "Ajouter (" + picked.length + ")" : "Ajouter";
    const d = document.createElement("div"); d.className = "modal sheet";
    d.innerHTML = '<div class="modal-box pk" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h3>' + esc(title) + "</h3>" +
      '<p class="muted small" style="margin:0 0 8px">' + (etir ? "Chaque étirement est ajouté en mode temps : 2 séries de 30 s. " : "") + "Coche-les, puis choisis leur ordre dans la séance.</p>" +
      '<input class="f" type="search" data-pkq placeholder="' + (etir ? "Rechercher un étirement, un muscle" : "Rechercher (ex. dev, pec, rowing)") + '" autocomplete="off" aria-label="Rechercher un ' + what + '">' +
      '<div class="pk-zones" role="group" aria-label="Filtrer">' + chips.map(z => '<button type="button" class="chip-btn" data-pkz="' + z[0] + '" aria-pressed="' + (z[0] === filt) + '">' + z[1] + "</button>").join("") + "</div>" +
      '<div class="pk-list">' + listHtml() + '</div><div class="modal-btns"><button class="btn" data-r="0">Annuler</button><button class="btn primary" data-r="1">' + okLabel() + "</button></div></div>";
    document.body.appendChild(d);
    const box = d.querySelector(".pk-list"), ok = d.querySelector('[data-r="1"]'), qin = d.querySelector("[data-pkq]");
    qin.addEventListener("input", e => { q = e.target.value; box.innerHTML = listHtml(); });
    qin.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); qin.blur(); } });
    d.addEventListener("change", e => {
      const key = e.target.dataset && e.target.dataset.pk; if (!key) return;
      if (e.target.checked) { if (key.startsWith("new:")) created.set(key, { n: key.slice(4) }); if (!picked.includes(key)) picked.push(key); }
      else { const k = picked.indexOf(key); if (k >= 0) picked.splice(k, 1); if (key.startsWith("new:")) created.delete(key); }
      if (key.startsWith("new:")) box.innerHTML = listHtml(); // l'exercice créé passe en haut de la liste
      ok.textContent = okLabel();
    });
    d.addEventListener("click", e => {
      if (e.target === d) { d.remove(); res(null); return; }
      const z = e.target.closest("[data-pkz]"); if (z) { filt = z.dataset.pkz; d.querySelectorAll("[data-pkz]").forEach(x => x.setAttribute("aria-pressed", String(x === z))); box.innerHTML = listHtml(); box.scrollTop = 0; return; }
      const b = e.target.closest("[data-r]"); if (!b) return;
      if (b.dataset.r === "1" && !picked.length) { ok.textContent = "Coche au moins un " + what; return; }
      d.remove();
      const get = k => byKey.get(k) || stretchKey.get(k);
      res(b.dataset.r === "1" ? picked.map(k => k.startsWith("new:") ? { name: created.get(k).n, custom: true } : get(k).own ? { name: get(k).n, own: true } : { lib: get(k), name: get(k).n }) : null);
    });
  });
}
const stretchExercise = x => Object.assign(newExercise(), { name: x.n }, libDefaults(x));
// réglages d'un exercice choisi : ceux de la bibliothèque, sinon ceux que tu utilises déjà pour ce nom dans tes programmes
function ownDefaults(name) {
  const nn = norm(name);
  for (const t of all("template")) for (const v of t.variants) for (const e of v.exercises) if (norm(e.name) === nn)
    return { type: e.type || "reps", sets: e.sets, target: e.target, rest: e.rest, load: !!e.load };
  return null;
}
function libExercise(p) {
  if (p.lib) return p.lib.cat === "etirement" ? stretchExercise(p.lib) : Object.assign(newExercise(), { name: p.lib.n }, libDefaults(p.lib));
  return Object.assign(newExercise(), { name: String(p.name).slice(0, 80) }, ownDefaults(p.name) || {});
}
// ordre dans la séance après un ajout : les nouveaux arrivent à la fin, on les place où on veut (⠿ à faire glisser, ou ↑ ↓) ;
// un superset / biset / triset se déplace en entier ; renvoie la nouvelle liste (ou null si « Annuler »)
function orderNew(list, news, what) {
  return new Promise(res => {
    const bl = blocks(list);
    if (!bl.length && news.length < 2) { res(list.concat(news)); return; }
    const rows = bl.map((b, bi) => ({ key: "b" + bi, n: b.groupId ? (GROUP_LABEL[b.kind] || "Groupe") + " : " + b.items.map(x => x.e.name).join(" + ") : b.items[0].e.name }))
      .concat(news.map((e, k) => ({ key: "n" + k, n: e.name, isNew: true })));
    const d = document.createElement("div"); d.className = "modal sheet";
    d.innerHTML = '<div class="modal-box ord" role="dialog" aria-modal="true" aria-label="Ordre dans la séance"><h3>Ordre dans la séance</h3>' +
      '<p class="muted small" style="margin:0">' + (news.length > 1 ? "Tes " + what + "s sont" : "Ton " + what + " est") + " à la fin. Fais glisser ⠿, ou utilise ↑ ↓, pour choisir l'ordre.</p>" +
      '<div class="ord-list">' + rows.map(r => '<div class="ord-row' + (r.isNew ? " new" : "") + '" data-key="' + r.key + '"><span class="grip" data-odrag title="Maintiens et fais glisser">' + GRIP + '</span><span class="ord-n">' + esc(r.n) + (r.isNew ? ' <span class="tag">Nouveau</span>' : "") + "</span>" +
        '<button type="button" class="btn sm" data-om="-1" aria-label="Monter ' + esc(r.n) + '">↑</button><button type="button" class="btn sm" data-om="1" aria-label="Descendre ' + esc(r.n) + '">↓</button></div>').join("") + "</div>" +
      '<div class="modal-btns"><button class="btn" data-r="0">Annuler</button><button class="btn primary" data-r="1">Valider</button></div></div>';
    document.body.appendChild(d);
    const L = d.querySelector(".ord-list");
    const last = L.lastElementChild; if (last) setTimeout(() => last.scrollIntoView({ block: "nearest" }), 0);
    let drag = null;
    L.addEventListener("pointerdown", e => {
      const h = e.target.closest("[data-odrag]"); if (!h) return;
      e.preventDefault(); drag = { row: h.closest(".ord-row"), id: e.pointerId }; drag.row.classList.add("dragging");
      try { h.setPointerCapture(e.pointerId); } catch (err) { }
    });
    L.addEventListener("pointermove", e => {
      if (!drag || e.pointerId !== drag.id) return; e.preventDefault();
      let before = null;
      for (const r of L.children) { if (r === drag.row) continue; const bb = r.getBoundingClientRect(); if (e.clientY < bb.top + bb.height / 2) { before = r; break; } }
      if (drag.row.nextElementSibling !== before) L.insertBefore(drag.row, before);
      const lb = L.getBoundingClientRect(); if (e.clientY < lb.top + 30) L.scrollTop -= 12; else if (e.clientY > lb.bottom - 30) L.scrollTop += 12;
    });
    const end = () => { if (drag) { drag.row.classList.remove("dragging"); drag = null; } };
    L.addEventListener("pointerup", end); L.addEventListener("pointercancel", end);
    d.addEventListener("click", e => {
      if (e.target === d) { d.remove(); res(null); return; }
      const m = e.target.closest("[data-om]");
      if (m) { const r = m.closest(".ord-row"); if (+m.dataset.om < 0 && r.previousElementSibling) L.insertBefore(r, r.previousElementSibling); else if (+m.dataset.om > 0 && r.nextElementSibling) L.insertBefore(r.nextElementSibling, r); m.focus(); return; }
      const b = e.target.closest("[data-r]"); if (!b) return;
      d.remove();
      if (b.dataset.r !== "1") { res(null); return; }
      const out = [];
      [...L.children].forEach(r => { const k = r.dataset.key; if (k[0] === "b") bl[+k.slice(1)].items.forEach(x => out.push(x.e)); else out.push(news[+k.slice(1)]); });
      res(out);
    });
  });
}
// demande le nom d'un ou plusieurs exercices, avec la liste des exercices déjà connus
function askNames(title, n, text) {
  return new Promise(res => {
    const d = document.createElement("div"); d.className = "modal";
    let f = "";
    for (let k = 0; k < n; k++) f += '<label class="fl">' + (n > 1 ? "Exercice " + LETTERS[k] : "Nom de l'exercice") + '<input class="f" data-suggest autocomplete="off" data-k="' + k + '" placeholder="Tape un nom ou un muscle (ex. dev, pec)"><div class="sugg" hidden></div></label>';
    d.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h3>' + esc(title) + "</h3>" + (text ? "<p>" + esc(text) + "</p>" : "") + f +
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

/* ================= Étirements conseillés après une séance ================= */
// zone travaillée d'après les muscles principaux des exercices de la bibliothèque, sinon d'après le nom
const ZONE_OF = { pectoraux: "haut", deltoides: "haut", trapezes: "haut", dorsaux: "haut", biceps: "haut", triceps: "haut", "avant-bras": "haut",
  abdominaux: "milieu", obliques: "milieu", lombaires: "milieu", quadriceps: "bas", "ischio-jambiers": "bas", fessiers: "bas", adducteurs: "bas", abducteurs: "bas", mollets: "bas" };
const ZONE_NAMES = { haut: "Haut du corps", milieu: "Milieu du corps", bas: "Bas du corps" };
function zonesOf(e) {
  const lib = libFor(e.name), out = new Set();
  if (lib && lib.cat === "etirement") return out;
  if (lib) words(lib.mus).forEach(m => { const z = ZONE_OF[m] || (/^deltoide/.test(m) ? "haut" : /^ischio/.test(m) ? "bas" : /^avant/.test(m) ? "haut" : null); if (z) out.add(z); });
  if (!out.size) { const n = norm(e.name);
    if (/squat|fente|jambe|leg|mollet|cuisse|fessier|hip thrust|soulev|presse|ischio|adduc|course|velo|rameur/.test(n)) out.add("bas");
    if (/abdo|gainage|crunch|planche|oblique|lombaire|russian/.test(n)) out.add("milieu");
    if (/develop|pompe|curl|tirage|rowing|traction|dips|epaule|biceps|triceps|pec|oiseau|elevation|face pull/.test(n)) out.add("haut"); }
  return out;
}
function stretchDismissed(id) { try { return localStorage.getItem("fiitday-stretch-ok") === id; } catch (e) { return false; } }
const STRETCH_MIN = 15; // la carte reste 15 min en haut de l'accueil après la fin d'une séance
let stretchTimer = null;
function homeStretch(act) {
  clearTimeout(stretchTimer);
  const w = finished()[0]; if (act || !w || stretchDismissed(w.id) || settings().stretchTips === "non") return ""; // désactivable dans Réglages
  const left = w.endedAt + STRETCH_MIN * 60000 - Date.now(); if (left <= 0) return "";
  stretchTimer = setTimeout(() => { if (route().name === "home") softRender(); }, left + 500); // disparaît toute seule
  return stretchCard(w, true);
}
// étirements conseillés : ceux des muscles travaillés (retour au calme), et ceux des zones reposées (souplesse) ;
// une séance qui fait travailler tout le corps n'a que le retour au calme ; les étirements déjà faits pendant la séance ne sont pas reproposés
// exercice perso → exercice de la bibliothèque le plus proche (mots, abréviations, acronymes, fautes de frappe) ; null si pas assez sûr
const FILLER = new Set(["a", "au", "aux", "de", "du", "des", "la", "le", "les", "l", "d", "en", "et", "avec", "sur", "sans", "the", "with", "prise", "serree", "large", "lourd", "leger", "lent", "lente", "explosif", "tempo", "pause", "serie", "series", "kg", "rpe", "max", "variante", "perso", "mon", "ma"]);
const matchCache = {};
function matchLib(name) {
  const exact = libFor(name); if (exact) return exact;
  const key = norm(name); if (key in matchCache) return matchCache[key];
  const toks = words(name).filter(t => !FILLER.has(t) && !/^\d+$/.test(t));
  let best = null, bestSc = 0;
  if (toks.length) for (const c of EXO_LIB) {
    if (c.cat === "etirement") continue;
    let sc = 0, hit = 0, strong = false, firstHit = false;
    const head = { w: [c.w[0]] }; // 1er mot du nom de la bibliothèque : le mouvement (Squat, Curl, Développé, Oiseau…)
    for (const t of toks) {
      const v = tokScore(t, c); if (!v) continue;
      hit++; sc += v; if (v >= 2.7) strong = true;
      if (direct(t, head) >= 3) firstHit = true;
      // abréviation / nom anglais qui donne le nom complet (« skull » → barre au front, « bench » → développé couché)
      if (SYN[t] && SYN[t].split("|").some(alt => { const ws = alt.split(" "); return direct(ws[0], head) >= 3 && ws.every(x => direct(x, c) >= 3); })) { firstHit = true; strong = true; }
    }
    // un mot qui correspond vraiment, et plus de la moitié des mots retrouvés (ou le mot du mouvement)
    if (!strong || !(hit / toks.length > 0.5 || firstHit)) continue;
    sc += 2 * hit / toks.length + (firstHit ? 2 : 0);
    if (sc > bestSc) { best = c; bestSc = sc; }
  }
  return (matchCache[key] = best);
}
// muscles cités dans le nom (« machine pecs », « jambes », « fessiers élastique »…) : utilisés si aucun exercice ne correspond
const MUSCLE_WORDS = [[/^pecs?$|pecto|chest|torse/, ["Pectoraux"]], [/bicep|^bi$/, ["Biceps"]], [/tricep|^tri$/, ["Triceps"]],
  [/epaul|deltoid|delt|shoulder/, ["Deltoïdes antérieurs", "Deltoïdes latéraux", "Deltoïdes postérieurs"]], [/^dos$|dorsa|^back$/, ["Dorsaux"]], [/trap/, ["Trapèzes"]],
  [/lombaire|lowerback/, ["Lombaires"]], [/abdo|^abs?$|^core$/, ["Abdominaux"]], [/oblique/, ["Obliques"]], [/quadri|^quads?$|cuisse/, ["Quadriceps"]], [/ischio|hamstring/, ["Ischio-jambiers"]],
  [/fess|glute|booty/, ["Fessiers"]], [/adduct/, ["Adducteurs"]], [/abduct/, ["Abducteurs (moyen fessier)"]], [/mollet|^calf$|calves/, ["Mollets"]], [/avantbras|forearm|poignet/, ["Avant-bras"]],
  [/^jambes?$|^legs?$/, ["Quadriceps", "Ischio-jambiers", "Fessiers"], 1], [/^bras$|^arms?$/, ["Biceps", "Triceps"], 1]];
// vague (1) : « jambes », « bras » désignent souvent la partie du corps qui bouge (« Relevé de jambes ») : seulement si aucun exercice ne correspond
function musclesOf(name, precise) {
  const ws = words(name.replace(/avant[- ]bras/i, "avantbras").replace(/lower back/i, "lowerback")), out = new Set();
  if (ws.length && ws.every(w => FILLER.has(w) || MUSCLE_WORDS.some(([re]) => re.test(w)))) precise = false; // le nom n'est fait que de muscles (« Jambes », « Pecs triceps »)
  ws.forEach(w => MUSCLE_WORDS.forEach(([re, ms, vague]) => { if (re.test(w) && !(precise && vague)) ms.forEach(m => out.add(m)); }));
  return Array.from(out);
}
window.__fiitdayMatch = n => { const om = words(n).every(x => FILLER.has(x) || MUSCLE_WORDS.some(([re]) => re.test(x))), m = om ? null : matchLib(n), named = musclesOf(n, !!m), keep = m && !(named.length && !m.mus.split(", ").some(x => named.includes(x))); return { lib: keep ? m : null, mus: keep ? [] : named }; }; // vérification de la concordance (tests)
function stretchPlan(w) {
  const lib = EXO_LIB.filter(x => x.cat === "etirement"), done = new Set(), mus = {}, zones = new Set();
  const used = w.exercises.filter(exHasData), list = used.length ? used : w.exercises;
  for (const e of w.exercises) { const l = libFor(e.name); if (l && l.cat === "etirement" && (exHasData(e) || !used.length)) done.add(l.id); }
  for (const e of list) {
    const l = libFor(e.name); if (l && l.cat === "etirement") continue;
    // muscles travaillés : ceux de l'exercice de la bibliothèque, ou de celui qui correspond à ton exercice perso, sinon ceux cités dans son nom
    const named0 = l ? [] : musclesOf(e.name, false), onlyMus = !l && words(e.name).every(x => FILLER.has(x) || MUSCLE_WORDS.some(([re]) => re.test(x)));
    const m = l || (onlyMus ? null : matchLib(e.name)), named = l ? [] : onlyMus ? named0 : musclesOf(e.name, !!m);
    // un muscle cité dans le nom que l'exercice trouvé ne travaille pas (« Machine pecs », « Calf raise ») : c'est le nom qui compte
    const ms = m && !(named.length && !m.mus.split(", ").some(x => named.includes(x))) ? m.mus.split(", ") : named;
    ms.forEach(x => { mus[norm(x)] = (mus[norm(x)] || 0) + 1; });
    ms.forEach(x => { const z = ZONE_OF[words(x)[0]] || (/^deltoide|^avant/.test(norm(x)) ? "haut" : /^ischio|^abducteur/.test(norm(x)) ? "bas" : null); if (z) zones.add(z); });
  }
  const left = lib.filter(x => !done.has(x.id));
  const score = x => x.mus.split(", ").reduce((n, m) => n + (mus[norm(m)] || 0), 0);
  let calm = left.filter(x => score(x) > 0);
  if (calm.length > 8) { const keep = new Set(calm.slice().sort((a, b) => score(b) - score(a) || a.k - b.k).slice(0, 8)); calm = calm.filter(x => keep.has(x)); }
  const worked = ["haut", "milieu", "bas"].filter(z => zones.has(z)), rested = ["haut", "milieu", "bas"].filter(z => !zones.has(z));
  const flex = worked.length && worked.length < 3 ? left.filter(x => rested.includes(x.zone) && !calm.includes(x)) : [];
  return { calm, flex, worked, rested: rested.filter(z => flex.some(x => x.zone === z)), done: done.size };
}
function stretchCard(w, onHome) {
  const P = stretchPlan(w);
  if (!P.calm.length && !P.flex.length) return "";
  const zl = zs => zs.map(z => ZONE_NAMES[z].toLowerCase()).join(" et ");
  const go = (seq, label) => '<button type="button" class="btn sm" data-act="stretchgo" data-seq="' + seq.map(x => x.id).join(",") + '">' + esc(label) + " ›</button>";
  const row = (title, txt, seq) => '<div class="sc-row"><div><b>' + esc(title) + '</b><span class="muted small">' + esc(txt) + "</span></div>" + go(seq, "Commencer (" + seq.length + ")") + "</div>";
  let rows = "";
  if (P.calm.length) rows += row("Maintenant, en douceur", "Retour au calme des muscles travaillés : 1 à 2 fois 20 à 30 s par étirement, sans forcer", P.calm);
  if (P.flex.length) rows += row("Pour gagner en souplesse", ZONE_NAMES[P.rested[0]] + (P.rested[1] ? " et " + ZONE_NAMES[P.rested[1]].toLowerCase() : "") + " : ces muscles sont chauds et reposés, 2 à 4 fois 30 s", P.flex);
  const intro = P.worked.length === 3 ? "tout le corps a travaillé, donc seulement un retour au calme" : P.worked.length ? "surtout le " + zl(P.worked) : "";
  return '<div class="card stretch-card' + (onHome ? " top" : "") + '"><div class="spread"><h2>Étirements conseillés</h2>' + (onHome ? '<button type="button" class="linkbtn" data-act="stretchok" data-id="' + esc(w.id) + '">Masquer</button>' : "") + "</div>" +
    '<p class="muted small" style="margin:2px 0 8px">' + (onHome ? "Après ta séance " + esc(w.templateName) : "Cette séance") + (intro ? " : " + esc(intro) : "") + "." + (P.done ? " Les étirements déjà faits pendant la séance ne sont pas reproposés." : "") + "</p>" + rows +
    '<a class="exo-link small" href="#/exercices/conseils-etirements" data-act="stretchtips">Conseils pour bien s\'étirer ›</a></div>';
}

/* ================= Écran : historique ================= */
function historyRow(w) {
  const done = w.exercises.reduce((n, e) => n + e.sets.filter(s => s.done || setHasData(s, e.type)).length, 0);
  // glisser la ligne de droite à gauche fait apparaître « Supprimer »
  return '<div class="swipe"><button type="button" class="swipe-del" data-act="swipedel" data-id="' + esc(w.id) + '" tabindex="-1">Supprimer</button>' +
    '<a class="swipe-row" draggable="false" href="#/session/' + w.id + '"><div><b>' + esc(w.templateName) + '</b> <span class="muted">· ' + esc(vLabel(w.variantName)) + '</span><div class="muted small">' +
    esc(fmtDate(w.startedAt)) + " · " + w.exercises.length + " exercices · " + done + ' séries</div></div><span class="muted small num">' + fmtDur((w.endedAt || Date.now()) - w.startedAt) + "</span></a></div>";
}
// glisser pour supprimer : la ligne suit le doigt (ou la souris) horizontalement ; le défilement vertical reste normal
const SW_W = 104;
let sw = null, swOpen = null, swipedAt = 0;
function swClose(row) { if (row) { row.style.transform = ""; row.parentElement.classList.remove("open"); } if (swOpen === row) swOpen = null; }
$app.addEventListener("pointerdown", e => {
  const row = e.target.closest && e.target.closest(".swipe-row");
  if (swOpen && swOpen !== row && !(e.target.closest && e.target.closest(".swipe-del"))) swClose(swOpen);
  if (!row || e.button > 0) return;
  sw = { row, x: e.clientX, y: e.clientY, base: swOpen === row ? -SW_W : 0, dir: null, dx: 0, id: e.pointerId };
});
$app.addEventListener("pointermove", e => {
  if (!sw || e.pointerId !== sw.id) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (!sw.dir) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    sw.dir = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    if (sw.dir === "h") { sw.row.classList.add("swiping"); try { sw.row.setPointerCapture(e.pointerId); } catch (err) { } }
  }
  if (sw.dir !== "h") return;
  sw.dx = Math.max(-SW_W - 30, Math.min(0, sw.base + dx));
  sw.row.style.transform = "translateX(" + sw.dx + "px)";
});
const swEnd = e => {
  if (!sw || e.pointerId !== sw.id) return;
  const s0 = sw; sw = null;
  if (s0.dir !== "h") return;
  s0.row.classList.remove("swiping"); swipedAt = Date.now();
  if (s0.dx < -SW_W / 2) { s0.row.style.transform = "translateX(" + -SW_W + "px)"; s0.row.parentElement.classList.add("open"); swOpen = s0.row; }
  else swClose(s0.row);
};
$app.addEventListener("pointerup", swEnd);
$app.addEventListener("pointercancel", swEnd);
// juste après un glissé, la séance ne s'ouvre pas ; toucher une ligne ouverte la referme
$app.addEventListener("click", e => {
  const row = e.target.closest && e.target.closest(".swipe-row"); if (!row) return;
  const justSwiped = Date.now() - swipedAt < 350;
  if (justSwiped || row === swOpen) { e.preventDefault(); e.stopPropagation(); if (!justSwiped) swClose(row); }
}, true);
function viewHistory() {
  const ws = finished();
  const head = '<div class="page-head"><h1>Stats</h1></div>' + statsTabs("history");
  if (!ws.length) return head + '<div class="card empty">Aucune séance terminée pour l\'instant.</div>';
  let h = head + '<p class="muted small" style="margin:0 2px 4px">' + ws.length + " séance" + (ws.length > 1 ? "s" : "") + " terminée" + (ws.length > 1 ? "s" : "") + ". Touche une séance pour la voir ou la corriger, glisse-la vers la gauche pour la supprimer.</p>", month = "";
  ws.slice(0, histLimit).forEach(w => {
    const m = dfMonth.format(w.startedAt);
    if (m !== month) { if (month) h += "</div>"; month = m; h += '<div class="section-title">' + esc(m) + '</div><div class="list">'; }
    h += historyRow(w);
  });
  h += "</div>";
  // longue liste : affichée par tranches de 100
  if (ws.length > histLimit) h += '<button class="btn block" data-act="histmore" style="margin-top:12px">Afficher les séances plus anciennes (' + (ws.length - histLimit) + ")</button>";
  return h;
}
let histLimit = 100;

/* ================= Écran : progression ================= */
function progressData() {
  const map = {};
  for (const w of finished().slice().reverse()) {
    for (const e of w.exercises) {
      if (!exHasData(e)) continue;
      const key = norm(e.name) + "|" + e.type;
      const D = e.type === "dist", T = e.type === "time" || D, RO = e.type === "rep", vs = e.sets.map(s => num(T ? s.sec : RO ? s.reps : s.kg)).filter(x => x != null && (!D || x > 0));
      const best = vs.length ? (D ? Math.min(...vs) : Math.max(...vs)) : -Infinity;
      const reps = T ? null : Math.max(...e.sets.map(s => num(s.reps)).filter(x => x != null), -Infinity);
      const orm = T || RO ? null : Math.max(...e.sets.map(s => e1rm(num(s.kg), num(s.reps))).filter(x => x != null), -Infinity);
      const kgs = e.sets.map(s => num(s.kg)).filter(x => x != null && x > 0), kg = kgs.length ? Math.max(...kgs) : null;
      const sec = T && vs.length ? (D ? Math.min(...vs) : Math.max(...vs)) : null;
      (map[key] = map[key] || { key, name: e.name, type: e.type, entries: [] }).entries.push({ w, e, best: best === -Infinity ? null : best, reps: reps === -Infinity ? null : reps, orm: orm === -Infinity ? null : orm, kg, sec });
      map[key].name = e.name;
    }
  }
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
const unitOf = p => p.type === "time" ? " s" : p.type === "dist" ? "" : p.type === "rep" ? " reps" : " kg";
const bestOf = (p, vs) => (vs.length ? (p.type === "dist" ? Math.min(...vs) : Math.max(...vs)) : null);
const fmtVal = (p, v) => (p.type === "dist" ? fmtClock(v) : p.type === "time" ? fmtHold(v) : fmtNum(v) + unitOf(p));
const noRM = p => p.type === "time" || p.type === "dist" || p.type === "rep";
function weekStart(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
function prevWeek(t) { const d = new Date(t); d.setDate(d.getDate() - 7); return d.getTime(); }
function viewProgress() {
  const ws = finished(), now = Date.now(), goal = num(settings().goal) || 5;
  let h = '<div class="page-head"><h1>Stats</h1></div>' + statsTabs("progress");
  if (!ws.length) return h + '<div class="card empty">Termine une première séance pour voir tes stats.</div>';
  const perWeek = {}; ws.forEach(w => { const k = weekStart(w.startedAt); perWeek[k] = (perWeek[k] || 0) + 1; });
  const cur = weekStart(now), thisWeek = perWeek[cur] || 0;
  const m0 = new Date(now); m0.setHours(0, 0, 0, 0); m0.setDate(1);
  const thisMonth = ws.filter(w => w.startedAt >= m0.getTime()).length;
  // semaines d'affilée avec l'objectif atteint (la semaine en cours compte si l'objectif est déjà atteint)
  let streak = 0, wk = (perWeek[cur] || 0) >= goal ? cur : prevWeek(cur);
  while ((perWeek[wk] || 0) >= goal) { streak++; wk = prevWeek(wk); }
  const pct = Math.min(100, Math.round(100 * thisWeek / goal));
  h += '<div class="stats k3">' +
    '<div class="card stat"><div class="muted small">Cette semaine</div><div class="v num">' + thisWeek + " <small>/ " + goal + '</small></div><div class="meter" role="img" aria-label="' + thisWeek + " séances sur " + goal + '"><span style="width:' + pct + '%"></span></div></div>' +
    '<div class="card stat"><div class="muted small">Ce mois-ci</div><div class="v num">' + thisMonth + "</div></div>" +
    '<div class="card stat"><div class="muted small">Au total</div><div class="v num">' + ws.length + "</div></div>" +
    '<div class="card stat"><div class="muted small">Semaines objectif atteint</div><div class="v num">' + streak + " <small>d'affilée</small></div></div>" +
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
  return h;
}
/* ================= Stats : évolution d'un exercice ================= */
// courbes possibles selon le type d'exercice ; « low » : plus bas = mieux (temps d'un exercice à distance)
const EVO_M = {
  kg: { label: "Charge max", short: "Charge", unit: " kg" },
  orm: { label: "1RM estimé", short: "1RM estimé", unit: " kg" },
  reps: { label: "Répétitions max", short: "Répétitions", unit: " reps" },
  sec: { label: "Temps max", short: "Temps", unit: " s" },
  run: { label: "Meilleur temps", short: "Temps", unit: "", low: true, clock: true }
};
const EVO_P = [["1m", "1 mois", 31], ["3m", "3 mois", 92], ["6m", "6 mois", 183], ["1a", "1 an", 366], ["all", "Tout", 0]];
const evo = { q: "", m: {}, per: "all" };
const evoVal = (x, m) => (m === "run" ? x.sec : x[m]);
function evoMetrics(p) {
  const has = f => p.entries.some(x => evoVal(x, f) != null);
  if (p.type === "time") return ["sec"];
  if (p.type === "dist") return ["run"].concat(has("kg") ? ["kg"] : []);
  if (p.type === "rep") return ["reps"];
  const out = []; if (has("kg")) out.push("kg", "orm"); if (has("reps")) out.push("reps");
  return out.length ? out : ["reps"];
}
const evoFmt = (m, v) => (v == null ? "—" : EVO_M[m].clock ? fmtClock(v) : m === "sec" ? fmtHold(v) : fmtNum(m === "orm" ? Math.round(v * 2) / 2 : v) + EVO_M[m].unit);
function evoDiff(m, d) {
  if (d == null) return "—";
  const r = Math.round(Math.abs(d) * (m === "orm" ? 2 : 100)) / (m === "orm" ? 2 : 100);
  if (!r) return "Stable";
  return (d > 0 ? "+" : "−") + (EVO_M[m].clock ? fmtClock(r) : m === "sec" ? fmtHold(r) : fmtNum(r) + EVO_M[m].unit);
}
// recherche parmi les exercices déjà faits (mêmes règles que la recherche d'exercices : fautes, synonymes, muscles)
function evoCands() {
  const ps = progressData(), seen = {};
  ps.forEach(p => { seen[p.name] = (seen[p.name] || 0) + 1; });
  return ps.map(p => {
    const lib = libFor(p.name), last = p.entries[p.entries.length - 1].w.startedAt;
    return { p, n: p.name, nn: norm(p.name), w: words(p.name), a: lib ? words(lib.n + " " + lib.al.join(" ")) : [], o: lib ? lib.o : [], last,
      dup: seen[p.name] > 1 ? ({ time: "temps", dist: "distance" }[p.type] || "poids × reps") : "" };
  });
}
function evoSearch(q) {
  const toks = words(q), cs = evoCands();
  if (!toks.length) return cs.sort((a, b) => b.last - a.last);
  return cs.map(c => { let sc = 0; for (const t of toks) { const v = tokScore(t, c); if (!v) return null; sc += v; } return { c, sc: sc + (c.nn.startsWith(norm(q)) ? 2 : 0) }; })
    .filter(Boolean).sort((a, b) => b.sc - a.sc || b.c.last - a.c.last).map(x => x.c);
}
function sparkline(vals, low) {
  if (vals.length < 2) return "";
  const W = 64, H = 22, mn = Math.min(...vals), mx = Math.max(...vals), r = mx - mn || 1;
  const pt = (v, k) => (k * (W - 4) / (vals.length - 1) + 2).toFixed(1) + "," + (H - 3 - ((low ? mx - v : v - mn) / r) * (H - 6)).toFixed(1);
  return '<svg class="spark" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true"><polyline points="' + vals.map(pt).join(" ") + '"></polyline></svg>';
}
function evoListHtml() {
  const hits = evoSearch(evo.q);
  if (!hits.length) {
    const lib = evo.q.trim() ? searchExercises(evo.q).filter(c => !c.own)[0] : null;
    return '<div class="card empty">' + (lib
      ? "Tu n'as pas encore fait « " + esc(lib.n) + " » pendant une séance. Sa courbe apparaîtra dès que tu auras terminé une séance avec cet exercice."
      : "Aucun exercice fait en séance ne correspond à « " + esc(evo.q.trim()) + " ».") + "</div>";
  }
  return '<div class="list">' + hits.map(c => {
    const p = c.p, m = evoMetrics(p)[0], vs = p.entries.map(x => evoVal(x, m)).filter(v => v != null);
    const rec = vs.length ? (EVO_M[m].low ? Math.min(...vs) : Math.max(...vs)) : null;
    return '<a href="#/evolution/' + encodeURIComponent(p.key) + '"><div><b>' + esc(p.name) + "</b>" + (c.dup ? ' <span class="muted small">· ' + c.dup + "</span>" : "") +
      '<div class="muted small">' + p.entries.length + " séance" + (p.entries.length > 1 ? "s" : "") + " · " + esc(dfDay.format(c.last)) + "</div></div>" +
      '<span class="evo-r">' + sparkline(vs.slice(-12), EVO_M[m].low) + '<span class="small"><b>' + evoFmt(m, rec) + '</b> <span class="muted">record</span></span></span></a>';
  }).join("") + "</div>";
}
function viewEvolution() {
  let h = '<div class="page-head"><h1>Stats</h1></div>' + statsTabs("evolution");
  if (!progressData().length) return h + '<div class="card empty">Termine une séance pour voir l\'évolution de tes exercices. Seuls les exercices faits pendant une séance terminée apparaissent ici.</div>';
  return h + '<label class="evo-search"><span class="sr">Rechercher un exercice</span><input type="search" class="f" data-evo-q placeholder="Rechercher un exercice" autocomplete="off" value="' + esc(evo.q) + '"></label>' +
    '<p class="muted small" style="margin:6px 2px 10px">Choisis un exercice pour voir sa courbe dans le temps. Seuls ceux que tu as faits en séance apparaissent.</p><div id="evo-list">' + evoListHtml() + "</div>";
}
document.addEventListener("input", e => {
  if (!e.target.matches || !e.target.matches("input[data-evo-q]")) return;
  evo.q = e.target.value; const box = document.getElementById("evo-list"); if (box) box.innerHTML = evoListHtml();
});
// courbe : axe du temps à l'échelle, une seule série, info-bulle qui suit le doigt
let evoCur = null;
function niceStep(raw, clock) {
  const steps = clock ? [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600] : null;
  if (steps) return steps.find(x => x >= raw) || 3600;
  const p10 = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p10;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p10;
}
function evoChart(p, m, pts, W) {
  W = W || 360; const H = W > 520 ? 250 : 210, L = 44, R = 16, T = 26, B = 28, pw = W - L - R, ph = H - T - B, M = EVO_M[m];
  const vs = pts.map(x => x.v), mn = Math.min(...vs), mx = Math.max(...vs);
  let step = niceStep(((mx - mn) || Math.max(1, mx * 0.1)) / 3, M.clock || m === "sec"); // temps tenu : graduations en secondes rondes (5 s, 10 s, 15 s…)
  if (!M.clock && m !== "orm" && step < 1 && (m === "reps" || m === "sec")) step = 1;
  let y0 = Math.floor(mn / step) * step, y1 = Math.ceil(mx / step) * step;
  if (y1 === y0) { y0 = Math.max(0, y0 - step); y1 += step; }
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t, span = t1 - t0;
  const X = t => L + (span ? ((t - t0) / span) * pw : pw / 2), Y = v => T + (1 - (v - y0) / (y1 - y0)) * ph;
  const recV = M.low ? mn : mx, recK = pts.map(x => x.v).lastIndexOf(recV), lastK = pts.length - 1;
  pts.forEach(x => { x.x = X(x.t); x.y = Y(x.v); });
  let svg = '<svg class="chart evo-svg" viewBox="0 0 ' + W + " " + H + '" tabindex="0" role="img" aria-label="' + esc(M.label + " de " + p.name + " : " + pts.length + " séances, record " + evoFmt(m, recV) + ", dernière " + evoFmt(m, pts[lastK].v)) + '">' +
    '<defs><linearGradient id="evoG" x1="0" x2="0" y1="0" y2="1"><stop offset="0"></stop><stop offset="1"></stop></linearGradient></defs>';
  for (let v = y0; v <= y1 + step / 1000; v += step) {
    const y = Y(v).toFixed(1);
    svg += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"></line><text x="' + (L - 8) + '" y="' + (+y + 4) + '" text-anchor="end">' + (M.clock || (m === "sec" && v >= 60) ? fmtClock(v) : fmtNum(v)) + "</text>";
  }
  const dfx = span > 300 * 86400000 ? DF({ month: "short", year: "2-digit" }) : DF({ day: "numeric", month: "short" });
  const xl = pts.length > 1 ? [0, lastK] : [0];
  if (pts.length > 2 && span > 0) { const mid = (t0 + t1) / 2; let k = 0; pts.forEach((x, n) => { if (Math.abs(x.t - mid) < Math.abs(pts[k].t - mid)) k = n; }); if (k !== 0 && k !== lastK && Math.abs(pts[k].x - pts[0].x) > 70 && Math.abs(pts[lastK].x - pts[k].x) > 70) xl.splice(1, 0, k); }
  xl.forEach(k => { const x = pts[k].x, anchor = pts.length === 1 ? "middle" : k === 0 ? "start" : k === lastK ? "end" : "middle";
    svg += '<text x="' + (anchor === "start" ? x - 4 : anchor === "end" ? x + 4 : x).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + anchor + '">' + esc(dfx.format(pts[k].t)) + "</text>"; });
  if (pts.length > 1) {
    const line = pts.map((x, k) => (k ? "L" : "M") + x.x.toFixed(1) + "," + x.y.toFixed(1)).join("");
    svg += '<path class="area" d="' + line + "L" + pts[lastK].x.toFixed(1) + "," + (T + ph) + "L" + pts[0].x.toFixed(1) + "," + (T + ph) + 'Z"></path><path class="line" d="' + line + '"></path>';
  }
  const dots = pts.length <= 40;
  pts.forEach((x, k) => { if (dots || k === recK || k === lastK) svg += '<circle class="dot' + (k === recK ? " rec" : "") + '" cx="' + x.x.toFixed(1) + '" cy="' + x.y.toFixed(1) + '" r="' + (k === recK ? 5.5 : 4) + '"></circle>'; });
  // étiquettes choisies : le record et la dernière séance seulement
  const lab = (k, txt) => { const x = Math.min(W - R - 2, Math.max(L + 2, pts[k].x)), y = pts[k].y - 11 < T - 14 ? pts[k].y + 20 : pts[k].y - 11;
    const anchor = pts[k].x > W - R - 40 ? "end" : pts[k].x < L + 40 ? "start" : "middle";
    return '<text class="lab" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="' + anchor + '">' + esc(txt) + "</text>"; };
  if (pts.length > 1) { svg += lab(recK, "Record " + evoFmt(m, recV)); if (lastK !== recK && Math.abs(pts[lastK].x - pts[recK].x) > 90) svg += lab(lastK, evoFmt(m, pts[lastK].v)); }
  svg += '<line class="xhair" x1="0" x2="0" y1="' + T + '" y2="' + (T + ph) + '" visibility="hidden"></line><circle class="focus" r="6" cx="0" cy="0" visibility="hidden"></circle></svg>';
  return svg;
}
function evoPick(k) {
  if (!evoCur || !evoCur.pts[k]) return;
  evoCur.k = k; const x = evoCur.pts[k], svg = document.querySelector(".evo-svg"), out = document.querySelector(".evo-read"); if (!svg || !out) return;
  const xh = svg.querySelector(".xhair"), f = svg.querySelector(".focus");
  xh.setAttribute("x1", x.x); xh.setAttribute("x2", x.x); xh.setAttribute("visibility", "visible");
  f.setAttribute("cx", x.x); f.setAttribute("cy", x.y); f.setAttribute("visibility", "visible");
  out.querySelector("b").textContent = evoFmt(evoCur.m, x.v);
  out.querySelector(".d").textContent = fmtDateLong(x.t) + " · " + x.ses;
  out.querySelector(".s").textContent = x.sum;
}
function evoNearest(ev) {
  const svg = ev.target.closest && ev.target.closest(".evo-svg"); if (!svg || !evoCur) return;
  const r = svg.getBoundingClientRect(), vx = ((ev.clientX - r.left) / r.width) * (evoCur.W || 360);
  let k = 0; evoCur.pts.forEach((x, n) => { if (Math.abs(x.x - vx) < Math.abs(evoCur.pts[k].x - vx)) k = n; });
  if (k !== evoCur.k) evoPick(k);
}
$app.addEventListener("pointerdown", evoNearest);
$app.addEventListener("pointermove", evoNearest);
$app.addEventListener("keydown", e => {
  if (!evoCur || !e.target.classList || !e.target.classList.contains("evo-svg")) return;
  const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : e.key === "Home" ? -1e9 : e.key === "End" ? 1e9 : 0; if (!d) return;
  e.preventDefault(); evoPick(Math.max(0, Math.min(evoCur.pts.length - 1, (evoCur.k == null ? evoCur.pts.length - 1 : evoCur.k) + d)));
});
// la courbe est redessinée à la largeur réelle de l'écran (textes à la bonne taille sur PC)
function evoFit() {
  if (!evoCur) return;
  const card = document.querySelector(".evo-card"), old = card && card.querySelector(".evo-svg"); if (!old) return;
  const W = Math.max(300, Math.min(1000, Math.round(old.getBoundingClientRect().width)));
  if (Math.abs(W - evoCur.W) > 24) { evoCur.W = W; old.outerHTML = evoChart(evoCur.p, evoCur.m, evoCur.pts, W); }
  evoPick(evoCur.k);
}
window.addEventListener("resize", () => { if (document.querySelector(".evo-svg")) evoFit(); });
function viewEvolutionDetail(key) {
  evoCur = null;
  const p = progressData().find(x => x.key === key);
  const back = '<a class="back" href="#/evolution">‹ Évolution</a>';
  if (!p) return back + '<div class="card empty">Pas encore de données pour cet exercice.</div>';
  const ms = evoMetrics(p), m = ms.includes(evo.m[key]) ? evo.m[key] : ms[0], M = EVO_M[m];
  const allT = p.entries.map(x => x.w.startedAt), fullSpan = allT[allT.length - 1] - allT[0];
  const pers = EVO_P.filter(x => !x[2] || fullSpan > x[2] * 86400000 * 0.9);
  const per = pers.some(x => x[0] === evo.per) ? evo.per : "all", days = (EVO_P.find(x => x[0] === per) || [0, 0, 0])[2];
  const from = days ? Date.now() - days * 86400000 : -Infinity;
  const ent = p.entries.filter(x => x.w.startedAt >= from);
  const pts = ent.filter(x => evoVal(x, m) != null).map(x => ({ t: x.w.startedAt, v: evoVal(x, m), ses: x.w.templateName + " · " + vLabel(x.w.variantName), sum: exSummary(x.e) }));
  const lib = libFor(p.name);
  let h = back + '<div class="page-head"><h1>' + esc(p.name) + "</h1></div>" +
    (lib ? '<div class="ex-chips" style="margin:-4px 0 12px"><button type="button" class="chip-mini" data-act="exoview" data-id="' + esc(lib.id) + '">' + ICON.play + "Voir le mouvement</button></div>" : "");
  const seg = (list, on, act) => '<div class="seg evo-seg" role="group">' + list.map(x => '<button type="button" data-act="' + act + '" data-k="' + esc(key) + '" data-v="' + x[0] + '"' + (x[0] === on ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + ">" + esc(x[1]) + "</button>").join("") + "</div>";
  if (ms.length > 1 || pers.length > 1) h += '<div class="evo-filters">' + (ms.length > 1 ? seg(ms.map(x => [x, EVO_M[x].short]), m, "evometric") : "") + (pers.length > 1 ? seg(pers, per, "evoper") : "") + "</div>";
  if (!pts.length) return h + '<div class="card empty">Aucune séance avec cet exercice sur cette période.</div>';
  const vs = pts.map(x => x.v), best = M.low ? Math.min(...vs) : Math.max(...vs), first = pts[0].v, last = pts[pts.length - 1].v;
  const dlt = pts.length > 1 ? last - first : null, good = dlt == null || !dlt ? "" : (M.low ? dlt < 0 : dlt > 0) ? " up" : " down";
  h += '<div class="stats k3">' +
    '<div class="card stat"><div class="muted small">' + (per === "all" ? "Record" : "Meilleur") + '</div><div class="v">' + evoFmt(m, best) + "</div></div>" +
    '<div class="card stat"><div class="muted small">Dernière séance</div><div class="v">' + evoFmt(m, last) + "</div></div>" +
    '<div class="card stat"><div class="muted small">Évolution</div><div class="v' + good + '">' + evoDiff(m, dlt) + '</div><div class="muted small">' + (pts.length > 1 ? "depuis le " + esc(fmtDate(pts[0].t)) : "une seule séance") + "</div></div>" +
    '<div class="card stat"><div class="muted small">Séances</div><div class="v">' + ent.length + "</div></div></div>";
  evoCur = { pts, m, k: pts.length - 1, W: 360, p };
  const lx = pts[pts.length - 1];
  h += '<div class="card evo-card"><div class="spread" style="align-items:baseline"><div class="muted small" style="font-weight:600">' + esc(M.label) + (M.low ? " · plus bas = plus rapide" : "") + "</div></div>" +
    '<div class="evo-read" aria-live="polite"><b>' + evoFmt(m, lx.v) + '</b><span class="d">' + esc(fmtDateLong(lx.t) + " · " + lx.ses) + '</span><span class="s">' + esc(lx.sum) + "</span></div>" +
    evoChart(p, m, pts) +
    (pts.length === 1 ? '<p class="muted small" style="margin:8px 0 0">Une seule séance pour l\'instant : la courbe se dessinera dès la prochaine.</p>' : '<p class="muted small" style="margin:8px 0 0">Fais glisser le doigt sur la courbe pour voir chaque séance.</p>') + "</div>";
  if (m === "orm") h += '<p class="muted small">1RM estimé : la charge que tu pourrais soulever une seule fois, calculée à partir de tes séries (formule d\'Epley).</p>';
  h += '<div class="section-title">Historique</div><div class="list">' + ent.slice().reverse().map(x =>
    '<a href="#/session/' + x.w.id + '"><div><b>' + esc(fmtDate(x.w.startedAt)) + '</b><div class="muted small">' + esc(x.w.templateName) + " · " + esc(vLabel(x.w.variantName)) + '</div></div><span class="small" style="text-align:right">' + esc(exSummary(x.e)) + (x.orm != null ? '<br><span class="muted">1RM ≈ ' + fmtNum(Math.round(x.orm * 2) / 2) + " kg</span>" : "") + "</span></a>").join("") + "</div>";
  setTimeout(evoFit, 0);
  return h;
}

/* ================= Records et 1RM estimé ================= */
// 1RM estimé (formule d'Epley), fiable jusqu'à une quinzaine de répétitions
const e1rm = (kg, r) => (kg == null || r == null || r <= 0 || r > 20) ? null : (r === 1 ? kg : kg * (1 + r / 30));
const TROPHY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z"/><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/></svg>';
// record = la série qu'on vient de valider donne le meilleur 1RM estimé jamais atteint sur cet exercice
function checkRecord(w, i, s) {
  const e = w.exercises[i], set = e.sets[s], n = norm(e.name);
  if (e.type === "time" || e.type === "dist" || e.type === "rep") return null;
  const cur = e1rm(num(set.kg), num(set.reps));
  if (cur == null) return null;
  let best = null;
  const consider = st => { const o = e1rm(num(st.kg), num(st.reps)); if (o != null && (best == null || o > best)) best = o; };
  for (const x of finished()) if (x.id !== w.id) for (const ex of x.exercises) if (norm(ex.name) === n && ex.type === e.type) ex.sets.forEach(consider);
  w.exercises.forEach((ex, ii) => { if (norm(ex.name) === n && ex.type === e.type) ex.sets.forEach((st, ss) => { if (st.done && !(ii === i && ss === s)) consider(st); }); });
  if (best == null || cur <= best + 0.05) return null; // première fois, ou pas mieux
  return { title: "Nouveau record !", text: e.name + " : 1RM estimé " + fmtNum(Math.round(cur * 2) / 2) + " kg (" + fmtNum(num(set.kg)) + " kg × " + fmtNum(num(set.reps)) + ")" };
}
function celebrate(rec) {
  if (!rec) return;
  document.querySelectorAll(".recordpop").forEach(x => x.remove());
  const d = document.createElement("div"); d.className = "recordpop"; d.setAttribute("role", "alert");
  d.innerHTML = '<div class="rec-box"><div class="rec-icon">' + TROPHY + '</div><div class="rec-title">' + esc(rec.title) + '</div><div class="rec-text">' + esc(rec.text) + "</div></div>";
  document.body.appendChild(d);
  d.addEventListener("click", () => d.remove());
  setTimeout(() => d.remove(), 3000);
  if (settings().alert !== "aucune") { try { if (Native && Native.vibrate) Native.vibrate("[80,60,80,60,160]"); else if (navigator.vibrate) navigator.vibrate([80, 60, 80, 60, 160]); } catch (e) { } }
}

/* ================= Stats : onglets ================= */
function statsTabs(on) {
  return '<div class="tabs stabs" role="tablist">' + [["progress", "Séances"], ["evolution", "Évolution"], ["calendar", "Calendrier"], ["history", "Historique"]].map(t =>
    '<a href="#/' + t[0] + '" class="tab' + (t[0] === on ? " on" : "") + '"' + (t[0] === on ? ' aria-current="page"' : "") + ">" + t[1] + "</a>").join("") + "</div>";
}

/* ================= Calendrier ================= */
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const ymd = t => { const d = new Date(t); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
function viewCalendar(ym, day) {
  const now = new Date();
  let y = now.getFullYear(), m = now.getMonth();
  if (/^\d{4}-\d{2}$/.test(ym || "")) { y = +ym.slice(0, 4); m = +ym.slice(5, 7) - 1; }
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
  const byDay = {}; finished().forEach(w => { const k = ymd(w.startedAt); (byDay[k] = byDay[k] || []).push(w); });
  const prev = new Date(y, m - 1, 1), next = new Date(y, m + 1, 1);
  const key = d => d.getFullYear() + "-" + pad(d.getMonth() + 1);
  const monthCount = Object.keys(byDay).filter(k => k.startsWith(y + "-" + pad(m + 1))).reduce((n, k) => n + byDay[k].length, 0);
  let h = '<div class="page-head"><h1>Stats</h1></div>' + statsTabs("calendar") +
    '<div class="card"><div class="spread"><a class="btn sm" href="#/calendar/' + key(prev) + '" aria-label="Mois précédent">‹</a>' +
    '<div style="text-align:center"><b class="cal-title">' + MONTHS[m] + " " + y + '</b><div class="muted small">' + monthCount + " séance" + (monthCount > 1 ? "s" : "") + "</div></div>" +
    '<a class="btn sm" href="#/calendar/' + key(next) + '" aria-label="Mois suivant">›</a></div>' +
    '<div class="cal">' + ["L", "M", "M", "J", "V", "S", "D"].map(x => '<div class="cal-h">' + x + "</div>").join("");
  for (let k = 0; k < lead; k++) h += "<div></div>";
  const today = ymd(Date.now());
  for (let d = 1; d <= days; d++) {
    const k = y + "-" + pad(m + 1) + "-" + pad(d), ws = byDay[k] || [];
    const cls = "cal-d" + (ws.length ? " has" : "") + (k === today ? " today" : "") + (k === day ? " sel" : "");
    const label = d + " " + MONTHS[m] + (ws.length ? " : " + ws.map(w => w.templateName).join(", ") : "");
    h += ws.length ? '<a class="' + cls + '" href="#/calendar/' + y + "-" + pad(m + 1) + "/" + k + '" aria-label="' + esc(label) + '"><span>' + d + "</span>" + (ws.length > 1 ? "<i>" + ws.length + "</i>" : "") + "</a>"
      : '<div class="' + cls + '" aria-label="' + esc(label) + '"><span>' + d + "</span></div>";
  }
  h += "</div></div>";
  const list = day && byDay[day] ? byDay[day] : finished().filter(w => ymd(w.startedAt).startsWith(y + "-" + pad(m + 1)));
  h += '<div class="section-title">' + (day && byDay[day] ? esc(fmtDateLong(byDay[day][0].startedAt)) : "Séances du mois") + "</div>" +
    (list.length ? '<div class="list">' + list.map(historyRow).join("") + "</div>" : '<div class="card empty">Aucune séance ce mois-ci.</div>');
  return h;
}

/* ================= Partager une séance ================= */
const b64url = str => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4))));
const SHARE_BASE = "https://fiitday.com/#/import/";
const SHARE_SHORT = "https://fiitday.com/#/s/";
// récupère une séance partagée par son code court (lisible sans compte, uniquement si on connaît le code)
async function fetchShare(code) {
  if (!db.auth) { const e = new Error("connexion"); e.login = true; throw e; } // l'import d'un lien court demande d'être connecté
  const headers = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };
  if (db.auth) { try { await ensureToken(); headers.Authorization = "Bearer " + db.auth.access_token; } catch (e) { } }
  const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/get_share", { method: "POST", headers, body: JSON.stringify({ p_code: code }) });
  if (!r.ok) throw new Error("Erreur " + r.status);
  return r.json();
}
async function shareVariant(t, v) {
  const data = { app: "muscuapp-share", v: 1, prog: t.name, name: vLabel(v.name),
    ex: v.exercises.map(e => ({ n: e.name, t: e.type, l: e.load ? 1 : undefined, s: e.sets, c: e.target, r: e.rest, rn: restNextOf(e, v), no: e.note || "", d: dropsOf(e), ds: dropsOf(e) && e.dropScope === "last" ? "last" : undefined, g: e.groupId || null, k: e.groupKind || null })) };
  // lien court (séance enregistrée dans Supabase avec un code) ; lien long en secours (sans compte, hors ligne…)
  let url = null;
  if (db.auth) {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"[b % 56]).join("");
    try { await rest("POST", "shares", { code, data, user_id: db.auth.user.id }, { Prefer: "return=minimal" }); url = SHARE_SHORT + code; }
    catch (e) { console.warn("partage court indisponible", e); }
  }
  if (!url) url = SHARE_BASE + b64url(JSON.stringify(data));
  const text = "Je te partage ma séance « " + t.name + " · " + vLabel(v.name) + " » sur Fiitday :\n" + url + "\n\nDans l'appli : Accueil › Importer, puis colle ce lien.";
  try {
    if (Native && Native.share) { Native.share(text); return; }
    if (navigator.share) { await navigator.share({ title: "Séance Fiitday", text }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(text); toast("Lien copié : envoie-le à la personne"); }
  catch (e) { await ask({ title: "Partager la séance", text: "Copie ce texte et envoie-le :", input: text, multiline: true, cancel: false, ok: "Fermer" }); }
}
async function importShared(code) {
  let data;
  try {
    const str = String(code || "").trim();
    const short = str.match(/(?:#\/s\/|^)([A-Za-z0-9]{6,12})$/);
    if (short) {
      try { data = await fetchShare(short[1]); }
      catch (e) { toast(e && e.login ? "Connecte-toi à ton compte pour importer cette séance" : navigator.onLine === false ? "Pas de connexion internet" : "Impossible de récupérer la séance, réessaie"); return; }
      if (!data) { toast("Cette séance partagée n'existe plus"); return; }
    } else {
      const m = str.match(/import\/([A-Za-z0-9_-]+)/);
      data = JSON.parse(unb64url(m ? m[1] : str));
    }
    if (!data || data.app !== "muscuapp-share" || !Array.isArray(data.ex) || !data.ex.length || data.ex.length > 60) throw new Error();
  } catch (e) { toast("Ce lien de séance n'est pas valide"); return; }
  const ts = templates();
  const dest = await choose("Importer « " + data.prog + " · " + data.name + " » (" + data.ex.length + " exercices)", [["new", "Nouveau programme « " + data.prog + " »", "Crée un programme avec cette séance"]].concat(ts.map(t => ["t:" + t.id, "Ajouter à « " + t.name + " »", "Comme nouvelle séance de ce programme"])));
  if (!dest) return;
  const gmap = {};
  const exercises = data.ex.map(x => {
    const e = { id: "e-" + uid(), name: String(x.n || "Exercice").slice(0, 80), type: x.t === "time" ? "time" : x.t === "dist" ? "dist" : x.t === "rep" ? "rep" : "reps", load: x.t === "dist" && !!x.l, sets: Math.max(1, Math.min(20, num(x.s) || 3)), target: String(x.c == null ? "" : x.c).slice(0, 20), rest: Math.max(0, num(x.r) || 0), restNext: Math.max(0, Math.min(600, num(x.rn) || num(data.rb) || 0)), note: String(x.no || "").slice(0, 500), drops: x.t === "time" || x.t === "dist" ? 0 : Math.max(0, Math.min(3, num(x.d) || 0)), dropScope: x.ds === "last" ? "last" : "all" };
    if (x.g && GROUP_LABEL[x.k]) { gmap[x.g] = gmap[x.g] || "g-" + uid(); e.groupId = gmap[x.g]; e.groupKind = x.k; }
    return e;
  });
  let t, vid = "v" + uid();
  if (dest === "new") {
    t = { id: "tpl-" + uid(), name: String(data.prog || "Programme partagé").slice(0, 60), order: ts.length, variants: [{ id: vid, name: String(data.name || "Séance partagée").slice(0, 60), exercises }] };
  } else {
    t = getItem(dest.slice(2)); if (!t) return;
    let name = String(data.name || "Séance partagée").slice(0, 60);
    if (t.variants.some(v => vLabel(v.name) === name)) name += " (partagée)";
    t.variants.push({ id: vid, name, exercises });
  }
  put("template", t); toast("Séance importée"); go("program/" + t.id + "/" + vid);
}

/* ================= Minuteur de repos dans les notifications (appli Android) ================= */
let nativeRestSent = null, nativeRestEnd = 0, nativeChronoSent = null, notifAsked = false;
function askNotif() { if (!notifAsked && Native.askNotifications) { notifAsked = true; Native.askNotifications(); } }
function syncNativeRest() {
  if (!Native || !Native.startRestTimer) return;
  const L = db.live || {}, v = L.restEnd || 0, wOn = watchOn();
  const key = v ? [v, L.restLabel || "", wOn, settings().alert].join("|") : "";
  if (key === nativeRestSent) return;
  nativeRestSent = key;
  try {
    if (v) {
      askNotif();
      if (typeof Native.startRest === "function") Native.startRest(String(v), settings().alert, L.restLabel || "Repos", wOn);
      else Native.startRestTimer(String(v), settings().alert);
      nativeRestEnd = v;
    } else {
      // repos arrivé au bout : Android finit seul (alerte, montre) ; repos passé ou annulé : on l'arrête
      if (!nativeRestEnd || Date.now() < nativeRestEnd - 500) Native.stopRestTimer();
      nativeRestEnd = 0;
    }
  } catch (e) { }
}
// chrono (gainage, étirement, course) : notification qui défile, et sur la montre avec l'option
function syncNativeChrono() {
  if (!nativeWatch()) return;
  const c = db.live && db.live.chrono, wOn = watchOn();
  const key = c ? [c.wid, c.i, c.s, c.start, c.target || 0, wOn, settings().alert].join("|") : "";
  if (key === nativeChronoSent) return;
  nativeChronoSent = key;
  try {
    if (c) {
      const w = getItem(c.wid), ex = w && w.exercises[c.i];
      const title = chronoKind(w, c) + (ex ? " · " + ex.name : "");
      const text = c.target ? "Objectif " + fmtHold(c.target) : c.dist ? "Distance : " + fmtNum(c.dist) + " m" : "";
      askNotif();
      Native.startChrono(String(c.start), String(Math.round(c.target || 0)), settings().alert, title, text, wOn);
    } else Native.stopChrono();
  } catch (e) { }
}
// boutons « Passer » / « Terminer » appuyés dans une notification ou sur la montre : at = heure de l'appui
function nativeAction(act, at) {
  const L = db.live || {};
  if (act === "skiprest") { if (L.restEnd && at < L.restEnd) { L.restEnd = null; L.restMin = false; save(); tick(); } return; }
  if (act === "chronostop") {
    const c = L.chrono; if (!c || at < c.start - 10000) return;
    const w = getItem(c.wid);
    if (w) stopChrono(w, at); else L.chrono = null;
    save(); render();
  }
}
window.__fiitdayPending = () => {
  try { const t = Native && Native.takeAction && Native.takeAction(); if (t) { const a = JSON.parse(t); nativeAction(a.act, Number(a.at) || Date.now()); } } catch (e) { }
  return true;
};

/* ================= Glisser-déposer pour l'ordre des programmes et des séances ================= */
let drag = null, lastDragEnd = 0;
document.addEventListener("pointerdown", e => {
  const h = e.target.closest && e.target.closest("[data-drag]"); if (!h) return;
  const item = h.closest("[data-sort-id]"), box = item && item.closest("[data-sortable]"); if (!box) return;
  e.preventDefault();
  drag = { item, box, pid: e.pointerId, moved: false };
  item.classList.add("dragging");
  try { h.setPointerCapture(e.pointerId); } catch (err) { }
});
document.addEventListener("pointermove", e => {
  if (!drag || e.pointerId !== drag.pid) return;
  e.preventDefault();
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const over = under && under.closest("[data-sort-id]");
  if (!over || over === drag.item || over.parentElement !== drag.item.parentElement) return;
  const r = over.getBoundingClientRect();
  const after = drag.box.dataset.axis === "x" ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
  over.parentElement.insertBefore(drag.item, after ? over.nextSibling : over);
  drag.moved = true;
}, { passive: false });
function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.pid)) return;
  const d = drag; drag = null; d.item.classList.remove("dragging"); lastDragEnd = Date.now();
  if (!d.moved) return;
  const ids = Array.from(d.box.querySelectorAll("[data-sort-id]")).map(x => x.dataset.sortId);
  if (d.box.dataset.sortable === "tpl") {
    const ts = templates();
    ids.forEach((id, n) => { const t = ts.find(x => x.id === id); if (t && t.order !== n) { t.order = n; put("template", t); } });
  } else if (d.box.dataset.sortable === "var") {
    const { t } = currentProgram(); if (!t) return;
    const byId = {}; t.variants.forEach(v => { byId[v.id] = v; });
    const next = ids.map(id => byId[id]).filter(Boolean);
    if (next.length === t.variants.length) { t.variants = next; put("template", t); }
  }
  render();
}
document.addEventListener("pointerup", endDrag);
document.addEventListener("pointercancel", endDrag);

/* ================= Roue de choix des temps (repos, gainage) ================= */
const fmtSecs = v => (v === 0 ? "Aucun" : v < 60 ? v + " s" : Math.floor(v / 60) + " min" + (v % 60 ? " " + pad(v % 60) : ""));
function pickSeconds(title, value, min, max) {
  const vals = []; for (let x = min; x <= max; x += 5) vals.push(x);
  value = Math.round(num(value) || 0);
  if (value >= min && value <= max && !vals.includes(value)) { vals.push(value); vals.sort((a, b) => a - b); }
  let idx = Math.max(0, vals.indexOf(Math.min(Math.max(value, min), max)));
  if (vals.indexOf(value) >= 0) idx = vals.indexOf(value);
  return new Promise(res => {
    const d = document.createElement("div"); d.className = "modal sheet";
    d.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h3>' + esc(title) + "</h3>" +
      '<div class="wheel-wrap"><div class="wheel-band" aria-hidden="true"></div><div class="wheel" tabindex="0" role="listbox" aria-label="' + esc(title) + '">' +
      vals.map((x, k) => '<div class="wv" role="option" data-k="' + k + '">' + fmtSecs(x) + "</div>").join("") + "</div></div>" +
      '<div class="modal-btns"><button class="btn" data-r="0">Annuler</button><button class="btn primary" data-r="1">OK</button></div></div>';
    document.body.appendChild(d);
    const wheel = d.querySelector(".wheel"), H = 44;
    const mark = () => { idx = Math.max(0, Math.min(vals.length - 1, Math.round(wheel.scrollTop / H))); wheel.querySelectorAll(".wv").forEach((el, k) => { el.classList.toggle("on", k === idx); el.setAttribute("aria-selected", String(k === idx)); }); };
    requestAnimationFrame(() => { wheel.scrollTop = idx * H; mark(); wheel.focus(); });
    wheel.addEventListener("scroll", mark, { passive: true });
    wheel.addEventListener("keydown", e => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); wheel.scrollTo({ top: (idx + (e.key === "ArrowDown" ? 1 : -1)) * H, behavior: "smooth" }); }
      if (e.key === "Enter") done(true);
    });
    const done = ok => { d.remove(); res(ok ? vals[idx] : null); };
    d.addEventListener("click", e => {
      if (e.target === d) { done(false); return; }
      const v = e.target.closest(".wv"); if (v) { wheel.scrollTo({ top: +v.dataset.k * H, behavior: "smooth" }); return; }
      const b = e.target.closest("[data-r]"); if (b) done(b.dataset.r === "1");
    });
  });
}

/* ================= Propositions de noms d'exercices (recherche intelligente) ================= */
// bibliothèque de l'onglet Exercices (index léger inclus dans la page) : [id, nom, muscles, matériel, temps ?, reps, repos]
const EXO_LIB = (window.EXO_INDEX || []).map(([id, n, mus, gear, kind, reps, rest, dist, load, cat, al, hold, zone, side, g], k) => ({ id, n, mus, gear, kind: ["reps", "time", "dist"][kind] || "reps", reps, rest, dist, load: !!load, cat: cat || "", al: al || [], hold: hold || 0, zone: zone || "", side: !!side, g: g || "", nn: norm(n), k }));
const words = t => norm(t).split(/[^a-z0-9]+/).filter(Boolean);
EXO_LIB.forEach(x => { x.w = words(x.n); x.a = words(x.al.join(" ")); x.o = words(x.mus + " " + x.gear + " " + x.cat); });
const libByName = {}; EXO_LIB.forEach(x => { libByName[x.nn] = x; x.al.forEach(a => { libByName[norm(a)] = x; }); }); // anciens noms reconnus aussi
const libFor = name => (name ? libByName[norm(name)] || null : null);
// mots courants (anglais, abréviations, pluriels) → mots de la bibliothèque ; « | » sépare des choix possibles
const SYN = { bench: "developpe couche", dc: "developpe couche", di: "developpe incline", ohp: "developpe militaire", military: "militaire", sdt: "souleve terre", deadlift: "souleve terre",
  rdl: "roumain", lunge: "fentes", lunges: "fentes", fente: "fentes", pec: "pectoraux", pecs: "pectoraux", torse: "pectoraux", epaule: "deltoides", epaules: "deltoides", dos: "dorsaux|trapezes|lombaires",
  jambe: "quadriceps|ischio|fessiers", jambes: "quadriceps|ischio|fessiers", cuisse: "quadriceps", cuisses: "quadriceps", fesse: "fessiers", fesses: "fessiers", abdo: "abdominaux", abdos: "abdominaux",
  planche: "gainage", plank: "gainage", lat: "tirage vertical|laterales", rear: "oiseau|pec deck inverse", row: "rowing", pull: "tirage|tractions", pullup: "tractions", traction: "tractions", tricep: "triceps", bicep: "biceps", mollet: "mollets",
  butterfly: "pec deck", fly: "ecarte", flys: "ecarte", haltere: "halteres", dumbbell: "halteres", press: "presse|developpe", pushup: "pompes", pompe: "pompes", crunchs: "crunch", kb: "kettlebell",
  // abréviations et acronymes courants en salle
  dm: "developpe militaire", dmh: "developpe militaire halteres", dch: "developpe couche halteres", dih: "developpe incline halteres", dd: "pompes declinees", dev: "developpe", dvp: "developpe", devlp: "developpe",
  ht: "hip thrust", hipthrust: "hip thrust", thrust: "hip thrust", rdl: "roumain", sdtr: "roumain", sdtjt: "roumain", jt: "roumain", goodmorning: "roumain", bulgarian: "bulgare", split: "bulgare", fentes: "fentes",
  pulldown: "tirage vertical", latpulldown: "tirage vertical", tv: "tirage vertical", th: "tirage horizontal", seatedrow: "tirage horizontal", tbar: "rowing", rm: "rowing menton", uprightrow: "rowing menton",
  pushdown: "extension triceps poulie", skull: "barre au front", skullcrusher: "barre au front", crusher: "barre au front", french: "barre au front|extension nuque", kickback: "kickback", hammer: "marteau", preacher: "pupitre", larry: "pupitre", spider: "curl",
  shrug: "shrugs", haussement: "shrugs", raise: "elevations", lateral: "laterales", elev: "elevations", elevation: "elevations", oiseaux: "oiseau", reardelt: "oiseau|pec deck inverse", facepull: "face pull",
  legext: "leg extension", extension: "extension", legpress: "presse", presse: "presse", hack: "hack squat", goblet: "squat goblet", calf: "mollets", calves: "mollets", mollets: "mollets",
  adduction: "adducteurs", abduction: "abducteurs", adducteur: "adducteurs", abducteur: "abducteurs", glute: "fessiers", glutes: "fessiers", fessier: "fessiers", quad: "quadriceps", quads: "quadriceps",
  ischios: "ischio", hamstring: "ischio", hamstrings: "ischio", chest: "pectoraux", pecto: "pectoraux", shoulder: "deltoides", shoulders: "deltoides", delt: "deltoides", delts: "deltoides",
  back: "dorsaux", dorsal: "dorsaux", lats: "dorsaux", trap: "trapezes", traps: "trapezes", abs: "abdominaux", ab: "abdominaux", core: "gainage", gainage: "gainage", tri: "triceps", bi: "biceps",
  mc: "mountain climbers", climber: "mountain climbers", climbers: "mountain climbers", swing: "kettlebell swing", wheel: "roue abdominale", rollout: "roue abdominale", leg: "leg|jambes", legs: "quadriceps|ischio|fessiers",
  sit: "crunch", situp: "crunch", relevé: "releve", releve: "releve", knee: "genoux", knees: "genoux", russian: "russian twist", burpee: "burpees", jumpingjack: "jumping jacks", rameur: "rameur", row: "rowing|rameur" };
// distance d'édition (fautes de frappe, lettres inversées)
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
const fuzzy = (tok, w) => { const tol = tok.length >= 7 ? 2 : tok.length >= 4 ? 1 : 0; if (!tol) return false; for (const L of [tok.length - 1, tok.length, tok.length + 1]) if (L > 2 && lev(tok, w.slice(0, L)) <= tol) return true; return false; };
function direct(tok, c) {
  let best = 0;
  for (const w of c.w) { if (w === tok) best = Math.max(best, 4); else if (w.startsWith(tok)) best = Math.max(best, 3); else if (tok.length >= 3 && w.includes(tok)) best = Math.max(best, 2); else if (fuzzy(tok, w)) best = Math.max(best, 1.5); }
  for (const w of c.a || []) { if (w === tok) best = Math.max(best, 3.6); else if (w.startsWith(tok)) best = Math.max(best, 2.7); else if (fuzzy(tok, w)) best = Math.max(best, 1.3); } // autres noms (« rear kick »…)
  for (const w of c.o || []) { if (w.startsWith(tok)) best = Math.max(best, 1.2); else if (fuzzy(tok, w)) best = Math.max(best, 0.6); }
  return best;
}
function tokScore(tok, c) {
  let best = direct(tok, c);
  if (SYN[tok]) for (const alt of SYN[tok].split("|")) { // tous les mots de l'expression doivent correspondre
    let sc = 0; for (const w of alt.split(" ")) { const v = direct(w, c); if (!v) { sc = 0; break; } sc += v; }
    best = Math.max(best, sc * 0.9);
  }
  return best;
}
function searchExercises(q) {
  const toks = words(q); if (!toks.length) return [];
  const own = knownNames().filter(n => !libFor(n)).map(n => ({ n, nn: norm(n), w: words(n), own: true }));
  return EXO_LIB.concat(own).map(c => {
    let sc = 0; for (const t of toks) { const v = tokScore(t, c); if (!v) return null; sc += v; }
    return { c, sc: sc + (c.nn.startsWith(norm(q)) ? 2 : 0) };
  }).filter(Boolean).sort((a, b) => b.sc - a.sc || (a.c.own ? 1 : 0) - (b.c.own ? 1 : 0) || (a.c.k || 0) - (b.c.k || 0) || a.c.n.localeCompare(b.c.n, "fr")).map(x => x.c);
}
function suggestFor(input) {
  const box = input.nextElementSibling;
  if (!box || !box.classList.contains("sugg")) return;
  const q = input.value.trim(), toks = words(q);
  const hits = q ? searchExercises(q).filter(c => c.nn !== norm(q)).slice(0, 8) : [];
  if (!hits.length) { box.hidden = true; box.innerHTML = ""; return; }
  // met en gras le début des mots qui correspondent à ce qui est tapé
  const hl = n => n.split(/(\s+)/).map(part => { const w = norm(part), t = toks.find(x => w.startsWith(x)); return t ? "<b>" + esc(part.slice(0, t.length)) + "</b>" + esc(part.slice(t.length)) : esc(part); }).join("");
  box.innerHTML = hits.map(c => '<button type="button" data-pick="' + esc(c.n) + '"><span class="sg-n">' + hl(c.n) + '</span><span class="sg-d">' + (c.own ? "Tes exercices" : esc(c.mus + " · " + c.gear)) + "</span></button>").join("");
  box.hidden = false;
}
document.addEventListener("input", e => { if (e.target.matches && e.target.matches("input[data-suggest]")) suggestFor(e.target); });
document.addEventListener("focusout", e => {
  if (!e.target.matches || !e.target.matches("input[data-suggest]")) return;
  const box = e.target.nextElementSibling;
  setTimeout(() => { if (box && box.classList.contains("sugg") && !box.contains(document.activeElement)) box.hidden = true; }, 150);
});
// le choix se fait au « pointerdown » pour garder le champ actif (pas de fermeture avant le clic)
document.addEventListener("pointerdown", e => {
  const b = e.target.closest && e.target.closest(".sugg [data-pick]"); if (!b) return;
  e.preventDefault();
  const box = b.parentElement, input = box.previousElementSibling;
  input.value = b.dataset.pick;
  box.hidden = true; box.innerHTML = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
});

/* ================= Sauvegarde compressée ================= */
// séances : seules les valeurs remplies sont gardées dans la sauvegarde (texte plus court), et remises à l'identique à la restauration
function slimData(x) {
  if (x.kind !== "workout" || !x.data || !Array.isArray(x.data.exercises)) return x.data;
  const clean = o => { const r = {}; for (const k in o) { const v = o[k]; if (v === "" || v === null || v === false || (Array.isArray(v) && !v.length)) continue; r[k] = v; } return r; };
  return Object.assign({}, x.data, { exercises: x.data.exercises.map(e => Object.assign(clean(e), { sets: (e.sets || []).map(st => Object.assign(clean(st), st.drops && st.drops.length ? { drops: st.drops.map(clean) } : {})) })) });
}
function fatWorkout(d) {
  if (!d || !Array.isArray(d.exercises)) return d;
  return Object.assign({}, d, { exercises: d.exercises.map(e => Object.assign({ groupId: null, groupKind: null, note: "" }, e, { sets: (Array.isArray(e.sets) ? e.sets : []).map(st => Object.assign({ kg: "", reps: "", sec: "", done: false }, st, { drops: (st.drops || []).map(dr => Object.assign({ kg: "", reps: "" }, dr)) })) })) });
}
// contenu complet d'une sauvegarde (fichier, code de transfert, ancien texte)
async function backupText() {
  flushPending();
  return packBackup(JSON.stringify({ app: "muscuapp", v: 2, at: Date.now(), items: Object.values(db.items).filter(x => !x.deleted).map(x => ({ id: x.id, kind: x.kind, data: slimData(x), updated_at: x.updated_at })) }));
}
const backupName = () => { const d = new Date(); return "fiitday-sauvegarde-" + d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + ".txt"; };
// fichier : dans l'appli Android, le téléphone demande où l'enregistrer (Téléchargements, Drive…) ; sur le site, téléchargement classique
const nativeFiles = () => !!(window.AndroidBridge && typeof window.AndroidBridge.saveFile === "function" && typeof window.AndroidBridge.openFile === "function");
let fileCb = null;
window.__fiitdayFile = (kind, status, text) => { const cb = fileCb; fileCb = null; if (cb) cb(status, text); };
function saveFile(name, text) {
  if (nativeFiles()) return new Promise(res => { fileCb = st => res(st); window.AndroidBridge.saveFile(name, text); });
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  return Promise.resolve("download");
}
// texte du fichier choisi, null si rien n'est choisi, false s'il n'a pas pu être lu
function openFile() {
  if (nativeFiles()) return new Promise(res => { fileCb = (st, text) => res(st === "ok" ? text : st === "error" ? false : null); window.AndroidBridge.openFile(); });
  return new Promise(res => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".txt,.json,text/plain,application/json";
    inp.addEventListener("change", () => { const f = inp.files && inp.files[0]; if (!f) return res(null); if (f.size > 20e6) return res(false); f.text().then(res, () => res(false)); });
    inp.addEventListener("cancel", () => res(null));
    inp.click();
  });
}
// code de transfert : 8 caractères, lettres majuscules et chiffres sans 0 / O / 1 / I (créé et vérifié par Supabase)
const XFER_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const normCode = t => String(t || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const xferErr = err => err && (err.code === "PGRST202" || err.status === 404) ? "Les codes de transfert ne sont pas encore activés (SQL transfert.sql à exécuter dans Supabase)"
  : err && err.message === "Failed to fetch" ? "Pas de connexion : réessaie avec du réseau" : (err && err.message) || "Erreur, réessaie";
async function useTransferCode(raw) {
  const c = normCode(raw);
  if (!XFER_RE.test(c)) { toast("Un code de transfert fait 8 caractères (lettres et chiffres)"); return; }
  if (!db.auth) { toast("Connecte-toi au compte qui doit recevoir les données"); return; }
  let txt; try { txt = await rpc("use_transfer", { p_code: c }); } catch (err) { toast(xferErr(err)); return; }
  if (!txt || typeof txt !== "string") { toast("Code inconnu ou expiré (un code n'est valable qu'1 heure)"); return; }
  restoreBackup(txt, "Ce code ne contient pas une sauvegarde valide");
}
// « FIITDAY1: » + données compressées en base64 : bien plus court que le texte brut
async function packBackup(str) {
  if (!window.CompressionStream) return str;
  try {
    const out = new Uint8Array(await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    let bin = ""; for (let k = 0; k < out.length; k += 0x8000) bin += String.fromCharCode.apply(null, out.subarray(k, k + 0x8000));
    return "FIITDAY1:" + btoa(bin);
  } catch (e) { return str; }
}
async function unpackBackup(txt) {
  txt = String(txt || "").trim();
  if (!txt.startsWith("FIITDAY1:")) return txt; // ancienne sauvegarde en texte brut
  const bin = atob(txt.slice(9).replace(/\s+/g, ""));
  const u = Uint8Array.from(bin, ch => ch.charCodeAt(0));
  return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
}

/* ================= Écran : réglages ================= */
/* ================= Questions fréquentes (Réglages › Aide) ================= */
// [thème, [[id, question, réponse (HTML écrit ici, sans donnée de l'utilisateur)]]] ; #/faq/id ouvre directement une question
const FAQ = [
  ["Démarrer", [
    ["creer", "Comment créer mon premier programme ?", "Sur l'accueil, appuie sur « + Nouveau programme » et donne-lui un nom (par exemple « Push » ou « Haut du corps »). Ajoute ensuite une séance avec « + Nouvelle séance », puis ses exercices avec « + Ajouter un exercice » : cherche (« dev », « pec »…) ou filtre par muscle, coche les exercices voulus, puis choisis leur ordre dans la séance. Ils arrivent avec les répétitions et le repos conseillés. Un exercice qui n'est pas dans la liste ? Tape son nom et coche « + Créer »."],
    ["programme", "Quelle différence entre un programme et une séance ?", "Un programme regroupe plusieurs séances : par exemple le programme « Push Pull » avec « Séance 1 » et « Séance 2 », chacune avec ses exercices. Sur l'accueil, la séance marquée « Suggérée » est celle que tu n'as jamais faite, sinon celle faite il y a le plus longtemps."],
    ["types", "Quels types d'exercices puis-je créer ?", "Quatre types : <b>Poids × reps</b> (kilos et répétitions), <b>Reps uniquement</b> (pompes, tractions sans charge), <b>Temps</b> (gainage, étirements : le temps est pris par le chrono) et <b>Distance</b> (course, rameur, ateliers Hyrox, avec ou sans charge). Le type se choisit dans la configuration de l'exercice."],
    ["superset", "Comment faire un superset ou un dégressif ?", "Ajoute d'abord tes exercices, puis dans la configuration de la séance : « Enchaîner avec l'exercice suivant » relie deux exercices en superset ou biset (un 3e exercice ajouté au groupe en fait un triset), et le réglage « Dégressif » d'un exercice ajoute les baisses de charge. Dans un superset, le repos démarre seulement quand tout le tour est fini."]]],
  ["Pendant la séance", [
    ["repos", "Comment fonctionne le repos ?", "Quand tu valides une série (✓), le repos démarre tout seul avec la durée réglée pour l'exercice. Tu peux ajouter ou enlever 15 s, le passer ou le réduire. Après la dernière série d'un exercice, c'est le « Repos avant l'exercice suivant » qui démarre : il se règle dans la configuration de la séance."],
    ["alerte", "Je ne suis pas prévenu à la fin du repos, que faire ?", "Vérifie <a href=\"#/settings\">Réglages</a> › Alerte de fin de repos (Vibration, Son ou Les deux) et appuie sur « Tester ». Dans l'appli Android, autorise les notifications de Fiitday : elles te préviennent même écran verrouillé. Limite d'Android : hors de l'appli, un repos de plus de 3 minutes peut ne pas sonner à la fin."],
    ["chrono", "Comment marche le chrono du gainage et des étirements ?", "Appuie sur ▶ « Chrono » : tu as 5 secondes pour te mettre en position, puis le chrono démarre. Quand tu l'arrêtes, le temps s'inscrit tout seul dans la série (il ne se modifie pas à la main). Pour la course et l'Hyrox, tu peux aussi taper ton temps : « 405 » devient 4:05."],
    ["gris", "À quoi servent les chiffres en gris ?", "Ce sont tes valeurs de la dernière fois pour cet exercice. Le bouton ✓ les reprend si tu as fait pareil ; sinon, tape simplement tes nouveaux chiffres."]]],
  ["Progrès et exercices", [
    ["progression", "Comment voir ma progression sur un exercice ?", "Dans <a href=\"#/evolution\">Stats › Évolution</a>, cherche un exercice déjà fait : tu vois sa courbe (charge, 1RM estimé, répétitions ou temps), ton record et ton historique, sur 1 mois, 3 mois, 6 mois, 1 an ou depuis le début."],
    ["record", "Comment est calculé un record ?", "Pour un exercice avec poids, Fiitday estime ton 1RM (la charge que tu pourrais soulever une seule fois) avec la formule d'Epley : charge × (1 + répétitions ÷ 30). Un record est fêté quand ce 1RM dépasse ton meilleur, à partir de ta 2e séance avec cet exercice. Pour la course, le record est ton meilleur temps."],
    ["corriger", "Comment corriger ou supprimer une séance terminée ?", "Ouvre-la depuis l'accueil (Dernières séances) ou <a href=\"#/history\">Stats › Historique</a> pour corriger une valeur. Pour la supprimer, fais glisser sa ligne de droite à gauche, puis appuie sur « Supprimer »."],
    ["etirements", "Quand et comment m'étirer ?", "L'onglet <a href=\"#/exercices/etirements\">Exercices › Étirements</a> propose 23 étirements avec le mannequin 3D, et le guide « Bien s'étirer » explique quand et comment le faire. Après une séance, l'accueil te propose pendant 15 minutes des étirements adaptés aux muscles travaillés (tu peux couper ces propositions dans Réglages › Étirements après la séance)."],
    ["mannequin", "Comment utiliser le mannequin 3D ?", "Fais glisser l'image pour tourner autour du mannequin, pince pour zoomer et appuie deux fois pour revenir au cadrage de départ. Fais glisser la fiche (sous l'image) vers la gauche ou la droite pour passer à l'exercice suivant ou précédent."]]],
  ["Données et compte", [
    ["synchro", "Mes données sont-elles sur mon téléphone et sur mon ordinateur ?", "Oui : avec ton compte, tout se synchronise automatiquement entre l'appli et fiitday.com. L'heure de la dernière synchro est dans Réglages › Compte. Sans réseau, fais ta séance normalement : elle sera envoyée au retour du réseau."],
    ["sauvegarde", "Comment faire une sauvegarde de mes données ?", "<a href=\"#/settings\">Réglages</a> › Données › « Enregistrer une sauvegarde » crée un fichier à garder sur ton téléphone, ton ordinateur ou dans un cloud (Google Drive…). « Restaurer une sauvegarde » le relit : ce qui a été supprimé depuis revient, et ce que tu as modifié depuis garde sa version la plus récente."],
    ["transfert", "Comment passer mes données sur un autre compte ?", "Dans l'ancien compte : Réglages › Données › « Créer un code ». Tu obtiens un code de 8 caractères, valable 1 heure. Dans le nouveau compte : « J'ai un code », puis tape-le. Ne le donne à personne d'autre : il donne accès à toutes tes données."],
    ["partage", "Comment partager une séance avec un ami ?", "Dans la configuration de la séance, appuie sur « Partager cette séance » et envoie le lien (WhatsApp, SMS…). Ton ami, connecté à son compte Fiitday, ouvre le lien ou le colle dans Accueil › Importer, puis choisit où ajouter la séance."],
    ["supprimer-compte", "Comment supprimer mon compte ?", "Réglages › Compte › « Supprimer mon compte », puis tape SUPPRIMER pour confirmer. Ton compte et toutes tes données sont effacés définitivement : fais une sauvegarde avant si tu veux les garder."]]],
  ["Appli et montre", [
    ["montre", "Comment être prévenu sur ma montre ?", "Dans l'appli Android : Réglages › Montre connectée › « Activée ». La montre vibre à la fin du repos et quand l'objectif d'un chrono est atteint, avec « Terminer » pour arrêter le chrono. Sur Galaxy Watch, dans l'appli Galaxy Wearable › Paramètres de la montre › Notifications : autorise Fiitday et choisis « Toujours afficher sur les deux » dans « Notifications du téléphone sur la montre »."],
    ["version", "Comment mettre à jour Fiitday ?", "Le site fiitday.com est toujours à jour. L'appli Android se met à jour avec Obtainium, sans perdre tes données. Ta version est écrite en bas de la page <a href=\"#/settings\">Réglages</a> (« Fiitday V1.… »)."]]]
];
// espaces insécables de la typographie française : « ? », « : », « » » ne passent jamais seuls à la ligne
const nbsp = t => t.replace(/ ([?:!;»])/g, "\u00a0$1").replace(/« /g, "«\u00a0");
function viewFaq(open) {
  const n = FAQ.reduce((a, c) => a + c[1].length, 0);
  return '<a class="back" href="#/settings">‹ Réglages</a><div class="page-head"><h1>Questions fréquentes</h1><span class="muted small">' + n + " questions</span></div>" +
    '<input class="f" id="faq-q" type="search" autocomplete="off" placeholder="Rechercher : repos, sauvegarde…" aria-label="Rechercher dans les questions fréquentes">' +
    FAQ.map(([cat, qs]) => '<section class="faq-cat"><div class="section-title">' + esc(cat) + '</div><div class="faq-box">' +
      qs.map(([id, q, a]) => '<details class="faq-q" id="faq-' + id + '"' + (id === open ? " open" : "") + "><summary>" + esc(nbsp(q)) + '</summary><div class="faq-a">' + nbsp(a) + "</div></details>").join("") + "</div></section>").join("") +
    '<p class="muted faq-none" hidden>Aucune question ne correspond. Essaie un autre mot.</p>' +
    '<div class="card faq-more"><b>Pas trouvé ta réponse ?</b><div class="small muted" style="margin-top:4px">Écris-nous : l\'adresse de contact est dans Réglages › Informations légales › Mentions légales.</div></div>';
}
// recherche sans tenir compte des accents ni des majuscules ; une seule réponse : elle s'ouvre
$app.addEventListener("input", e => {
  if (e.target.id !== "faq-q") return;
  const words = norm(e.target.value).split(/\s+/).filter(Boolean), shown = [];
  document.querySelectorAll(".faq-q").forEach(d => { const ok = words.every(w => norm(d.textContent).includes(w)); d.hidden = !ok; if (ok) shown.push(d); });
  document.querySelectorAll(".faq-cat").forEach(s => { s.hidden = !s.querySelector(".faq-q:not([hidden])"); });
  const none = document.querySelector(".faq-none"); if (none) none.hidden = shown.length > 0;
  if (words.length && shown.length === 1) shown[0].open = true;
});

function viewSettings() {
  const s = settings();
  const sv = k => s[k] || (k === "watch" ? "non" : k === "stretchTips" ? "oui" : "");
  const seg = (k, opts) => '<div class="seg" role="group">' + opts.map(o => '<button class="' + (sv(k) === o[0] ? "on" : "") + '" aria-pressed="' + (sv(k) === o[0]) + '" data-act="set" data-k="' + k + '" data-val="' + o[0] + '">' + o[1] + "</button>").join("") + "</div>";
  // même numéro sur le téléphone et sur le web : 1.<nombre de modifications du code>
  const num_ = (Native && Native.version && Native.version()) || window.APP_VERSION || "";
  const ver = "Fiitday " + (num_ && num_ !== "1.0-dev" ? "V" + num_ : "(version de développement)");
  return '<div class="page-head"><h1>Réglages</h1></div><div class="stack">' +
    '<div class="card"><b>Apparence</b><div style="margin-top:10px">' + seg("theme", [["auto", "Auto"], ["clair", "Clair"], ["sombre", "Sombre"]]) + "</div></div>" +
    '<div class="card"><b>Alerte de fin de repos</b><div style="margin-top:10px">' + seg("alert", [["vibration", "Vibration"], ["son", "Son"], ["les deux", "Les deux"], ["aucune", "Aucune"]]) + "</div>" +
    '<button class="btn sm" style="margin-top:10px" data-act="testalert">Tester</button></div>' +
    (nativeWatch() ? '<div class="card"><b>Montre connectée</b><div class="small muted" style="margin-top:4px">Galaxy Watch, Pixel Watch… : la montre vibre à la fin du repos et quand l\'objectif d\'un chrono est atteint (avec « Terminer » pour arrêter le chrono), même quand Fiitday est ouvert sur le téléphone.</div>' +
      '<div style="margin-top:10px">' + seg("watch", [["non", "Désactivée"], ["oui", "Activée"]]) + "</div>" +
      (watchOn() ? '<button class="btn sm" style="margin-top:10px" data-act="testwatch">Tester sur la montre</button>' +
        '<div class="small muted" style="margin-top:8px">Rien sur la montre ? Dans l\'appli Galaxy Wearable › Paramètres de la montre › Notifications : autorise Fiitday, et dans « Notifications du téléphone sur la montre », choisis « Toujours afficher sur les deux » (sinon la montre ne reçoit rien tant que l\'écran du téléphone est allumé, et Fiitday le garde allumé pendant la séance).</div>' : "") +
      '<a class="link small" style="padding:0;display:inline-flex;align-items:center;margin-top:6px" href="#/faq/montre">Aide pour la montre</a></div>' : "") +
    '<div class="card"><b>Étirements après la séance</b><div class="small muted" style="margin-top:4px">À la fin d\'une séance, l\'accueil propose pendant 15 minutes des étirements adaptés aux muscles travaillés.</div><div style="margin-top:10px">' + seg("stretchTips", [["oui", "Activés"], ["non", "Désactivés"]]) + "</div></div>" +
    '<div class="card"><b>Objectif de séances par semaine</b><div style="margin-top:10px">' + seg("goal", [["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"], ["6", "6"], ["7", "7"]]) + "</div></div>" +
    '<div class="card"><b>Données</b><div class="small muted" style="margin-top:4px">Tes programmes, séances et réglages.</div>' +
    '<div class="data-sec"><div class="data-t">Sauvegarde</div><div class="small muted">Un fichier à garder sur ton téléphone, ton ordinateur ou dans un cloud (Google Drive…).</div>' +
    '<div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm" data-act="filesave">Enregistrer une sauvegarde</button><button class="btn sm" data-act="fileopen">Restaurer une sauvegarde</button></div></div>' +
    '<div class="data-sec"><div class="data-t">Transfert vers un autre compte</div><div class="small muted">Un code de 8 caractères, valable 1 heure, à taper dans l\'autre compte.</div>' +
    '<div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm" data-act="xfercreate">Créer un code</button><button class="btn sm" data-act="xferuse">J\'ai un code</button></div></div>' +
    '<div class="row" style="margin-top:6px;flex-wrap:wrap;gap:4px 14px"><a class="link small" style="padding:0;display:inline-flex;align-items:center" href="#/faq/sauvegarde">Comment ça marche ?</a><button class="link small" style="padding:0;text-align:left" data-act="import">Restaurer un ancien texte de sauvegarde (FIITDAY1:…)</button></div></div>' +
    '<div class="card"><b>Compte</b><div style="margin-top:8px">' +
    (db.auth ? '<label class="fl" style="margin-bottom:8px">Prénom<input class="f" data-setname maxlength="40" autocomplete="given-name" value="' + esc(firstName()) + '" placeholder="Ton prénom"></label>' +
      '<div class="small">Connecté : ' + esc(db.auth.user.email) + "</div><div style=\"margin-top:6px\">" + syncBadge() + '</div><div class="small msg err" data-sync-error>' + (syncState.status === "err" ? esc(syncState.error) : "") + "</div>" +
      '<div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm" data-act="syncnow">Synchroniser maintenant</button><button class="btn sm" data-act="logout">Se déconnecter</button><button class="btn sm danger" data-act="delaccount">Supprimer mon compte</button></div>'
      : '<div class="small muted">Sans compte : tes données restent sur cet appareil.</div><button class="btn sm primary" style="margin-top:8px" data-act="tologin">Se connecter / créer un compte</button>') +
    "</div></div>" +
    '<div class="card"><b>Aide</b><div class="small muted" style="margin-top:4px">Les réponses aux questions les plus fréquentes : séances, repos, sauvegarde, montre…</div><a class="btn sm" style="margin-top:8px" href="#/faq">Questions fréquentes</a></div>' +
    '<div class="card"><b>Informations légales</b><div class="row" style="margin-top:8px;flex-wrap:wrap">' +
    '<a class="btn sm" href="' + LEGAL.privacy + '" target="_blank" rel="noopener">Politique de confidentialité</a>' +
    '<a class="btn sm" href="' + LEGAL.legal + '" target="_blank" rel="noopener">Mentions légales</a></div></div>' +
    '<div class="credit"><div class="appver">' + esc(ver) + '</div>Créé par YL</div></div>';
}

/* ================= Minuteurs ================= */
// titre du chrono : étirement, gainage ou course (distance)
function chronoKind(w, c) { const ex = w && w.exercises[c.i], lb = ex && libFor(ex.name); return lb && lb.cat === "etirement" ? "Étirement" : c.dist || (ex && ex.type === "dist") ? "Chrono" : "Gainage"; }
function tick() {
  const now = Date.now(), L = db.live || {};
  document.querySelectorAll('[data-tick="elapsed"]').forEach(el => { const w = getItem(el.dataset.id); if (w) el.textContent = fmtDur((w.endedAt || now) - w.startedAt, "down"); });
  // repos
  if (L.restEnd && now >= L.restEnd && !L.restAlerted) {
    // déjà signalé par la notification Android (appli en arrière-plan) : pas de deuxième alerte en revenant
    let nativeAlerted = false;
    try { nativeAlerted = !!(Native && Native.restAlertedAt && Number(Native.restAlertedAt()) === L.restEnd); } catch (e) { }
    L.restAlerted = true; L.restEnd = null; L.restMin = false; save();
    if (!nativeAlerted) { signal(watchOn()); restDone(); } // option montre : la notification d'Android vibre (téléphone et montre)
  }
  syncNativeChrono(); syncNativeRest(); // le chrono d'abord : un repos qui suit un chrono ne doit pas être coupé
  const pop = document.querySelector("[data-restpop]"), pill = document.querySelector("[data-restpill]");
  if (pop) {
    const on = !!L.restEnd;
    pop.hidden = !on || !!L.restMin;
    if (pill) pill.hidden = !on || !L.restMin;
    if (on) {
      const left = fmtDur(L.restEnd - now, "up");
      pop.querySelector("[data-rptime]").textContent = left;
      const lab = pop.querySelector(".rp-label"); if (lab) lab.textContent = L.restLabel || "Repos";
      pop.querySelector("[data-rpbar]").style.width = Math.max(0, Math.min(100, 100 * (L.restEnd - now) / (L.restTotal || 1))) + "%";
      if (pill) pill.textContent = "Repos " + left + " · Agrandir";
    }
  }
  // chrono (gainage)
  const c = L.chrono;
  const cpop = document.querySelector("[data-chronopop]"), cpill = document.querySelector("[data-chronopill]");
  if (c) {
    const el = document.querySelector('[data-tick="chrono"]');
    const ms = now - c.start, prep = ms < 0, left = Math.ceil(-ms / 1000);
    // décompte de préparation : bip à 3, 2, 1 puis au départ
    if (prep && left !== c.count) { c.count = left; if (left <= 3) prepBeep(false); }
    if (!prep && !c.go) { c.go = true; save(); prepBeep(true); }
    if (el) el.textContent = prep ? "Prêt · " + left : fmtDur(ms, "down");
    if (!c.alerted && c.target && ms >= c.target * 1000) {
      c.alerted = true; save();
      let nativeDone = false; // objectif déjà signalé par Android (appli en arrière-plan)
      try { nativeDone = !!(Native && Native.restAlertedAt && Number(Native.restAlertedAt()) === c.start + c.target * 1000); } catch (e) { }
      if (!nativeDone) signal(watchOn());
    }
    const w = currentWorkout(), here = w && w.id === c.wid;
    if (cpop) {
      cpop.hidden = !here || !!c.min;
      if (here) {
        const ex = w.exercises[c.i];
        cpop.querySelector("[data-cpname]").textContent = ex && norm(ex.name) !== "gainage" ? ex.name + " · série " + (c.s + 1) : "Série " + (c.s + 1);
        const lab = cpop.querySelector(".rp-label"), kind = chronoKind(w, c); if (lab.textContent !== kind) lab.textContent = kind;
        cpop.querySelector("[data-cptime]").textContent = prep ? String(left) : fmtDur(ms, "down");
        cpop.querySelector("[data-cpbar]").style.width = (c.target && !prep ? Math.min(100, 100 * ms / (c.target * 1000)) : 0) + "%";
        cpop.querySelector("[data-cpgoal]").textContent = prep ? "Mets-toi en position…" : c.target ? (c.alerted ? "Objectif atteint !" : "Objectif " + fmtHold(c.target)) : c.dist ? "Distance : " + fmtNum(c.dist) + " m · touche Terminer à l'arrivée" : "";
        cpop.querySelector(".gain-box").classList.toggle("prep", prep);
        cpop.querySelector(".gain-box").classList.toggle("reached", !!c.alerted);
      }
    }
    if (cpill) { cpill.hidden = !here || !c.min; cpill.textContent = (prep ? "Départ dans " + left : (here ? chronoKind(w, c) : c.dist ? "Chrono" : "Gainage") + " " + fmtDur(ms, "down")) + " · Agrandir"; }
  } else {
    if (cpop) cpop.hidden = true;
    if (cpill) cpill.hidden = true;
  }
}
setInterval(tick, 250);
// en plus : un rafraîchissement pile au changement de seconde (repos qui descend, chrono qui monte), sans attendre le prochain quart de seconde
let edgeTimer = null;
function armEdge() {
  clearTimeout(edgeTimer); edgeTimer = null;
  const L = db.live || {}, now = Date.now();
  let wait = null;
  if (L.restEnd && L.restEnd > now) wait = (L.restEnd - now) % 1000 || 1000;
  if (L.chrono) { const ms = now - L.chrono.start, w2 = ms < 0 ? (-ms) % 1000 || 1000 : 1000 - (ms % 1000); wait = wait == null ? w2 : Math.min(wait, w2); }
  if (wait != null) edgeTimer = setTimeout(() => { tick(); armEdge(); }, wait + 2);
}
setInterval(() => { if (!edgeTimer) armEdge(); }, 1000);
// fin du repos : l'appli clignote (sombre / clair) pendant 5 s avec un message au centre
function restDone() {
  document.querySelectorAll(".restpop.done").forEach(x => x.remove());
  const d = document.createElement("div"); d.className = "restpop done"; d.setAttribute("role", "alert");
  d.innerHTML = '<div class="rp-box"><div class="rp-end">Pause terminée<span class="rp-end2">C\'est reparti 💪</span></div></div>';
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
  if (f.dataset.form === "login") onLogin(f, (e.submitter && e.submitter.value) || loginMode);
  if (f.dataset.form === "verify") onVerify(f);
});

$app.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  if (Date.now() - lastDragEnd < 400 || e.target.closest("[data-drag]")) return;
  const a = b.dataset.act, i = +b.dataset.i, s = +b.dataset.s;
  const w = currentWorkout();
  switch (a) {
    case "reload": location.hash = "#/home"; location.reload(); break;
    case "histmore": histLimit += 100; render(); break;
    case "swipedel": {
      const x = getItem(b.dataset.id); if (!x) return;
      if (!await ask({ title: "Supprimer cette séance ?", text: x.templateName + " · " + vLabel(x.variantName) + " du " + fmtDate(x.startedAt) + "\nElle disparaîtra de l'historique et des stats.", ok: "Supprimer", danger: true })) { swClose(swOpen); return; }
      remove(x.id); swOpen = null; toast("Séance supprimée"); render();
    } break;
    case "stretchgo": { const ids = String(b.dataset.seq || "").split(",").filter(x => /^[a-z0-9-]{1,60}$/.test(x)); if (ids.length) { exoReturn = location.hash || "#/home"; stretchSeq = ids; go("exercices/" + ids[0]); } break; }
    case "stretchtips": exoReturn = location.hash || "#/home"; stretchSeq = null; break;
    case "stretchok": try { localStorage.setItem("fiitday-stretch-ok", b.dataset.id); } catch (err) { } render(); break;
    case "evometric": evo.m[b.dataset.k] = b.dataset.v; render(); break;
    case "evoper": evo.per = b.dataset.v; render(); break;
    case "exoview": exoReturn = location.hash; go("exercices/" + b.dataset.id); break;
    case "sesspick": if (w) {
      const e = w.exercises[i]; if (!e) return;
      const sf = b.dataset.sf, isT = sf === "target";
      const members = sf === "grest" ? w.exercises.filter(x => x.groupId && x.groupId === e.groupId) : [e];
      const val = await pickSeconds(isT ? "Objectif de gainage" : sf === "grest" ? "Repos après chaque tour" : "Temps de repos", isT ? e.target : e.rest, isT ? 5 : 0, 600);
      if (val == null) return;
      const t = getItem(w.templateId), v = t && t.variants.find(x => x.id === w.variantId);
      const inTpl = v && members.some(x => v.exercises.some(y => y.id === x.exId));
      let scope = "today";
      if (inTpl) { scope = await choose("Ce changement est pour…", [["today", "Seulement aujourd'hui", "Pour cette séance uniquement"], ["always", "Toutes les séances", "Enregistré aussi dans « " + w.templateName + " · " + vLabel(w.variantName) + " »"]]); if (!scope) return; }
      members.forEach(x => { if (isT) x.target = String(val); else x.rest = val; });
      put("workout", w);
      if (scope === "always") { members.forEach(x => { const te = v.exercises.find(y => y.id === x.exId); if (te) { if (isT) te.target = String(val); else te.rest = val; } }); put("template", t); }
      render(); toast((isT ? "Objectif : " : "Repos : ") + fmtSecs(val) + (scope === "always" ? " · pour toutes les séances" : " · aujourd'hui"));
    } break;
    /* connexion */
    case "local": db.mode = "local"; saveNow(); render(); break;
    case "loginmode": { const em = $app.querySelector('input[name="email"]'); if (em) loginEmail = em.value; const fn = $app.querySelector('input[name="firstname"]'); if (fn) loginName = fn.value; loginMode = b.dataset.m === "up" ? "up" : "in"; render(); const f = $app.querySelector(loginEmail ? 'input[name="password"]' : 'input[name="email"]'); if (f) f.focus(); } break;
    case "tologin": db.mode = null; saveNow(); render(); break;
    case "changemail": db.verify = null; saveNow(); render(); break;
    case "resend": {
      const msg = $app.querySelector("[data-msg]");
      try { await authReq("resend", { type: "signup", email: db.verify }); msg.className = "msg"; msg.textContent = "Nouveau code envoyé à " + db.verify + "."; }
      catch (err) { msg.className = "msg err"; msg.textContent = authMessage(err); }
    } break;
    case "logout": {
      if (!await ask({ title: "Se déconnecter ?", text: "Tes données restent enregistrées dans ton compte. Elles seront effacées de cet appareil.", ok: "Se déconnecter", danger: true })) return;
      flushPending(); await sync();
      if (Object.values(db.items).some(x => x.dirty) && !await ask({ title: "Modifications non envoyées", text: "Certaines modifications n'ont pas pu être envoyées (pas de réseau ?). Se déconnecter quand même ?", ok: "Oui", danger: true })) return;
      db = emptyDb(); dataRev++; consentAsked = nameAsked = false; saveNow(); go("home"); render(); break;
    }
    case "delaccount": {
      const conf = await ask({ title: "Supprimer ton compte ?", text: "Ton compte et toutes tes données (programmes, séances, historique, séances partagées) seront définitivement effacés, sur tous tes appareils. Cette action est irréversible.\n\nTape SUPPRIMER pour confirmer.", input: "", ok: "Supprimer définitivement", danger: true });
      if (conf == null) return;
      if (conf.trim().toUpperCase() !== "SUPPRIMER") { toast("Suppression annulée : tape SUPPRIMER pour confirmer"); return; }
      try {
        await rest("POST", "rpc/delete_my_account", {}, { Prefer: "return=minimal" });
      } catch (err) {
        toast(err.status === 404 ? "Suppression indisponible pour le moment. Écris-nous (voir Informations légales)." : (err.message === "Failed to fetch" ? "Pas de connexion internet" : "La suppression a échoué, réessaie"));
        return;
      }
      db = emptyDb(); dataRev++; consentAsked = nameAsked = false; saveNow(); toast("Ton compte a été supprimé"); go("home"); render();
    } break;
    case "syncnow": flushPending(); await sync(); if (syncState.status === "ok") toast("Synchronisé"); break;

    /* accueil */
    case "start": startWorkout(b.dataset.t, b.dataset.v); break;

    /* séance */
    case "done": if (w) markDone(w, i, s); break;
    case "addset": if (w) {
      b.dataset.g.split(",").map(Number).forEach(k => {
        const ex = w.exercises[k];
        if (ex.dropScope === "last" && dropsOf(ex)) {
          // la nouvelle série devient la dernière : elle reçoit les baisses, l'ancienne les perd si elles sont vides
          const prev = ex.sets[ex.sets.length - 1];
          if (prev && !prev.done && !(prev.drops || []).some(d => setHasData(d, ex.type))) prev.drops = [];
        }
        ex.sets.push(blankSet(dropsOf(ex)));
      });
      put("workout", w); render();
    } break;
    case "delset": if (w) {
      b.dataset.g.split(",").map(Number).forEach(k => {
        const ex = w.exercises[k]; if (ex.sets.length <= 1) return;
        ex.sets.pop();
        const last = ex.sets[ex.sets.length - 1];
        if (ex.dropScope === "last" && dropsOf(ex) && !(last.drops || []).length) last.drops = blankSet(dropsOf(ex)).drops;
      });
      put("workout", w); render();
    } break;
    case "rename": if (w) {
      const ex = w.exercises[i];
      const n = await ask({ title: "Renommer l'exercice", input: ex.name, ok: "Renommer" });
      if (!n) return;
      ex.name = n.slice(0, 80); put("workout", w);
      const t = getItem(w.templateId), te = tplExercise(w, ex.exId);
      if (t && te) { te.name = n.slice(0, 80); put("template", t); }
      render();
    } break;
    case "addex": case "sessstretch": if (w) {
      const etir = a === "sessstretch", what = etir ? "étirement" : "exercice";
      const picks = await pickExercises(etir ? "etir" : "muscu", etir ? "Ajouter des étirements" : "Ajouter des exercices"); if (!picks) return;
      const tes = [];
      for (const p of picks) {
        const te = libExercise(p);
        if (!p.lib && !ownDefaults(p.name)) { // exercice nouveau : son type, pour savoir quoi noter
          const type = await choose("Type de « " + te.name + " »", TYPE_CHOICES); if (!type) return;
          Object.assign(te, { type }, type === "time" ? { target: "45", rest: 60 } : type === "dist" ? { target: "1000", rest: 120 } : {});
        }
        tes.push(te);
      }
      const wnew = tes.map(te => ({ exId: te.id, name: te.name, type: te.type, target: te.target, rest: te.rest, load: !!te.load, drops: 0, groupId: null, groupKind: null, sets: Array.from({ length: Math.max(1, num(te.sets) || 1) }, () => blankSet(0)) }));
      const c = db.live.chrono, chronoEx = c && c.wid === w.id ? w.exercises[c.i] : null;
      const out = await orderNew(w.exercises, wnew, what); if (!out) return;
      const add = await ask({ title: tes.length > 1 ? "Les ajouter au programme ?" : "L'ajouter au programme ?", text: (tes.length > 1 ? "Les ajouter" : "L'ajouter") + " aussi à « " + w.templateName + " · " + vLabel(w.variantName) + " », au même endroit, pour les prochaines fois ?", ok: "Oui", cancel: "Juste aujourd'hui" });
      w.exercises = out;
      if (chronoEx && db.live.chrono) db.live.chrono.i = out.indexOf(chronoEx); // le chrono en cours suit son exercice
      if (add) {
        const t = getItem(w.templateId), v = t && t.variants.find(x => x.id === w.variantId);
        if (v) {
          // chaque nouvel exercice va juste après l'exercice qui le précède dans la séance (après tout son groupe)
          let at = -1;
          out.forEach(we => {
            const k = wnew.indexOf(we);
            if (k >= 0) { v.exercises.splice(at + 1, 0, tes[k]); at++; return; }
            const ti = v.exercises.findIndex(x => x.id === we.exId); if (ti < 0) return;
            at = ti; const g = v.exercises[ti].groupId; if (g) while (v.exercises[at + 1] && v.exercises[at + 1].groupId === g) at++;
          });
          put("template", t);
        }
      }
      put("workout", w); save(); render();
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
        // 5 s de préparation avant que le chrono de gainage ne démarre (pas pour le repos)
        const cx = w.exercises[i], isD = cx.type === "dist";
        db.live.chrono = { wid: w.id, i, s, start: Date.now() + CHRONO_PREP * 1000, target: isD ? 0 : num(cx.target), dist: isD ? num(cx.target) : 0, alerted: false, count: CHRONO_PREP + 1, go: false };
        db.live.restEnd = null; setTimeout(armEdge, 0);
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
      finishWorkout(getItem(w.id));
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
      const t = { id: "tpl-" + uid(), name: n.slice(0, 60), order: templates().length, variants: [] }; // aucune séance par défaut : l'utilisateur ajoute la première avec « + Nouvelle séance »
      put("template", t); go("program/" + t.id);
    } break;
    case "picksec": {
      const { t, v } = currentProgram(); if (!v) return;
      const ex = v.exercises[+b.dataset.e]; if (!ex) return;
      if (b.dataset.sf === "next") {
        const val = await pickSeconds("Repos avant l'exercice suivant", restNextOf(ex, v), 0, 600);
        if (val == null) return;
        v.exercises.forEach(x => { if (x === ex || (ex.groupId && x.groupId === ex.groupId)) x.restNext = val; });
        put("template", t); render(); return;
      }
      const sf = b.dataset.sf, isTarget = sf === "target";
      const val = await pickSeconds(isTarget ? "Temps cible" : sf === "grest" ? "Repos" : "Temps de repos", isTarget ? ex.target : ex.rest, isTarget ? 5 : 0, 600);
      if (val == null) return;
      if (isTarget) ex.target = String(val);
      else if (sf === "rest") ex.rest = val;
      else v.exercises.forEach(x => { if (x.groupId && x.groupId === ex.groupId) x.rest = val; });
      put("template", t); render();
    } break;
    case "tab": { const { t } = currentProgram(); if (t) go("program/" + t.id + "/" + b.dataset.v); } break;
    case "homeaddvar": { const t = getItem(b.dataset.t); if (!t) return; const v = { id: "v" + uid(), name: "Séance " + (t.variants.length + 1), exercises: [] }; t.variants.push(v); put("template", t); go("program/" + t.id + "/" + v.id); } break;
    case "addvar": { const { t } = currentProgram(); if (!t) return; const v = { id: "v" + uid(), name: "Séance " + (t.variants.length + 1), exercises: [] }; t.variants.push(v); put("template", t); go("program/" + t.id + "/" + v.id); } break;
    case "dupvar": {
      const { t, v } = currentProgram(); if (!v) return;
      const dest = await choose("Dupliquer « " + vLabel(v.name) + " » dans…", templates().map(x => [x.id, x.name + (x.id === t.id ? " (ce programme)" : ""), x.variants.length + " séance" + (x.variants.length > 1 ? "s" : "")]));
      if (!dest) return;
      const to = getItem(dest); if (!to) return;
      const gmap = {};
      const copy = v.exercises.map(e => { const c = Object.assign({}, e, { id: "e-" + uid() }); if (e.groupId) c.groupId = gmap[e.groupId] = gmap[e.groupId] || "g-" + uid(); return c; });
      let name = vLabel(v.name);
      if (to.variants.some(x => vLabel(x.name) === name)) name += " (copie)";
      const c = { id: "v" + uid(), name, exercises: copy };
      to.variants.push(c); put("template", to);
      toast("Séance dupliquée dans « " + to.name + " »"); go("program/" + to.id + "/" + c.id);
    } break;
    case "delvar": { const { t, v } = currentProgram(); if (!v) return; if (!await ask({ title: "Supprimer « " + vLabel(v.name) + " » ?", text: "L'historique des séances déjà faites est conservé.", ok: "Supprimer", danger: true })) return; t.variants = t.variants.filter(x => x !== v); put("template", t); go("program/" + t.id); } break;
    case "addtplex": case "addstretch": {
      const { t, v } = currentProgram(); if (!v) return;
      const etir = a === "addstretch", what = etir ? "étirement" : "exercice";
      const picks = await pickExercises(etir ? "etir" : "muscu", etir ? "Ajouter des étirements" : "Ajouter des exercices"); if (!picks) return;
      const out = await orderNew(v.exercises, picks.map(libExercise), what); if (!out) return;
      v.exercises = out; cleanGroups(v); put("template", t); render();
      toast(picks.length > 1 ? picks.length + " " + what + "s ajoutés" : (etir ? "Étirement ajouté" : "Exercice ajouté"));
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
    case "sharevar": { const { t, v } = currentProgram(); if (v) shareVariant(t, v); } break;
    case "importvar": { const code = await ask({ title: "Importer une séance", text: "Colle le lien de la séance qu'on t'a envoyé.", input: "", ok: "Continuer" }); if (!code) return;
      if (/^\s*FIITDAY\d:/.test(code)) { if (await ask({ title: "C'est une sauvegarde", text: "Ce texte est une sauvegarde complète (programmes, séances, réglages), pas un lien de séance. La restaurer dans ce compte ?", ok: "Restaurer" })) restoreBackup(code); return; }
      if (XFER_RE.test(normCode(code)) && code.trim().length <= 12) { if (await ask({ title: "C'est un code de transfert", text: "Ce code sert à récupérer toutes les données d'un autre compte (programmes, séances, réglages). Les récupérer dans ce compte ?", ok: "Récupérer" })) useTransferCode(code); return; }
      importShared(code); } break;
    case "launchvar": flushPending(); startWorkout(b.dataset.t, b.dataset.v, true); break;
    case "deltpl": { const { t } = currentProgram(); if (!t) return; if (!await ask({ title: "Supprimer « " + t.name + " » ?", text: "Ses séances et exercices seront supprimés. L'historique des séances déjà faites est conservé.", ok: "Supprimer", danger: true })) return; remove(t.id); go("home"); } break;

    /* réglages */
    case "set": setSetting(b.dataset.k, b.dataset.val); break;
    case "testwatch": {
      if (!nativeWatch() || typeof Native.testWatch !== "function") return;
      askNotif(); Native.testWatch();
      toast("Notification de test dans 5 secondes : verrouille ton téléphone et regarde ta montre");
    } break;
    case "testalert": {
      b.classList.remove("lit"); void b.offsetWidth; b.classList.add("lit"); setTimeout(() => b.classList.remove("lit"), 1300);
      audio();
      const a = settings().alert;
      if (a === "aucune") { toast("Alerte désactivée"); break; }
      signal();
      if ((a === "vibration" || a === "les deux") && !Native && !navigator.vibrate) toast("Sur ce téléphone, un site web ne peut pas faire vibrer (c'est le cas sur iPhone) : seul le son fonctionne.");
    } break;
    case "filesave": {
      const r = await saveFile(backupName(), await backupText());
      if (r === "ok") toast("Sauvegarde enregistrée");
      else if (r === "download") toast("Sauvegarde enregistrée dans tes téléchargements (" + backupName() + ")");
      else if (r === "error") toast("La sauvegarde n'a pas pu être enregistrée");
    } break;
    case "fileopen": {
      const txt = await openFile();
      if (txt === false) toast("Ce fichier n'a pas pu être lu");
      else if (txt != null) restoreBackup(txt, "Ce fichier n'est pas une sauvegarde Fiitday");
    } break;
    case "xfercreate": {
      if (!db.auth) { toast("Connecte-toi à ton compte pour créer un code"); return; }
      const txt = await backupText();
      let row; try { row = await rpc("create_transfer", { p_payload: txt }); } catch (err) { toast(xferErr(err)); return; }
      row = Array.isArray(row) ? row[0] : row;
      if (!row || !XFER_RE.test(row.transfer_code || "")) { toast("Impossible de créer un code, réessaie"); return; }
      const copy = await ask({ title: "Code de transfert", html: '<div class="xfer-code" aria-label="Code ' + esc(row.transfer_code.split("").join(" ")) + '">' + esc(row.transfer_code) + "</div>",
        text: "Valable jusqu'à " + fmtTime(Date.parse(row.valid_until)) + " (1 heure).\nDans l'autre compte : Réglages › Données › « J'ai un code ».\nCe code donne accès à toutes tes données : ne le partage pas.", ok: "Copier le code", cancel: "Fermer" });
      if (copy) { try { await navigator.clipboard.writeText(row.transfer_code); toast("Code copié"); } catch (err) { toast("Note le code : " + row.transfer_code); } }
    } break;
    case "xferuse": {
      if (!db.auth) { toast("Connecte-toi au compte qui doit recevoir les données"); return; }
      const c = await ask({ title: "J'ai un code", text: "Tape le code de 8 caractères créé dans l'autre compte (Réglages › Données › Créer un code). Il n'est valable qu'1 heure.", input: "", code: true, ok: "Récupérer" });
      if (c) useTransferCode(c);
    } break;
    case "import": {
      const txt = await ask({ title: "Restaurer une sauvegarde", text: "Colle le texte de la sauvegarde. Ce qui a été supprimé depuis revient ; ce que tu as modifié depuis garde sa version la plus récente.", input: "", multiline: true, ok: "Restaurer" });
      if (txt) restoreBackup(txt);
    } break;
  }
});
async function restoreBackup(txt, badMsg) {
  {
      try {
        const j = JSON.parse(await unpackBackup(txt)); if (!j || j.app !== "muscuapp" || !Array.isArray(j.items)) throw new Error();
        let n = 0, bad = 0;
        for (const it of j.items) { if (it && it.kind === "workout" && it.data) it.data = fatWorkout(it.data); if (!validItem(it) || typeof it.updated_at !== "number") { bad++; continue; } const cur = db.items[it.id]; if (!cur || cur.deleted || it.updated_at > cur.updated_at) { db.items[it.id] = { id: it.id, kind: it.kind, data: it.data, updated_at: Math.max(it.updated_at, (cur && cur.updated_at + 1) || 0), deleted: false, dirty: true }; n++; } }
        dataRev++; localFixed = false; saveNow(); scheduleSync(); render(); toast((n ? n + " élément" + (n > 1 ? "s" : "") + " restauré" + (n > 1 ? "s" : "") : "Rien à restaurer : tout ce qui est dans la sauvegarde est déjà dans l'appli") + (bad ? " (" + bad + " ignoré" + (bad > 1 ? "s" : "") + ")" : ""));
      } catch (err) { toast(badMsg || "Ce texte n'est pas une sauvegarde valide"); }
  }
}

/* Saisie au clavier : enregistre sans redessiner l'écran (on garde le focus) */
$app.addEventListener("input", e => {
  const el = e.target;
  if (el.dataset.f) {
    const w = currentWorkout(); if (!w) return;
    const ex = w.exercises[+el.dataset.i]; if (!ex) return;
    if (el.dataset.f === "note") {
      // la note reste dans cette séance ; pendant la séance en cours, elle est aussi gardée pour la prochaine fois (programme)
      ex.note = el.value; putLater("workout", w);
      if (!w.endedAt) { const t = getItem(w.templateId), te = tplExercise(w, ex.exId); if (t && te) { te.note = el.value; putLater("template", t); } }
      return;
    }
    const set = ex.sets[+el.dataset.s]; if (!set) return;
    let tgt = set;
    if ("d" in el.dataset) { set.drops = set.drops || []; tgt = set.drops[+el.dataset.d] = set.drops[+el.dataset.d] || { kg: "", reps: "" }; }
    if (el.dataset.f === "clock") { const clean = el.value.replace(/[^\d:]/g, ""); if (clean !== el.value) el.value = clean; const sec = parseClock(clean); tgt.sec = sec == null ? "" : String(sec); putLater("workout", w); return; }
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
    if (p === "type" || p === "drops" || p === "gkind" || p === "dscope") return; // géré par « change »
    if (p === "gsets" || p === "grest") {
      const val = num(el.value) == null ? "" : Math.max(0, Math.round(num(el.value)));
      v.exercises.forEach(e => { if (e.groupId && e.groupId === ex.groupId) e[p === "gsets" ? "sets" : "rest"] = val; });
      putLater("template", t); return;
    }
    if (p === "name") {
      const ti = $app.querySelector('[data-title="' + el.dataset.e + '"]'); if (ti) ti.textContent = el.value;
      const lk = $app.querySelector('[data-exolink="' + el.dataset.e + '"]'), lib = libFor(el.value);
      if (lk) { lk.hidden = !lib; lk.innerHTML = lib ? '<button type="button" class="chip-mini" data-act="exoview" data-id="' + lib.id + '">' + ICON.play + "Voir le mouvement</button>" : ""; }
    }
    ex[p] = (p === "sets" || p === "rest") ? (num(el.value) == null ? "" : Math.max(0, Math.round(num(el.value)))) : el.value;
    putLater("template", t);
  }
});
$app.addEventListener("change", e => {
  const el = e.target;
  if (el.matches && el.matches("input[data-setname]")) { const st = settings(); st.firstName = el.value.trim().slice(0, 40); put("settings", st); toast("Prénom enregistré"); return; }
  if (el.dataset.p === "type") {
    const { t, v } = currentProgram(); if (!t) return;
    const ex = v.exercises[+el.dataset.e]; ex.type = el.value;
    if (ex.type === "time" && !/^\d+$/.test(String(ex.target))) ex.target = "45";
    if (ex.type === "dist" && !(num(ex.target) >= 10)) ex.target = "1000";
    if ((ex.type === "reps" || ex.type === "rep") && !/^\d+(-\d+)?$/.test(String(ex.target))) ex.target = "8-10";
    if (ex.type !== "reps") ex.drops = 0;
    put("template", t); render();
  } else if (el.dataset.p === "load") {
    const { t, v } = currentProgram(); if (!t) return;
    const ex = v.exercises[+el.dataset.e]; if (!ex) return;
    ex.load = el.value === "1"; put("template", t); render();
  } else if (el.dataset.p === "drops" || el.dataset.p === "gkind" || el.dataset.p === "dscope") {
    const { t, v } = currentProgram(); if (!t) return;
    const ex = v.exercises[+el.dataset.e]; if (!ex) return;
    if (el.dataset.p === "drops") ex.drops = +el.value;
    else if (el.dataset.p === "dscope") ex.dropScope = el.value === "last" ? "last" : "all";
    else v.exercises.forEach(e => { if (e.groupId && e.groupId === ex.groupId) e.groupKind = el.value; });
    put("template", t); render();
  } else if (el.dataset.p || el.dataset.f) {
    if (el.dataset.f === "clock") { const sec = parseClock(el.value); if (sec != null) el.value = fmtClock(sec); } // « 405 » s'affiche « 4:05 »
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
if (history.state && history.state.k) applyScroll(scrollPos[history.state.k] || 0); // page rechargée : même position
else history.replaceState({ k: navKey(), prev: "" }, "");
if (db.auth) sync();
setTimeout(() => window.__fiitdayPending(), 300);
if ("serviceWorker" in navigator && location.protocol === "https:" && !Native && !window.claude) {
  navigator.serviceWorker.register("sw.js").catch(() => { });
}
