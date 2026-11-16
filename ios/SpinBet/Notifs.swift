import Foundation
import UserNotifications

/// Free local notifications (no server), the same as the Android app (Notifs.java) and the site (send.mjs), Paris
/// time: wheel of the day 13 h 35, evening tournament 20 h 35, weekend tournament Saturday 11 h 35, and the daily
/// gift (ready 24 h after the last one, "your series is about to be lost" 4 h before 48 h; never at night).
final class Notifs {
    static let shared = Notifs()
    private let ud = UserDefaults.standard
    private let center = UNUserNotificationCenter.current()
    private let site = "https://www.spinbetcaz.com/"
    private let paris: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Europe/Paris") ?? .current
        return c
    }()

    /// "on", "off" or "denied", as the page expects it (last known value, refreshed by refresh()).
    var status: String { ud.string(forKey: "sb_notif") ?? "off" }

    func refresh(_ done: @escaping (String) -> Void) {
        center.getNotificationSettings { s in
            let st: String
            switch s.authorizationStatus {
            case .denied: st = "denied"
            case .authorized, .provisional, .ephemeral: st = self.ud.bool(forKey: "sb_notif_off") ? "off" : "on"
            default: st = "off"
            }
            self.ud.set(st, forKey: "sb_notif")
            if st == "on" { self.schedule() } else { self.center.removeAllPendingNotificationRequests() }
            DispatchQueue.main.async { done(st) }
        }
    }

    func enable(_ done: @escaping (String) -> Void) {
        ud.set(false, forKey: "sb_notif_off")
        center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in self.refresh(done) }
    }

    func disable() {
        ud.set(true, forKey: "sb_notif_off")
        ud.set("off", forKey: "sb_notif")
        center.removeAllPendingNotificationRequests()
    }

    func daily(last: Double, streak: Int) {
        ud.set(last, forKey: "sb_dlast")
        ud.set(streak, forKey: "sb_dstreak")
        refresh { _ in }
    }

    private func add(_ id: String, _ trigger: UNNotificationTrigger, _ title: String, _ body: String, _ url: String) {
        let c = UNMutableNotificationContent()
        c.title = title
        c.body = body
        c.sound = .default
        c.userInfo = ["url": url]
        center.add(UNNotificationRequest(identifier: id, content: c, trigger: trigger))
    }

    private func every(_ id: String, _ h: Int, _ m: Int, weekday: Int? = nil, _ title: String, _ body: String, _ url: String) {
        var dc = DateComponents()
        dc.calendar = paris
        dc.timeZone = paris.timeZone
        dc.hour = h
        dc.minute = m
        if let w = weekday { dc.weekday = w }
        add(id, UNCalendarNotificationTrigger(dateMatching: dc, repeats: true), title, body, url)
    }

    private func once(_ id: String, _ date: Date, _ title: String, _ body: String) {
        let dc = paris.dateComponents(in: paris.timeZone, from: date)
        var d = DateComponents()
        d.calendar = paris
        d.timeZone = paris.timeZone
        d.year = dc.year
        d.month = dc.month
        d.day = dc.day
        d.hour = dc.hour
        d.minute = dc.minute
        add(id, UNCalendarNotificationTrigger(dateMatching: d, repeats: false), title, body, site)
    }

    /// A time out of the night (22 h → 9 h): later to 9 h, or earlier to 21 h 30.
    private func dayTime(_ t: Date, later: Bool) -> Date {
        let h = paris.component(.hour, from: t)
        if h >= 9 && h < 22 { return t }
        var day = paris.startOfDay(for: t)
        if later {
            if h >= 22 { day = paris.date(byAdding: .day, value: 1, to: day) ?? day }
            return paris.date(bySettingHour: 9, minute: 0, second: 0, of: day) ?? t
        }
        if h < 9 { day = paris.date(byAdding: .day, value: -1, to: day) ?? day }
        return paris.date(bySettingHour: 21, minute: 30, second: 0, of: day) ?? t
    }

    private func schedule() {
        center.removeAllPendingNotificationRequests()
        every("roue", 13, 35, "🎡 Ta roue du jour est prête", "Un tour gratuit : des KE, de l’XP ou un bonus. Ton cadeau du jour t’attend aussi !", site + "#roue")
        every("soir", 20, 35, "🏁 Tournoi du soir à 21 h", "10 000 KE au n°1. Ton plus gros gain en × la mise compte !", site + "#tournois")
        every("we", 11, 35, weekday: 7, "🏆 Le tournoi du week-end est lancé", "50 000 KE au n°1, jusqu’à dimanche minuit. Viens marquer ton meilleur gain !", site + "#tournois")

        let last = ud.double(forKey: "sb_dlast"), streak = ud.integer(forKey: "sb_dstreak")
        guard last > 0 else { return }
        let base = Date(timeIntervalSince1970: last / 1000), now = Date()
        let ready = dayTime(base.addingTimeInterval(24 * 3600), later: true), lose = base.addingTimeInterval(48 * 3600)
        if ready < lose.addingTimeInterval(-3600) && ready > now {
            once("dready", ready, "🎁 Ton cadeau du jour est prêt", streak > 0 ? "Jour \(streak + 1) de ta série : viens le prendre sur l’accueil !" : "Viens le prendre sur l’accueil !")
        }
        let warn = dayTime(lose.addingTimeInterval(-4 * 3600), later: false)
        if streak >= 2 && warn > ready && warn < lose && warn > now {
            let h = paris.component(.hour, from: lose), mi = paris.component(.minute, from: lose)
            once("dlose", warn, "🔥 Ta série de \(streak) jours va se perdre", "Prends ton cadeau du jour avant \(h) h \(String(format: "%02d", mi)) pour la garder !")
        }
    }
}
