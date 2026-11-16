import UIKit
import WebKit

/// The site in a WKWebView. Pages of spinbetcaz.com stay in the app, other links open in Safari. The page talks to
/// the app through window.SpinBetApp (same functions as the Android app: share, immersive, notifications, daily)
/// and gets navigator.vibrate (iPhone vibrations).
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    static let home = URL(string: "https://www.spinbetcaz.com/")!
    static let bg = UIColor(red: 11 / 255, green: 15 / 255, blue: 23 / 255, alpha: 1)

    private var web: WKWebView!
    private var pending: URL?
    private var immersive = false

    override var prefersStatusBarHidden: Bool { immersive }
    override var prefersHomeIndicatorAutoHidden: Bool { immersive }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { immersive ? .all : [] }

    override func loadView() {
        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.websiteDataStore = .default()
        cfg.applicationNameForUserAgent = "Mobile/15E148 SpinBetApp/1 SpinBetiOS/1"
        let uc = WKUserContentController()
        uc.addUserScript(WKUserScript(source: Self.bridge(Notifs.shared.status), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        uc.add(WeakHandler(self), name: "sb")
        cfg.userContentController = uc

        web = WKWebView(frame: .zero, configuration: cfg)
        web.isOpaque = false
        web.backgroundColor = Self.bg
        web.scrollView.backgroundColor = Self.bg
        web.scrollView.contentInsetAdjustmentBehavior = .never // the page places itself with env(safe-area-inset-*)
        web.allowsBackForwardNavigationGestures = true
        web.navigationDelegate = self
        web.uiDelegate = self
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        web.load(URLRequest(url: pending ?? Self.home))
        pending = nil
        refreshNotif()
    }

    /// Opens a page of the site (notification, link); before the window exists it waits for viewDidLoad.
    func open(_ url: URL) {
        guard isOurs(url) else { UIApplication.shared.open(url); return }
        if web == nil || !isViewLoaded { pending = url; return }
        web.load(URLRequest(url: url))
    }

    func refreshNotif() {
        Notifs.shared.refresh { [weak self] st in self?.tellNotif(st) }
    }

    private func tellNotif(_ st: String) {
        guard isViewLoaded else { return }
        web.evaluateJavaScript("window.__sbNotif = '\(st)'", completionHandler: nil)
    }

    private func isOurs(_ url: URL) -> Bool {
        let host = url.host?.lowercased() ?? ""
        let scheme = url.scheme?.lowercased() ?? ""
        return scheme.hasPrefix("http") && (host == "spinbetcaz.com" || host.hasSuffix(".spinbetcaz.com"))
    }

    // MARK: navigation

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.allow); return }
        let scheme = url.scheme?.lowercased() ?? ""
        // frames (ads, videos) and the page's own blob: / data: / about: addresses load where they are
        if navigationAction.targetFrame?.isMainFrame == false || ["about", "blob", "data", "javascript"].contains(scheme) {
            decisionHandler(.allow); return
        }
        if isOurs(url) { decisionHandler(.allow); return }
        decisionHandler(.cancel)
        UIApplication.shared.open(url) // Snapchat, TikTok, other sites, mail…
    }

    // window.open / target=_blank
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if isOurs(url) { webView.load(URLRequest(url: url)) } else { UIApplication.shared.open(url) }
        }
        return nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let e = error as NSError
        if e.domain == NSURLErrorDomain && e.code == NSURLErrorCancelled { return }
        webView.loadHTMLString(Self.offline, baseURL: Self.home)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    // alert / confirm / prompt of the page
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Annuler", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: "Annuler", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
        present(a, animated: true)
    }

    // MARK: window.SpinBetApp

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let m = message.body as? [String: Any], let k = m["k"] as? String else { return }
        switch k {
        case "share":
            share(m["d"] as? String ?? "", m["t"] as? String ?? "")
        case "immersive":
            immersive = (m["on"] as? Bool) ?? false
            setNeedsStatusBarAppearanceUpdate()
            setNeedsUpdateOfHomeIndicatorAutoHidden()
            setNeedsUpdateOfScreenEdgesDeferringSystemGestures()
        case "vibe":
            let total = (m["p"] as? [Any])?.compactMap { ($0 as? NSNumber)?.doubleValue }.reduce(0, +) ?? 0
            if total > 0 { UIImpactFeedbackGenerator(style: total >= 150 ? .heavy : .medium).impactOccurred() }
        case "notifOn":
            Notifs.shared.enable { [weak self] st in
                self?.tellNotif(st)
                if st == "denied", let u = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(u) }
            }
        case "notifOff":
            Notifs.shared.disable()
            tellNotif("off")
        case "daily":
            Notifs.shared.daily(last: Double(m["l"] as? String ?? "") ?? 0, streak: Int(m["s"] as? String ?? "") ?? 0)
        default:
            break
        }
    }

    private func share(_ dataUrl: String, _ text: String) {
        var items: [Any] = []
        if let comma = dataUrl.firstIndex(of: ","), let data = Data(base64Encoded: String(dataUrl[dataUrl.index(after: comma)...]), options: .ignoreUnknownCharacters),
           let img = UIImage(data: data) {
            items.append(img)
        }
        if !text.isEmpty { items.append(text) }
        guard !items.isEmpty else { return }
        let vc = UIActivityViewController(activityItems: items, applicationActivities: nil)
        vc.popoverPresentationController?.sourceView = view
        vc.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        present(vc, animated: true)
    }

    static func bridge(_ notif: String) -> String {
        return """
        (function () {
          var post = function (m) { try { window.webkit.messageHandlers.sb.postMessage(m); } catch (e) {} };
          window.__sbNotif = '\(notif)';
          window.SpinBetApp = {
            notifStatus: function () { return window.__sbNotif; },
            notifOn: function () { post({ k: 'notifOn' }); },
            notifOff: function () { window.__sbNotif = 'off'; post({ k: 'notifOff' }); },
            immersive: function (on) { post({ k: 'immersive', on: !!on }); },
            daily: function (l, s) { post({ k: 'daily', l: String(l), s: String(s) }); },
            share: function (d, t) { post({ k: 'share', d: String(d), t: String(t || '') }); }
          };
          if (!navigator.vibrate) {
            try {
              Object.defineProperty(navigator, 'vibrate', { configurable: true, value: function (p) {
                post({ k: 'vibe', p: [].concat(p || 0).map(Number) }); return true; } });
            } catch (e) {}
          }
        })();
        """
    }

    static let offline = """
    <!doctype html><meta name=viewport content='width=device-width,initial-scale=1'>
    <body style='margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0f17;color:#eef4fb;font-family:-apple-system,sans-serif;text-align:center'>
    <div><div style='font-size:56px'>📶</div><h2>Pas de connexion</h2><p style='color:#93a0b3'>SpinBet a besoin d’internet pour jouer.</p>
    <button onclick="location.href='https://www.spinbetcaz.com/'" style='margin-top:12px;padding:14px 26px;border:0;border-radius:12px;font-size:16px;font-weight:800;background:linear-gradient(180deg,#a9dcff,#2f86d6);color:#06121f'>Réessayer</button></div></body>
    """
}

/// WKUserContentController keeps its handlers strongly: this breaks the loop with the controller.
final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(c, didReceive: message)
    }
}
