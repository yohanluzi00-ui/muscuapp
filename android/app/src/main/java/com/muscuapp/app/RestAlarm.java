package com.muscuapp.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;

/**
 * Alertes quand l'appli n'est plus à l'écran (écran verrouillé, autre appli) : fin du repos (REST)
 * et objectif du chrono de gainage atteint (CHRONO). Une alarme système déclenche une notification
 * avec le son et/ou la vibration choisis dans l'appli.
 */
public class RestAlarm extends BroadcastReceiver {
    static final int REST = 1;
    static final int CHRONO = 2;

    private static PendingIntent pending(Context c, int id, String mode) {
        Intent i = new Intent(c, RestAlarm.class);
        i.putExtra("mode", mode == null ? "vibration" : mode);
        i.putExtra("id", id);
        return PendingIntent.getBroadcast(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void schedule(Context c, int id, long at, String mode) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent p = pending(c, id, mode);
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, p);
    }

    static void cancel(Context c, int id) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pending(c, id, null));
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(id);
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        String mode = intent.getStringExtra("mode");
        int id = intent.getIntExtra("id", REST);
        boolean chrono = id == CHRONO;
        if (mode == null) mode = "vibration";
        boolean sound = mode.equals("son") || mode.equals("les deux");
        boolean vib = mode.equals("vibration") || mode.equals("les deux");
        String ch = sound && vib ? "repos_deux" : sound ? "repos_son" : vib ? "repos_vib" : "repos_silence";
        long[] pattern = new long[]{0, 350, 150, 350};

        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(ch) == null) {
            String label = sound && vib ? "son et vibration" : sound ? "son" : vib ? "vibration" : "silencieuse";
            NotificationChannel nc = new NotificationChannel(ch, "Fin du repos et du gainage (" + label + ")", NotificationManager.IMPORTANCE_HIGH);
            if (sound) {
                nc.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                        new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
            } else nc.setSound(null, null);
            nc.enableVibration(vib);
            if (vib) nc.setVibrationPattern(pattern);
            nm.createNotificationChannel(nc);
        }

        Intent open = new Intent(c, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent op = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, ch) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(chrono ? "Objectif de gainage atteint !" : "Pause terminée, au boulot !")
                .setContentText(chrono ? "Tu peux arrêter le chrono." : "Ton temps de repos est écoulé.")
                .setAutoCancel(true)
                .setContentIntent(op)
                .setCategory(Notification.CATEGORY_ALARM);
        if (Build.VERSION.SDK_INT < 26) {
            b.setPriority(Notification.PRIORITY_HIGH);
            int def = 0;
            if (sound) def |= Notification.DEFAULT_SOUND;
            if (vib) b.setVibrate(pattern);
            b.setDefaults(def);
        }
        try {
            nm.notify(id, b.build());
        } catch (SecurityException ignored) {
            // notifications refusées par l'utilisateur
        }
    }
}
