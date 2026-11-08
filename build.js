// Construit dist/ (version web, publiée sur GitHub Pages) et copie la même page dans l'appli Android.
const fs = require("fs");
const path = require("path");
const src = f => fs.readFileSync(path.join(__dirname, "src", f), "utf8");
const VERSION = new Date().toISOString().slice(0, 16).replace("T", " ");
const CACHE = Date.now().toString(36);

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Muscu</title>
<meta name="description" content="Suivi de mes séances de musculation">
<meta name="theme-color" content="#F5F4F0">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-192.png">
<style>
${src("style.css")}
</style>
</head>
<body>
<div id="app"></div>
<script>window.APP_BUILD = ${JSON.stringify(VERSION)};</script>
<script>
${src("app.js")}
</script>
</body>
</html>
`;

const dist = path.join(__dirname, "dist");
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, "index.html"), html);
for (const f of ["icon-192.png", "icon-512.png"]) fs.copyFileSync(path.join(__dirname, "src", "icons", f), path.join(dist, f));
fs.writeFileSync(path.join(dist, "manifest.webmanifest"), JSON.stringify({
  name: "Muscu", short_name: "Muscu", description: "Suivi de mes séances de musculation",
  start_url: "./", scope: "./", display: "standalone", lang: "fr",
  background_color: "#F5F4F0", theme_color: "#F5F4F0",
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}, null, 2));
fs.writeFileSync(path.join(dist, "sw.js"), `// Cache hors ligne de la version web
const CACHE = "muscu-${CACHE}";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  // réseau d'abord (pour recevoir les mises à jour), cache si hors ligne
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
`);
fs.writeFileSync(path.join(dist, ".nojekyll"), "");

// Appli Android : la même page, embarquée dans l'APK
const www = path.join(__dirname, "android", "app", "src", "main", "assets", "www");
fs.mkdirSync(www, { recursive: true });
fs.copyFileSync(path.join(dist, "index.html"), path.join(www, "index.html"));
for (const f of ["icon-192.png", "icon-512.png"]) fs.copyFileSync(path.join(dist, f), path.join(www, f));
console.log("Construit :", VERSION, "—", (html.length / 1024).toFixed(0), "Ko");
