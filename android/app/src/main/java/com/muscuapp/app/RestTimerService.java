package com.muscuapp.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

/**
 * Minuteur de repos dans les notifications : pendant le repos, une notification affiche le compte à rebours ;
 * à la fin, si l'appli n'est pas à l'écran (autre appli, écran verrouillé), une notification sonne et/ou vibre.
 * Service de premier plan de type « courte durée » (shortService), le type prévu par Android pour ce besoin.
 */
public class RestTimerService extends Service {
    static final int ONGOING_ID = 10;
    static final int ALERT_ID = 11;
    private static final String CH_ONGOING = "repos_en_cours";
    /** heure de fin (ms) du dernier repos signalé par une notification : l'appli ne re-sonne pas en revenant */
    static volatile long alertedEnd = 0;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable fire = this::onRestEnd;
    private final Runnable stopper = this::stopSelf;
    private long end = 0;
    private String mode = "vibration";

    static void start(Context c, long end, String mode) {
        Intent i = new Intent(c, RestTimerService.class).putExtra("end", end).putExtra("mode", mode);
        try {
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i);
            else c.startService(i);
        } catch (Exception ignored) {
        }
    }

    static void stop(Context c) {
        try { c.stopService(new Intent(c, RestTimerService.class)); } catch (Exception ignored) { }
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(ONGOING_ID);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        end = intent.getLongExtra("end", 0);
        String m = intent.getStringExtra("mode");
        mode = m == null ? "vibration" : m;
        try {
            if (Build.VERSION.SDK_INT >= 34) startForeground(ONGOING_ID, ongoing(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE);
            else startForeground(ONGOING_ID, ongoing());
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        handler.removeCallbacks(fire);
        handler.removeCallbacks(stopper); // un nouveau repos annule l'arrêt prévu après le son précédent
        long d = end - System.currentTimeMillis();
        if (d <= 0) onRestEnd();
        else handler.postDelayed(fire, d);
        return START_NOT_STICKY;
    }

    /** Android limite ce type de service à environ 3 minutes : on garde alors le compte à rebours affiché, sans alerte. */
    @Override
    public void onTimeout(int startId) {
        handler.removeCallbacks(fire);
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_DETACH);
        else stopForeground(false);
        stopSelf();
    }

    private void onRestEnd() {
        boolean played = false;
        if (!MainActivity.visible && !"aucune".equals(mode)) {
            played = alert();
            alertedEnd = end;
        }
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

    private Notification.Builder builder(String channel) {
        return Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, channel) : new Notification.Builder(this);
    }

    private Notification ongoing() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CH_ONGOING) == null) {
            NotificationChannel nc = new NotificationChannel(CH_ONGOING, "Minuteur de repos", NotificationManager.IMPORTANCE_LOW);
            nc.setSound(null, null);
            nc.enableVibration(false);
            nm.createNotificationChannel(nc);
        }
        Notification.Builder b = builder(CH_ONGOING)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle("Repos en cours")
                .setContentText("Fiitday te prévient à la fin du repos.")
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(openApp())
                .setWhen(end)
                .setShowWhen(true)
                .setUsesChronometer(true);
        if (Build.VERSION.SDK_INT >= 24) b.setChronometerCountDown(true);
        if (Build.VERSION.SDK_INT >= 26) b.setTimeoutAfter(Math.max(1000, end - System.currentTimeMillis() + 2000));
        return b.build();
    }

    /**
     * Fin du repos hors de l'appli : notification « Pause terminée », et le son / la vibration joués directement par le service.
     * Le son passe par le flux « alarme » : il se fait entendre même écran verrouillé (le son d'une notification peut y être coupé).
     * @return vrai si un son a été lancé (le service doit rester actif le temps qu'il joue)
     */
    private boolean alert() {
        boolean sound = mode.equals("son") || mode.equals("les deux");
        boolean vib = mode.equals("vibration") || mode.equals("les deux");
        long[] pattern = new long[]{0, 350, 150, 350};
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return false;
        String ch = "repos_fin";
        if (Build.VERSION.SDK_INT >= 26) {
            // anciens canaux (le son y dépendait des réglages de notification du téléphone)
            for (String old : new String[]{"repos_deux", "repos_son", "repos_vib"}) { try { nm.deleteNotificationChannel(old); } catch (Exception ignored) { } }
            if (nm.getNotificationChannel(ch) == null) {
                NotificationChannel nc = new NotificationChannel(ch, "Fin du repos", NotificationManager.IMPORTANCE_HIGH);
                nc.setSound(null, null);
                nc.enableVibration(false);
                nm.createNotificationChannel(nc);
            }
        }
        Notification.Builder b = builder(ch)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle("Pause terminée")
                .setContentText("C'est reparti 💪")
                .setAutoCancel(true)
                .setContentIntent(openApp())
                .setCategory(Notification.CATEGORY_REMINDER);
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH);
        try { nm.notify(ALERT_ID, b.build()); } catch (SecurityException ignored) { }
        if (vib) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pattern, -1),
                            new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build());
                    else v.vibrate(pattern, -1);
                }
            } catch (Exception ignored) { }
        }
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

    @Override
    public void onDestroy() {
        handler.removeCallbacks(fire);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
