import Foundation
import GRDB

final class DatabaseManager {
    static let shared = DatabaseManager()

    private var dbQueue: DatabaseQueue?
    private var cleanupTimer: Timer?

    private init() {}

    // MARK: - Setup

    func setup() throws {
        let fileManager = FileManager.default
        let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let appDirectory = appSupport.appendingPathComponent("TrackAssist", isDirectory: true)

        if !fileManager.fileExists(atPath: appDirectory.path) {
            try fileManager.createDirectory(at: appDirectory, withIntermediateDirectories: true)
        }

        let dbPath = appDirectory.appendingPathComponent("activities.sqlite")
        dbQueue = try DatabaseQueue(path: dbPath.path)

        try migrate()
        scheduleCleanup()
    }

    private func migrate() throws {
        guard let dbQueue = dbQueue else { return }

        var migrator = DatabaseMigrator()

        migrator.registerMigration("v1_create_activities") { db in
            try db.create(table: "activity_records") { t in
                t.autoIncrementedPrimaryKey("id")
                t.column("timestamp", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
                t.column("app_name", .text).notNull()
                t.column("app_bundle_id", .text)
                t.column("window_title", .text)
                t.column("is_idle", .boolean).notNull().defaults(to: false)
                t.column("event_type", .text).notNull()
            }

            try db.create(index: "idx_activity_timestamp", on: "activity_records", columns: ["timestamp"])
            try db.create(index: "idx_activity_app", on: "activity_records", columns: ["app_name"])
        }

        try migrator.migrate(dbQueue)
    }

    // MARK: - Write Operations

    func insertActivity(_ record: ActivityRecord) throws {
        guard let dbQueue = dbQueue else { return }
        var record = record
        try dbQueue.write { db in
            try record.insert(db)
        }
    }

    // MARK: - Read Operations

    func fetchActivities(for date: Date) throws -> [ActivityRecord] {
        guard let dbQueue = dbQueue else { return [] }

        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay)!

        return try dbQueue.read { db in
            try ActivityRecord
                .filter(ActivityRecord.Columns.timestamp >= startOfDay && ActivityRecord.Columns.timestamp < endOfDay)
                .order(ActivityRecord.Columns.timestamp)
                .fetchAll(db)
        }
    }

    func fetchTimelineSegments(for date: Date) throws -> [TimelineSegment] {
        let activities = try fetchActivities(for: date)
        guard !activities.isEmpty else { return [] }

        var segments: [TimelineSegment] = []
        var currentSegment: (start: Date, app: String, bundleId: String?, titles: Set<String>)?

        for (index, activity) in activities.enumerated() {
            if activity.isIdle { continue }

            if let segment = currentSegment {
                if segment.app == activity.appName {
                    // 同じアプリ: タイトルを追加
                    if let title = activity.windowTitle {
                        currentSegment?.titles.insert(title)
                    }
                } else {
                    // アプリ変更: セグメント確定
                    let endTime = activity.timestamp
                    let duration = Int(endTime.timeIntervalSince(segment.start))
                    if duration > 0 {
                        segments.append(TimelineSegment(
                            startTime: segment.start,
                            endTime: endTime,
                            appName: segment.app,
                            appBundleId: segment.bundleId,
                            windowTitles: Array(segment.titles).sorted(),
                            color: colorForApp(segment.app),
                            durationSeconds: duration
                        ))
                    }
                    // 新しいセグメント開始
                    var titles = Set<String>()
                    if let title = activity.windowTitle {
                        titles.insert(title)
                    }
                    currentSegment = (activity.timestamp, activity.appName, activity.appBundleId, titles)
                }
            } else {
                // 最初のセグメント
                var titles = Set<String>()
                if let title = activity.windowTitle {
                    titles.insert(title)
                }
                currentSegment = (activity.timestamp, activity.appName, activity.appBundleId, titles)
            }

            // 最後のアクティビティの場合、セグメントを閉じる
            if index == activities.count - 1, let segment = currentSegment {
                let endTime = activity.timestamp.addingTimeInterval(60) // 最後のハートビート分を追加
                let duration = Int(endTime.timeIntervalSince(segment.start))
                if duration > 0 {
                    segments.append(TimelineSegment(
                        startTime: segment.start,
                        endTime: endTime,
                        appName: segment.app,
                        appBundleId: segment.bundleId,
                        windowTitles: Array(segment.titles).sorted(),
                        color: colorForApp(segment.app),
                        durationSeconds: duration
                    ))
                }
            }
        }

        return segments
    }

    func fetchDailySummary(for date: Date) throws -> [DailySummary] {
        let segments = try fetchTimelineSegments(for: date)

        var appDurations: [String: Int] = [:]
        for segment in segments {
            appDurations[segment.appName, default: 0] += segment.durationSeconds
        }

        let totalDuration = appDurations.values.reduce(0, +)
        guard totalDuration > 0 else { return [] }

        return appDurations.map { (appName, seconds) in
            DailySummary(
                appName: appName,
                totalSeconds: seconds,
                percentage: Double(seconds) / Double(totalDuration) * 100,
                color: colorForApp(appName)
            )
        }.sorted { $0.totalSeconds > $1.totalSeconds }
    }

    // MARK: - Cleanup

    private func scheduleCleanup() {
        // 起動時にクリーンアップ実行
        try? cleanupOldRecords()

        // 毎日0時にクリーンアップ
        let calendar = Calendar.current
        var components = calendar.dateComponents([.hour, .minute], from: Date())
        components.hour = 0
        components.minute = 0

        if let nextMidnight = calendar.nextDate(after: Date(), matching: components, matchingPolicy: .nextTime) {
            cleanupTimer = Timer(fire: nextMidnight, interval: 86400, repeats: true) { [weak self] _ in
                try? self?.cleanupOldRecords()
            }
            RunLoop.main.add(cleanupTimer!, forMode: .common)
        }
    }

    func cleanupOldRecords() throws {
        guard let dbQueue = dbQueue else { return }

        let cutoffDate = Calendar.current.date(byAdding: .day, value: -7, to: Date())!

        try dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM activity_records WHERE timestamp < ?",
                arguments: [cutoffDate]
            )
        }

        print("古いレコードをクリーンアップしました（\(cutoffDate)より前）")
    }

    // MARK: - Helpers

    private func colorForApp(_ appName: String) -> String {
        // アプリ名からハッシュベースの色を生成
        let hash = appName.utf8.reduce(0) { $0 &+ Int($1) }
        let hue = Double(abs(hash) % 360)
        let saturation = 0.65
        let lightness = 0.55

        // HSL to RGB conversion
        let c = (1 - abs(2 * lightness - 1)) * saturation
        let x = c * (1 - abs((hue / 60).truncatingRemainder(dividingBy: 2) - 1))
        let m = lightness - c / 2

        var r: Double = 0, g: Double = 0, b: Double = 0

        switch hue {
        case 0..<60:
            (r, g, b) = (c, x, 0)
        case 60..<120:
            (r, g, b) = (x, c, 0)
        case 120..<180:
            (r, g, b) = (0, c, x)
        case 180..<240:
            (r, g, b) = (0, x, c)
        case 240..<300:
            (r, g, b) = (x, 0, c)
        default:
            (r, g, b) = (c, 0, x)
        }

        let red = Int((r + m) * 255)
        let green = Int((g + m) * 255)
        let blue = Int((b + m) * 255)

        return String(format: "#%02X%02X%02X", red, green, blue)
    }
}
