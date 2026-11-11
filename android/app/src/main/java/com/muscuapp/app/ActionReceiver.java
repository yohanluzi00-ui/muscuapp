package com.muscuapp.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Boutons des notifications (aussi sur la montre) : « Passer » le repos, « Terminer » le chrono.
 * L'heure de l'appui est transmise à l'appli : le temps noté est celui du moment où tu as appuyé.
 */
public class ActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String a = i == null ? null : i.getAction();
        String act = RestTimerService.ACT_SKIP.equals(a) ? "skiprest" : RestTimerService.ACT_STOP.equals(a) ? "chronostop" : null;
        if (act == null) return;
        long at = System.currentTimeMillis();
        RestTimerService.stop(c);
        MainActivity.deliverAction(c, act, at);
    }
}
