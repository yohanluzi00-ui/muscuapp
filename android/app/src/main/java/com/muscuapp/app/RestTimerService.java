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
import android.media.RingtoneManager;
import android.os.Build;
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
        if (!MainActivity.visible && !"aucune".equals(mode)) {
            alert();
            alertedEnd = end;
        }
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
        stopSelf();
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

    private void alert() {
        boolean sound = mode.equals("son") || mode.equals("les deux");
        boolean vib = mode.equals("vibration") || mode.equals("les deux");
        String ch = sound && vib ? "repos_deux" : sound ? "repos_son" : "repos_vib";
        long[] pattern = new long[]{0, 350, 150, 350};
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(ch) == null) {
            String label = sound && vib ? "son et vibration" : sound ? "son" : "vibration";
            NotificationChannel nc = new NotificationChannel(ch, "Fin du repos (" + label + ")", NotificationManager.IMPORTANCE_HIGH);
            if (sound) nc.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                    new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
            else nc.setSound(null, null);
            nc.enableVibration(vib);
            if (vib) nc.setVibrationPattern(pattern);
            nm.createNotificationChannel(nc);
        }
        Notification.Builder b = builder(ch)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle("Pause terminée, au boulot !")
                .setContentText("Ton temps de repos est écoulé.")
                .setAutoCancel(true)
                .setContentIntent(openApp())
                .setCategory(Notification.CATEGORY_REMINDER);
        if (Build.VERSION.SDK_INT < 26) {
            b.setPriority(Notification.PRIORITY_HIGH);
            if (sound) b.setDefaults(Notification.DEFAULT_SOUND);
            if (vib) b.setVibrate(pattern);
        }
        try { nm.notify(ALERT_ID, b.build()); } catch (SecurityException ignored) { }
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(fire);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
