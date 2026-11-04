package com.spinbetcaz.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.TimeZone;

/**
 * Notifications of the Android app, free and without any server: the phone itself wakes up at the right times
 * (AlarmManager) and shows the same messages as the site's notifications (tools/push/send.mjs):
 *   - 13 h 35 Paris: the wheel of the day;            - 20 h 35: the evening tournament (21 h);
 *   - Saturday 11 h 35: the weekend tournament;       - the 3 flash events of the day (same draw as flashesOf);
 *   - the daily gift: "ready" 24 h after the last one taken, "your series is about to be lost" 4 h before 48 h
 *     (the page tells the app when the gift was taken: window.SpinBetApp.daily);
 *   - free messages from the owner (Actions → « Notifications » → Run workflow), read from push/annonce.json on the
 *     data branch at each wake-up.
 * The phone wakes up at most every 3 hours in the day for the free messages; nothing at night (22 h → 9 h).
 */
public final class Notifs {
    static final String CHANNEL = "spinbet";
    static final String PREFS = "notifs";
    static final String ANNOUNCE = "https://raw.githubusercontent.com/estebanlarose11-source/bling-casino/data/push/annonce.json";
    static final String SITE = "https://www.spinbetcaz.com/";
    static final TimeZone PARIS = TimeZone.getTimeZone("Europe/Paris");
    static final long MIN = 60_000L, HOUR = 3_600_000L;

    // Flash events: keep in step with FLASH / POOL / flashesOf in index.html (extras.js) and tools/push/send.mjs.
    static final int FLASH_PER = 3, FLASH_FROM = 12, FLASH_TO = 21;
    static final String[] POOL = { "fortune", "cosmic", "zeus", "huff", "candy", "anubis", "bling", "pharaon", "taco", "billets", "dragons", "labo", "chasse", "big-bad-wolf", "noel", "totemx" };
    static final String[] NAMES = { "La Fortune", "Le Cosmique", "L’Olympe", "Le Loup 2.0", "La Sweety", "L’Anubis", "La Tour Bling", "Le Totem", "La Pizza Yo-Yo", "Le Coffre-Fort", "L’Hydre", "Le Labo", "The Hunt", "Le Loup", "La Tournée du Père Noël", "Le Totem Extrême" };

    private Notifs() {}

    /** One notification to show at time {@code at}. */
    static final class Ev {
        final String key, title, body, url;
        final long at;
        Ev(String key, long at, String title, String body, String url) { this.key = key; this.at = at; this.title = title; this.body = body; this.url = url; }
    }

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    /** On unless the player switched them off (and, on Android 13+, unless the phone refuses them). */
    static boolean enabled(Context c) {
        if (!prefs(c).getBoolean("on", true)) return false;
        return Build.VERSION.SDK_INT < 33 || c.checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED;
    }

    // ---------- Paris time ----------
    static Calendar paris(long t) { Calendar c = Calendar.getInstance(PARIS); c.setTimeInMillis(t); return c; }

    static long at(Calendar day, int h, int mi) {
        Calendar c = (Calendar) day.clone();
        c.set(Calendar.HOUR_OF_DAY, h); c.set(Calendar.MINUTE, mi); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    // ---------- flash events: the same random draw as the site ----------
    static final class Rnd {
        int h = (int) 2166136261L;
        Rnd(String s) { for (int i = 0; i < s.length(); i++) h = (h ^ s.charAt(i)) * 16777619; }
        double next() { h = (h ^ (h >>> 15)) * (int) 2246822507L; return (h & 0xffffffffL) / 4294967296.0; }
    }

    /** [hour, minute, game index] × 3 for a Paris date. */
    static int[][] flashes(int y, int m, int d) {
        Rnd rnd = new Rnd("flash-" + y + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d);
        List<Integer> hours = new ArrayList<>();
        while (hours.size() < FLASH_PER) {
            int h = FLASH_FROM + (int) Math.floor(rnd.next() * (FLASH_TO - FLASH_FROM + 1));
            if (!hours.contains(h)) hours.add(h);
        }
        java.util.Collections.sort(hours);
        int[][] out = new int[FLASH_PER][];
        for (int i = 0; i < FLASH_PER; i++) {
            int half = rnd.next() < 0.5 ? 30 : 0;
            int g = (int) Math.floor(rnd.next() * POOL.length);
            out[i] = new int[] { hours.get(i), half, g };
        }
        return out;
    }

    // ---------- what is planned for a Paris day ----------
    static List<Ev> plan(Context c, Calendar day) {
        List<Ev> l = new ArrayList<>();
        int y = day.get(Calendar.YEAR), m = day.get(Calendar.MONTH) + 1, d = day.get(Calendar.DAY_OF_MONTH);
        String k = y + "-" + m + "-" + d;
        l.add(new Ev("roue-" + k, at(day, 13, 35), "🎡 Ta roue du jour est prête", "Un tour gratuit : des KE, de l’XP ou un bonus. Ton cadeau du jour t’attend aussi !", SITE + "#roue"));
        l.add(new Ev("soir-" + k, at(day, 20, 35), "🏁 Tournoi du soir à 21 h", "10 000 KE au n°1. Ton plus gros gain en × la mise compte !", SITE + "#tournois"));
        if (day.get(Calendar.DAY_OF_WEEK) == Calendar.SATURDAY)
            l.add(new Ev("we-" + k, at(day, 11, 35), "🏆 Le tournoi du week-end est lancé", "50 000 KE au n°1, jusqu’à dimanche minuit. Viens marquer ton meilleur gain !", SITE + "#tournois"));
        for (int[] f : flashes(y, m, d))
            l.add(new Ev("flash-" + k + "-" + f[0] + "-" + f[1], at(day, f[0], f[1]), "⚡ Événement flash : gains ×2 !",
                "Pendant 30 minutes sur " + NAMES[f[2]] + " : tous tes gains sont doublés. Vite !", SITE + "#game-" + POOL[f[2]]));
        return l;
    }

    /** Daily gift reminders, from the last gift taken (told by the page). */
    static List<Ev> dailyPlan(Context c) {
        List<Ev> l = new ArrayList<>();
        SharedPreferences p = prefs(c);
        long last = p.getLong("dailyLast", 0);
        int streak = p.getInt("dailyStreak", 0);
        if (last <= 0) return l;
        long ready = dayTime(last + 24 * HOUR, true), lose = last + 48 * HOUR;
        if (ready < lose - HOUR)
            l.add(new Ev("dready-" + last, ready, "🎁 Ton cadeau du jour est prêt", streak > 0 ? "Jour " + (streak + 1) + " de ta série : viens le prendre sur l’accueil !" : "Viens le prendre sur l’accueil !", SITE));
        long warn = dayTime(lose - 4 * HOUR, false);
        if (streak >= 2 && warn > ready && warn < lose)
            l.add(new Ev("dlose-" + last, warn, "🔥 Ta série de " + streak + " jours va se perdre", "Prends ton cadeau du jour avant " + hhmm(lose) + " pour la garder !", SITE));
        return l;
    }

    /** Moves a time out of the night (22 h → 9 h): later to 9 h (later = true) or earlier to 21 h 30. */
    static long dayTime(long t, boolean later) {
        Calendar c = paris(t);
        int h = c.get(Calendar.HOUR_OF_DAY);
        if (h >= 9 && h < 22) return t;
        if (later) {
            if (h >= 22) c.add(Calendar.DAY_OF_MONTH, 1);
            return at(c, 9, 0);
        }
        if (h < 9) c.add(Calendar.DAY_OF_MONTH, -1);
        return at(c, 21, 30);
    }

    static String hhmm(long t) {
        Calendar c = paris(t);
        int h = c.get(Calendar.HOUR_OF_DAY), mi = c.get(Calendar.MINUTE);
        return h + " h " + (mi < 10 ? "0" : "") + mi;
    }

    // ---------- wake-up ----------
    /** Shows what is due now, then sets the next wake-up. Runs on a background thread (network). */
    static void tick(Context c) {
        long now = System.currentTimeMillis();
        SharedPreferences p = prefs(c);
        if (enabled(c)) {
            List<Ev> due = new ArrayList<>();
            Calendar today = paris(now);
            due.addAll(plan(c, today));
            due.addAll(dailyPlan(c));
            for (Ev e : due) {
                // shown once, and only if it is still fresh (the phone may wake up late)
                if (e.at <= now && now - e.at < 40 * MIN && !p.getBoolean("shown-" + e.key, false)) {
                    show(c, e.key, e.title, e.body, e.url);
                    p.edit().putBoolean("shown-" + e.key, true).apply();
                }
            }
            announce(c);
        }
        schedule(c, now);
    }

    /** A free message from the owner: { id, title, body, url, t } in push/annonce.json (data branch). */
    static void announce(Context c) {
        int h = paris(System.currentTimeMillis()).get(Calendar.HOUR_OF_DAY);
        if (h < 9 || h >= 22) return;
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(ANNOUNCE + "?t=" + (System.currentTimeMillis() / 600_000L)).openConnection();
            con.setConnectTimeout(8000); con.setReadTimeout(8000);
            if (con.getResponseCode() != 200) return;
            InputStream in = con.getInputStream();
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] b = new byte[4096];
            for (int n; (n = in.read(b)) > 0; ) buf.write(b, 0, n);
            JSONObject j = new JSONObject(buf.toString("UTF-8"));
            String id = j.optString("id", "");
            long t = j.optLong("t", 0);
            SharedPreferences p = prefs(c);
            if (id.isEmpty() || id.equals(p.getString("annonce", "")) || System.currentTimeMillis() - t > 24 * HOUR) return;
            // first wake-up after installing: remember the current message without showing an old one
            if (p.getLong("installed", 0) > t) { p.edit().putString("annonce", id).apply(); return; }
            show(c, "annonce", j.optString("title", "SpinBet Casino"), j.optString("body", ""), j.optString("url", SITE));
            p.edit().putString("annonce", id).apply();
        } catch (Exception ignored) {
            // no network: next time
        } finally {
            if (con != null) con.disconnect();
        }
    }

    /** Next wake-up: the next planned notification, but at least every 3 hours in the day (free messages). */
    static void schedule(Context c, long now) {
        long next = Long.MAX_VALUE;
        List<Ev> l = new ArrayList<>();
        Calendar day = paris(now);
        l.addAll(plan(c, day));
        Calendar tomorrow = (Calendar) day.clone(); tomorrow.add(Calendar.DAY_OF_MONTH, 1);
        l.addAll(plan(c, tomorrow));
        l.addAll(dailyPlan(c));
        for (Ev e : l) if (e.at > now + MIN && e.at < next) next = e.at;
        next = Math.min(next, dayTime(now + 3 * HOUR, true));
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = PendingIntent.getBroadcast(c, 1, new Intent(c, Receiver.class).setAction("com.spinbetcaz.app.TICK"),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi); // inexact (a few minutes), no special permission
    }

    static void channel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        NotificationChannel ch = new NotificationChannel(CHANNEL, "SpinBet", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("Roue du jour, cadeau du jour, tournois et événements flash");
        nm.createNotificationChannel(ch);
    }

    static void show(Context c, String tag, String title, String body, String url) {
        channel(c);
        Intent open = new Intent(c, MainActivity.class).setAction(Intent.ACTION_VIEW).setData(Uri.parse(url))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, tag.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_notif).setContentTitle(title).setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body))
            .setColor(0xFF7CC8FF).setAutoCancel(true).setContentIntent(pi);
        try {
            ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(tag.startsWith("flash") ? "flash" : tag, 1, b.build());
        } catch (SecurityException ignored) {
            // permission refused on Android 13+
        }
    }

    /** Wake-ups (alarm) and phone restarts (alarms are lost when the phone restarts). */
    public static class Receiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context c, Intent i) {
            final PendingResult r = goAsync();
            final Context app = c.getApplicationContext();
            new Thread(() -> {
                try { tick(app); } finally { r.finish(); }
            }).start();
        }
    }
}
