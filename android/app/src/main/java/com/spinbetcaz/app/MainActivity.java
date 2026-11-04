package com.spinbetcaz.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * SpinBet: the site www.spinbetcaz.com in a full-screen window. Everything (games, accounts, updates) comes from the
 * site, so a new version of the site is in the app as soon as it is online. Links to other sites (TikTok, ads…)
 * open in the browser. The page can tell it runs in the app (user agent "SpinBetApp") and share a picture through
 * window.SpinBetApp.share(dataUrl, text).
 */
public class MainActivity extends Activity {
    static final String HOME = "https://www.spinbetcaz.com/";
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0B0F17"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setUserAgentString(s.getUserAgentString() + " SpinBetApp/1");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "SpinBetApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return openOutside(req.getUrl());
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) view.loadDataWithBaseURL(HOME, OFFLINE, "text/html", "utf-8", null);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            // window.open / target=_blank: the address is read from a throw-away view, then opened where it belongs
            @Override
            public boolean onCreateWindow(WebView view, boolean dialog, boolean user, Message msg) {
                WebView tmp = new WebView(MainActivity.this);
                tmp.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                        if (!openOutside(req.getUrl())) web.loadUrl(req.getUrl().toString());
                        v.destroy();
                        return true;
                    }
                });
                ((WebView.WebViewTransport) msg.obj).setWebView(tmp);
                msg.sendToTarget();
                return true;
            }
        });
        web.setDownloadListener((url, ua, cd, mime, len) -> {
            if (url.startsWith("http")) openOutside(Uri.parse(url), true);
        });

        // notifications (Notifs.java): first launch = remember the day (no old message shown), ask Android 13+ once
        if (Notifs.prefs(this).getLong("installed", 0) == 0) Notifs.prefs(this).edit().putLong("installed", System.currentTimeMillis()).apply();
        Notifs.channel(this);
        Notifs.schedule(this, System.currentTimeMillis());
        if (Build.VERSION.SDK_INT >= 33 && !Notifs.prefs(this).getBoolean("asked", false)) {
            Notifs.prefs(this).edit().putBoolean("asked", true).apply();
            web.postDelayed(() -> requestPermissions(new String[] { "android.permission.POST_NOTIFICATIONS" }, 7), 4000);
        }

        Uri link = getIntent() != null ? getIntent().getData() : null;
        if (state != null) web.restoreState(state);
        else web.loadUrl(link != null ? link.toString() : HOME);
    }

    // Pages of the site stay in the app; everything else opens in the browser (returns true when it left the app).
    private boolean openOutside(Uri uri) { return openOutside(uri, false); }

    private boolean openOutside(Uri uri, boolean always) {
        String host = uri.getHost() == null ? "" : uri.getHost();
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        boolean ours = scheme.startsWith("http") && (host.equals("spinbetcaz.com") || host.endsWith(".spinbetcaz.com"));
        if (ours && !always) return false;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Impossible d’ouvrir ce lien", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent.getData() != null) web.loadUrl(intent.getData().toString());
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    /** Called by the page (bigwin.js, push.js, daily.js). */
    class Bridge {
        /** Notifications of the app: "on", "off" (switched off in the site) or "denied" (refused in Android). */
        @JavascriptInterface
        public String notifStatus() {
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED)
                return Notifs.prefs(MainActivity.this).getBoolean("asked", false) && !shouldShowRequestPermissionRationale("android.permission.POST_NOTIFICATIONS") ? "denied" : "off";
            return Notifs.prefs(MainActivity.this).getBoolean("on", true) ? "on" : "off";
        }

        @JavascriptInterface
        public void notifOn() {
            Notifs.prefs(MainActivity.this).edit().putBoolean("on", true).putBoolean("asked", true).apply();
            if (Build.VERSION.SDK_INT >= 33) runOnUiThread(() -> requestPermissions(new String[] { "android.permission.POST_NOTIFICATIONS" }, 7));
            Notifs.schedule(MainActivity.this, System.currentTimeMillis());
        }

        @JavascriptInterface
        public void notifOff() { Notifs.prefs(MainActivity.this).edit().putBoolean("on", false).apply(); }

        /** The daily gift was taken at {@code last} (ms), series of {@code streak} days: sets the reminders. */
        @JavascriptInterface
        public void daily(String last, String streak) {
            try {
                Notifs.prefs(MainActivity.this).edit().putLong("dailyLast", Long.parseLong(last)).putInt("dailyStreak", Integer.parseInt(streak)).apply();
                Notifs.schedule(MainActivity.this, System.currentTimeMillis());
            } catch (NumberFormatException ignored) { /* bad values from the page */ }
        }

        /** Shares the big-win picture with TikTok, Snap, WhatsApp… */
        @JavascriptInterface
        public void share(String dataUrl, String text) {
            runOnUiThread(() -> {
                try {
                    byte[] png = Base64.decode(dataUrl.substring(dataUrl.indexOf(',') + 1), Base64.DEFAULT);
                    Bitmap bmp = BitmapFactory.decodeByteArray(png, 0, png.length);
                    String path = MediaStore.Images.Media.insertImage(getContentResolver(), bmp, "SpinBet " + System.currentTimeMillis(), text);
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("image/png");
                    send.putExtra(Intent.EXTRA_STREAM, Uri.parse(path));
                    send.putExtra(Intent.EXTRA_TEXT, text);
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(send, "Partager mon gain"));
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Partage impossible", Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    static final String OFFLINE = "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'>"
        + "<body style='margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0f17;color:#eef4fb;font-family:sans-serif;text-align:center'>"
        + "<div><div style='font-size:56px'>📶</div><h2>Pas de connexion</h2><p style='color:#93a0b3'>SpinBet a besoin d’internet pour jouer.</p>"
        + "<button onclick=\"location.href='" + HOME + "'\" style='margin-top:12px;padding:14px 26px;border:0;border-radius:12px;font-size:16px;font-weight:800;"
        + "background:linear-gradient(180deg,#a9dcff,#2f86d6);color:#06121f'>Réessayer</button></div></body>";
}
