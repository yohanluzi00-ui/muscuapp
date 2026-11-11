package com.muscuapp.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.app.NotificationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;

/**
 * Coque Android de Fiitday : affiche l'appli web embarquée (assets/www)
 * et lui donne accès à la vibration et au maintien de l'écran allumé.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private WebView web;
    /** l'appli est-elle à l'écran ? (sinon le minuteur de repos prévient par une notification) */
    static volatile boolean visible = false;
    /** sauvegarde en fichier : le téléphone demande où l'enregistrer, puis quel fichier relire */
    private static final int REQ_SAVE = 41, REQ_OPEN = 42;
    private static final long MAX_FILE = 20L * 1024 * 1024;
    private static String pendingSave = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String path = u.getPath();
                if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
                try {
                    InputStream in = getAssets().open("www" + path);
                    return new WebResourceResponse(mime(path), "utf-8", in);
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found",
                            new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) {
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl("https://" + HOST + "/index.html");
    }

    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        if (path.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }

    /** Fonctions appelées depuis le JavaScript (window.AndroidBridge). */
    private class Bridge {
        @JavascriptInterface
        public void vibrate(String patternJson) {
            try {
                JSONArray a = new JSONArray(patternJson);
                long[] p = new long[a.length() + 1];
                p[0] = 0;
                for (int i = 0; i < a.length(); i++) p[i + 1] = a.getLong(i);
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null || !v.hasVibrator()) return;
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(p, -1));
                else v.vibrate(p, -1);
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void keepScreenOn(final boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void startRestTimer(String at, String mode) {
            long end;
            try { end = Long.parseLong(at); } catch (Exception e) { return; }
            RestTimerService.start(MainActivity.this, end, mode);
        }

        @JavascriptInterface
        public void stopRestTimer() { RestTimerService.stop(MainActivity.this); }

        @JavascriptInterface
        public String restAlertedAt() { return String.valueOf(RestTimerService.alertedEnd); }

        @JavascriptInterface
        public void askNotifications() {
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(() -> requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 2));
            }
        }

        @JavascriptInterface
        public void share(final String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TEXT, text);
                try { startActivity(Intent.createChooser(i, "Partager la séance")); } catch (Exception ignored) { }
            });
        }

        /** Réglages › Données › Enregistrer une sauvegarde : choix de l'emplacement (Téléchargements, Drive…) */
        @JavascriptInterface
        public void saveFile(final String name, final String content) {
            runOnUiThread(() -> {
                pendingSave = content;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TITLE, name);
                try { startActivityForResult(i, REQ_SAVE); }
                catch (Exception e) { pendingSave = null; fileResult("save", "error", null); }
            });
        }

        /** Réglages › Données › Restaurer une sauvegarde : choix du fichier, relu ici puis donné à l'appli */
        @JavascriptInterface
        public void openFile() {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try { startActivityForResult(i, REQ_OPEN); }
                catch (Exception e) { fileResult("open", "error", null); }
            });
        }

        @JavascriptInterface
        public String version() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
            catch (Exception e) { return ""; }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_SAVE && requestCode != REQ_OPEN) return;
        Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
        if (requestCode == REQ_SAVE) {
            String content = pendingSave;
            pendingSave = null;
            if (uri == null || content == null) { fileResult("save", "cancel", null); return; }
            fileResult("save", writeText(uri, content) ? "ok" : "error", null);
        } else {
            if (uri == null) { fileResult("open", "cancel", null); return; }
            String text = readText(uri);
            fileResult("open", text != null ? "ok" : "error", text);
        }
    }

    private boolean writeText(Uri uri, String content) {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        for (String mode : new String[]{"wt", "w"}) { // certains services (Drive…) refusent « wt »
            try (OutputStream out = getContentResolver().openOutputStream(uri, mode)) {
                if (out == null) continue;
                out.write(bytes);
                out.flush();
                return true;
            } catch (Exception ignored) {
            }
        }
        return false;
    }

    private String readText(Uri uri) {
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            if (in == null) return null;
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] b = new byte[8192];
            long total = 0;
            int n;
            while ((n = in.read(b)) > 0) {
                total += n;
                if (total > MAX_FILE) return null;
                buf.write(b, 0, n);
            }
            return new String(buf.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    /** renvoie le résultat à l'appli web : window.__fiitdayFile(type, "ok" | "cancel" | "error", texte) */
    private void fileResult(String kind, String status, String text) {
        if (web == null) return;
        final String js = "window.__fiitdayFile&&window.__fiitdayFile(" + JSONObject.quote(kind) + "," + JSONObject.quote(status) + "," + (text == null ? "null" : JSONObject.quote(text)) + ")";
        web.post(() -> { if (web != null) web.evaluateJavascript(js, null); });
    }

    @Override
    protected void onResume() {
        super.onResume();
        visible = true;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(RestTimerService.ALERT_ID); // de retour dans l'appli : l'alerte de fin n'est plus utile
    }

    @Override
    protected void onPause() {
        visible = false;
        super.onPause();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
