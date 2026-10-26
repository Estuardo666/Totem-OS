import Foundation
import UserNotifications
import WebKit

private struct LocalReminderResponse: Decodable {
    let data: Snapshot
    struct Snapshot: Decodable {
        let userId: String
        let events: [Event]
        let cursor: String
        let dailySummary: String
        let notices: [Notice]
    }
    struct Notice: Decodable {
        let id: String
        let title: String
        let body: String
    }
    struct Event: Decodable {
        let id: String
        let title: String
        let startTime: String
    }
}

/// Only reconciles after a successful authenticated snapshot. Offline launches
/// leave the system's pending requests intact.
@MainActor
final class LocalReminderScheduler {
    static let shared = LocalReminderScheduler()
    private let center = UNUserNotificationCenter.current()
    private let prefix = "totem-local-event-"
    private let historyKey = "totem.local-reminders.history"
    private let cursorKey = "totem.local-reminders.cursor"
    private let seenKey = "totem.local-reminders.seen"
    private let ownerKey = "totem.local-reminders.owner"
    private let activityPrefix = "totem-local-activity-"
    private var generation = 0
    private var isSyncing = false
    private var cancellationTask: Task<Void, Never>?

    func synchronize(using webView: WKWebView) async {
        guard !isSyncing else { return }
        isSyncing = true
        defer { isSyncing = false }
        let currentGeneration = generation
        await cancellationTask?.value
        guard currentGeneration == generation else { return }
        do {
            var endpoint = URLComponents()
            endpoint.path = "api/v1/local-reminders"
            if let cursor = UserDefaults.standard.string(forKey: cursorKey) {
                endpoint.queryItems = [URLQueryItem(name: "since", value: cursor)]
            }
            let (data, response) = try await PushRegistrationService().request(
                path: endpoint.string!, method: "GET", body: nil, using: webView
            )
            guard currentGeneration == generation else { return }
            if response.statusCode == 401 || response.statusCode == 403 { cancelAll(); return }
            guard response.statusCode == 200 else { return }
            let snapshot = try JSONDecoder().decode(LocalReminderResponse.self, from: data).data
            if let owner = UserDefaults.standard.string(forKey: ownerKey), owner != snapshot.userId {
                cancelAll()
                UserDefaults.standard.set(snapshot.userId, forKey: ownerKey)
                return
            }
            UserDefaults.standard.set(snapshot.userId, forKey: ownerKey)
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            guard granted, currentGeneration == generation else { return }
            let pending = await center.pendingNotificationRequests()
            guard currentGeneration == generation else { return }
            var history = UserDefaults.standard.dictionary(forKey: historyKey) as? [String: String] ?? [:]
            var desired = Set<String>()
            let now = Date()
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let fallback = ISO8601DateFormatter()
            // Reserve space for other local features in the system queue.
            let capacity = max(0, 64 - pending.filter { !$0.identifier.hasPrefix(prefix) && !$0.identifier.hasPrefix(activityPrefix) }.count)
            // One daily summary and up to five activity categories share the queue.
            for event in snapshot.events.prefix(min(54, max(0, capacity - 6))) {
                guard let start = formatter.date(from: event.startTime) ?? fallback.date(from: event.startTime),
                      start > now else { continue }
                let identifier = prefix + snapshot.userId + "-" + event.id
                desired.insert(identifier)
                let fingerprint = event.startTime + "|" + event.title
                // A delivered reminder must not be recreated on every refresh.
                if history[identifier] == fingerprint { continue }
                let fireDate = max(start.addingTimeInterval(-3600), now.addingTimeInterval(5))
                var calendar = Calendar(identifier: .gregorian)
                calendar.timeZone = TimeZone(secondsFromGMT: 0)!
                var components = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: fireDate)
                components.timeZone = calendar.timeZone
                let content = UNMutableNotificationContent()
                content.title = "Próximo rodaje · Totem OS"
                content.body = event.title
                content.sound = .default
                content.userInfo = ["eventId": event.id]
                let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
                try await center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger))
                guard currentGeneration == generation else {
                    center.removePendingNotificationRequests(withIdentifiers: [identifier])
                    return
                }
                history[identifier] = fingerprint
            }
            let dailyID = prefix + snapshot.userId + "-daily-summary"
            if capacity > 0 {
                desired.insert(dailyID)
                let content = UNMutableNotificationContent()
                content.title = "Resumen diario de tareas · Totem OS"
                let stamp = DateFormatter()
                stamp.locale = Locale(identifier: "es_EC")
                stamp.timeZone = TimeZone(identifier: "America/Guayaquil")
                stamp.dateFormat = "d MMM, HH:mm"
                content.body = snapshot.dailySummary + "\nÚltima sincronización: " + stamp.string(from: now)
                content.sound = .default
                var components = DateComponents()
                components.timeZone = TimeZone(identifier: "America/Guayaquil")
                components.hour = 8
                components.minute = 0
                try await center.add(UNNotificationRequest(
                    identifier: dailyID, content: content,
                    trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
                ))
                guard currentGeneration == generation else {
                    center.removePendingNotificationRequests(withIdentifiers: [dailyID]); return
                }
            }
            var seen = UserDefaults.standard.dictionary(forKey: seenKey) as? [String: Double] ?? [:]
            seen = seen.filter { $0.value > now.addingTimeInterval(-7 * 86400).timeIntervalSince1970 }
            let unseen = snapshot.notices.filter { seen[snapshot.userId + ":" + $0.id] == nil }
            let groups = Dictionary(grouping: unseen, by: \.title)
            for title in groups.keys.sorted().prefix(min(5, max(0, capacity - 1))) {
                guard let notices = groups[title] else { continue }
                let identifier = activityPrefix + snapshot.userId + "-" + title
                let content = UNMutableNotificationContent()
                content.title = title + " · Totem OS"
                content.body = notices.prefix(3).map(\.body).joined(separator: "\n")
                    + (notices.count > 3 ? "\nY \(notices.count - 3) más." : "")
                content.sound = .default
                try await center.add(UNNotificationRequest(
                    identifier: identifier, content: content,
                    trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
                ))
                guard currentGeneration == generation else {
                    center.removePendingNotificationRequests(withIdentifiers: [identifier]); return
                }
                for notice in notices { seen[snapshot.userId + ":" + notice.id] = now.timeIntervalSince1970 }
            }
            UserDefaults.standard.set(seen, forKey: seenKey)
            // Do not advance past activity that could not fit in the queue.
            if unseen.allSatisfy({ seen[snapshot.userId + ":" + $0.id] != nil }) {
                UserDefaults.standard.set(snapshot.cursor, forKey: cursorKey)
            }
            let obsolete = pending.filter { $0.identifier.hasPrefix(prefix) && !desired.contains($0.identifier) }.map(\.identifier)
            center.removePendingNotificationRequests(withIdentifiers: obsolete)
            let delivered = await center.deliveredNotifications()
            guard currentGeneration == generation else { return }
            center.removeDeliveredNotifications(withIdentifiers: delivered.map { $0.request.identifier }.filter {
                $0.hasPrefix(prefix) && !desired.contains($0)
            })
            history = history.filter { desired.contains($0.key) }
            UserDefaults.standard.set(history, forKey: historyKey)
        } catch {
            #if DEBUG
            print("Local reminder synchronization failed: \(error.localizedDescription)")
            #endif
        }
    }

    func cancelAll() {
        generation += 1
        UserDefaults.standard.removeObject(forKey: historyKey)
        UserDefaults.standard.removeObject(forKey: cursorKey)
        UserDefaults.standard.removeObject(forKey: seenKey)
        UserDefaults.standard.removeObject(forKey: ownerKey)
        let previousCancellation = cancellationTask
        cancellationTask = Task {
            await previousCancellation?.value
            let pending = await center.pendingNotificationRequests()
            center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix(prefix) || $0.hasPrefix(activityPrefix) })
            let delivered = await center.deliveredNotifications()
            center.removeDeliveredNotifications(withIdentifiers: delivered.map { $0.request.identifier }.filter { $0.hasPrefix(prefix) || $0.hasPrefix(activityPrefix) })
        }
    }
}
