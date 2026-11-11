package com.muscuapp.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.drawable.Icon;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

import java.text.DateFormat;
import java.util.Date;

/**
 * Minuteurs dans les notifications : repos (compte à rebours) et chrono (gainage, étirement, course).
 * - une notification permanente affiche le temps qui défile ; sur Android 16 et plus, elle demande à être une
 *   « Live Update » (en haut de l'écran verrouillé, pastille dans la barre d'état ; sur les montres qui le permettent) ;
 * - option « montre » : une notification simple au départ (la montre la reçoit, sans vibrer), avec un bouton
 *   « Passer » ou « Terminer », puis l'alerte de fin qui fait vibrer la montre ;
 * - à la fin du repos ou à l'objectif du chrono, si l'appli n'est pas à l'écran, le service sonne et/ou vibre.
 * Service de premier plan de type « courte durée » (shortService), le type prévu par Android pour ce besoin.
 */
public class RestTimerService extends Service {
    static final int ONGOING_ID = 10;
    static final int ALERT_ID = 11;
    static final int WATCH_ID = 13;
    private static final String CH_ONGOING = "repos_en_cours";
    private static final String CH_END = "repos_fin";
    private static final String CH_WATCH = "montre_depart";
    private static final String CH_END_WATCH = "montre_fin";
    static final String ACT_SKIP = "com.muscuapp.app.SKIP_REST";
    static final String ACT_STOP = "com.muscuapp.app.STOP_CHRONO";
    private static final long[] PATTERN = new long[]{0, 350, 150, 350};
    /** heure de fin (ms) du dernier repos ou objectif signalé par une notification : l'appli ne re-sonne pas en revenant */
    static volatile long alertedEnd = 0;
    /** minuteur en cours dans le service : « rest », « chrono » ou null (mis à jour dès la demande, avant le démarrage) */
    static volatile String current = null;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable fire = this::onEnd;
    private final Runnable stopper = this::stopSelf;
    private String kind = "rest";
    private long end = 0;    // repos : heure de fin ; chrono : heure de l'objectif (0 = pas d'objectif)
    private long start = 0;  // chrono : heure de départ (après les 5 s de préparation)
    private String mode = "vibration", title = "", text = "";
    private boolean watch = false, reached = false;

    static void start(Context c, long end, String mode) { startRest(c, end, mode, "", false); }

    static void startRest(Context c, long end, String mode, String title, boolean watch) {
        current = "rest";
        launch(c, new Intent(c, RestTimerService.class).putExtra("kind", "rest").putExtra("end", end)
                .putExtra("mode", mode).putExtra("title", title).putExtra("watch", watch));
    }

    static void startChrono(Context c, long start, long targetSec, String mode, String title, String text, boolean watch) {
        current = "chrono";
        launch(c, new Intent(c, RestTimerService.class).putExtra("kind", "chrono").putExtra("start", start)
                .putExtra("end", targetSec > 0 ? start + targetSec * 1000 : 0).putExtra("mode", mode)
                .putExtra("title", title).putExtra("text", text).putExtra("watch", watch));
    }

    private static void launch(Context c, Intent i) {
        try {
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i);
            else c.startService(i);
        } catch (Exception ignored) {
        }
    }

    /** arrête le minuteur s'il est de ce genre (null : quel qu'il soit) — un chrono qui vient de démarrer n'est pas coupé par la fin d'un repos */
    static void stop(Context c, String onlyKind) {
        if (onlyKind != null && current != null && !onlyKind.equals(current)) return;
        current = null;
        try { c.stopService(new Intent(c, RestTimerService.class)); } catch (Exception ignored) { }
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) { nm.cancel(ONGOING_ID); nm.cancel(WATCH_ID); }
    }

    static void stop(Context c) { stop(c, null); }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        String k = intent.getStringExtra("kind");
        kind = "chrono".equals(k) ? "chrono" : "rest";
        end = intent.getLongExtra("end", 0);
        start = intent.getLongExtra("start", 0);
        String m = intent.getStringExtra("mode");
        mode = m == null ? "vibration" : m;
        title = str(intent.getStringExtra("title"));
        text = str(intent.getStringExtra("text"));
        watch = intent.getBooleanExtra("watch", false);
        reached = false;
        current = kind;
        try {
            if (Build.VERSION.SDK_INT >= 34) startForeground(ONGOING_ID, ongoing(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE);
            else startForeground(ONGOING_ID, ongoing());
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        handler.removeCallbacks(fire);
        handler.removeCallbacks(stopper); // un nouveau minuteur annule l'arrêt prévu après le son précédent
        postWatchCard();
        if (end > 0) {
            long d = end - System.currentTimeMillis();
            if (d <= 0) onEnd();
            else handler.postDelayed(fire, d);
        }
        return START_NOT_STICKY;
    }

    private static String str(String s) { return s == null ? "" : s; }

    /** Android limite ce type de service à environ 3 minutes : on garde alors la notification affichée, sans alerte. */
    @Override
    public void onTimeout(int startId) {
        handler.removeCallbacks(fire);
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_DETACH);
        else stopForeground(false);
        stopSelf();
    }

    private boolean isChrono() { return "chrono".equals(kind); }

    private void onEnd() {
        boolean visible = MainActivity.visible;
        // avec l'option montre, l'alerte part aussi quand Fiitday est à l'écran (la montre doit vibrer) ; le son reste joué par l'appli
        boolean notify = !"aucune".equals(mode) && (watch || !visible);
        boolean played = false;
        if (notify) {
            played = alert(!visible);
            if (!visible) alertedEnd = end;
        }
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (isChrono()) {
            // objectif atteint : le chrono continue jusqu'à « Terminer »
            reached = true;
            if (nm != null) { try { nm.notify(ONGOING_ID, ongoing()); } catch (SecurityException ignored) { } }
            return;
        }
        if (nm != null) nm.cancel(WATCH_ID);
        current = null;
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
        // le son joue encore quelques secondes : le service s'arrête juste après
        if (played) handler.postDelayed(stopper, 4000);
        else stopSelf();
    }

    private PendingIntent openApp() {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** bouton « Passer » (repos) ou « Terminer » (chrono), aussi affiché sur la montre */
    private Notification.Action action() {
        String act = isChrono() ? ACT_STOP : ACT_SKIP;
        Intent i = new Intent(this, ActionReceiver.class).setAction(act);
        PendingIntent pi = PendingIntent.getBroadcast(this, isChrono() ? 2 : 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Action.Builder(Icon.createWithResource(this, R.drawable.ic_stat), isChrono() ? "Terminer" : "Passer", pi).build();
    }

    private Notification.Builder builder(String channel) {
        return Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, channel) : new Notification.Builder(this);
    }

    static void channels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        // anciens canaux (le son y dépendait des réglages de notification du téléphone)
        for (String old : new String[]{"repos_deux", "repos_son", "repos_vib"}) { try { nm.deleteNotificationChannel(old); } catch (Exception ignored) { } }
        if (nm.getNotificationChannel(CH_ONGOING) == null) {
            NotificationChannel nc = new NotificationChannel(CH_ONGOING, "Minuteur en cours", NotificationManager.IMPORTANCE_LOW);
            nc.setSound(null, null);
            nc.enableVibration(false);
            nm.createNotificationChannel(nc);
        }
        if (nm.getNotificationChannel(CH_END) == null) {
            NotificationChannel nc = new NotificationChannel(CH_END, "Fin du repos", NotificationManager.IMPORTANCE_HIGH);
            nc.setSound(null, null);
            nc.enableVibration(false);
            nm.createNotificationChannel(nc);
        }
        if (nm.getNotificationChannel(CH_WATCH) == null) {
            NotificationChannel nc = new NotificationChannel(CH_WATCH, "Montre : départ du repos ou du chrono", NotificationManager.IMPORTANCE_DEFAULT);
            nc.setSound(null, null);
            nc.enableVibration(false);
            nm.createNotificationChannel(nc);
        }
        if (nm.getNotificationChannel(CH_END_WATCH) == null) {
            NotificationChannel nc = new NotificationChannel(CH_END_WATCH, "Montre : fin du repos ou objectif atteint", NotificationManager.IMPORTANCE_HIGH);
            nc.setSound(null, null);
            nc.enableVibration(true);
            nc.setVibrationPattern(PATTERN);
            nm.createNotificationChannel(nc);
        }
    }

    /** temps « m:ss » */
    private static String clock(long ms) {
        long s = Math.max(0, Math.round(ms / 1000.0));
        return (s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);
    }

    /** notification permanente : le temps défile (compte à rebours du repos, chrono qui monte) */
    private Notification ongoing() {
        channels(this);
        boolean chrono = isChrono();
        String t = chrono ? (title.isEmpty() ? "Chrono" : title) : (title.isEmpty() || "Repos".equals(title) ? "Repos en cours" : title);
        String x = chrono ? (reached ? "Objectif atteint 💪 · Terminer quand tu veux" : (text.isEmpty() ? "Appuie sur Terminer à la fin" : text))
                : "Fiitday te prévient à la fin du repos.";
        Notification.Builder b = builder(CH_ONGOING)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(t)
                .setContentText(x)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(openApp())
                .setWhen(chrono ? start : end)
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setCategory(Notification.CATEGORY_STOPWATCH)
                .addAction(action());
        if (Build.VERSION.SDK_INT >= 24) b.setChronometerCountDown(!chrono);
        if (Build.VERSION.SDK_INT >= 26 && !chrono) b.setTimeoutAfter(Math.max(1000, end - System.currentTimeMillis() + 2000));
        // Android 16 et plus : demande à devenir une « Live Update » (Notification.EXTRA_REQUEST_PROMOTED_ONGOING)
        Bundle ex = new Bundle();
        ex.putBoolean("android.requestPromotedOngoing", true);
        b.addExtras(ex);
        return b.build();
    }

    /** option montre : notification simple (non permanente, donc transmise à la montre), sans son ni vibration */
    private void postWatchCard() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (!watch) { nm.cancel(WATCH_ID); return; }
        channels(this);
        boolean chrono = isChrono();
        long now = System.currentTimeMillis();
        String t = chrono ? (title.isEmpty() ? "Chrono lancé" : title) : "Repos " + clock(end - now);
        String x = chrono ? (text.isEmpty() ? "Chrono lancé" : text) : "Fin à " + DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date(end));
        Notification.Builder b = builder(CH_WATCH)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(t)
                .setContentText(x)
                .setOnlyAlertOnce(true)
                .setContentIntent(openApp())
                .setWhen(chrono ? start : end)
                .setShowWhen(true)
                .setUsesChronometer(true)
                .addAction(action());
        if (Build.VERSION.SDK_INT >= 24) b.setChronometerCountDown(!chrono);
        if (Build.VERSION.SDK_INT >= 26) b.setTimeoutAfter(chrono ? 3 * 3600_000L : Math.max(1000, end - now + 5000));
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_DEFAULT);
        try { nm.notify(WATCH_ID, b.build()); } catch (SecurityException ignored) { }
    }

    /**
     * Fin du repos ou objectif du chrono : notification « Pause terminée » / « Objectif atteint ».
     * Le son passe par le flux « alarme » : il se fait entendre même écran verrouillé (le son d'une notification peut y être coupé).
     * Avec l'option montre, la notification vibre elle-même (la montre vibre aussi) : le service ne vibre pas en plus.
     * @param local vrai si l'appli n'est pas à l'écran : le service joue alors le son (sinon c'est l'appli)
     * @return vrai si un son a été lancé (le service doit rester actif le temps qu'il joue)
     */
    private boolean alert(boolean local) {
        boolean sound = local && (mode.equals("son") || mode.equals("les deux"));
        boolean vib = local && !watch && (mode.equals("vibration") || mode.equals("les deux"));
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return false;
        channels(this);
        boolean chrono = isChrono();
        Notification.Builder b = builder(watch ? CH_END_WATCH : CH_END)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(chrono ? "Objectif atteint 💪" : "Pause terminée")
                .setContentText(chrono ? (title.isEmpty() ? "Tu peux arrêter le chrono" : title + (end > start ? " · " + clock(end - start) + " tenu" : "")) : "C'est reparti 💪")
                .setAutoCancel(true)
                .setContentIntent(openApp())
                .setCategory(Notification.CATEGORY_REMINDER);
        if (chrono) b.addAction(action());
        if (Build.VERSION.SDK_INT < 26) {
            b.setPriority(Notification.PRIORITY_HIGH);
            if (watch) b.setVibrate(PATTERN);
        }
        try { nm.notify(ALERT_ID, b.build()); } catch (SecurityException ignored) { }
        if (vib) vibrate(this);
        if (!sound) return false;
        try {
            Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            if (u == null) u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            final Ringtone r = RingtoneManager.getRingtone(this, u);
            if (r == null) return false;
            r.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            r.play();
            handler.postDelayed(() -> { try { r.stop(); } catch (Exception ignored) { } }, 3500);
            return true;
        } catch (Exception e) { return false; }
    }

    private static void vibrate(Context c) {
        try {
            Vibrator v = (Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(PATTERN, -1),
                        new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build());
                else v.vibrate(PATTERN, -1);
            }
        } catch (Exception ignored) { }
    }

    /** Réglages › Montre connectée › Tester : une notification qui doit arriver (et vibrer) sur la montre */
    static void testWatch(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        channels(c);
        Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        Notification.Builder b = (Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH_END_WATCH) : new Notification.Builder(c))
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle("Test de la montre")
                .setContentText("Si tu lis ceci sur ta montre, tout est prêt 👍")
                .setAutoCancel(true)
                .setContentIntent(PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        if (Build.VERSION.SDK_INT < 26) { b.setPriority(Notification.PRIORITY_HIGH); b.setVibrate(PATTERN); }
        try { nm.notify(ALERT_ID, b.build()); } catch (SecurityException ignored) { }
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(fire);
        handler.removeCallbacks(stopper);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
