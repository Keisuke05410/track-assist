import Foundation
import GRDB

struct ActivityRecord: Codable, FetchableRecord, MutablePersistableRecord {
    var id: Int64?
    var timestamp: Date
    var appName: String
    var appBundleId: String?
    var windowTitle: String?
    var isIdle: Bool
    var eventType: EventType

    enum EventType: String, Codable, DatabaseValueConvertible {
        case change
        case heartbeat
        case idleStart = "idle_start"
        case idleEnd = "idle_end"
    }

    static let databaseTableName = "activity_records"

    // CodingKeysでデータベースカラム名とSwiftプロパティ名をマッピング
    enum CodingKeys: String, CodingKey {
        case id
        case timestamp
        case appName = "app_name"
        case appBundleId = "app_bundle_id"
        case windowTitle = "window_title"
        case isIdle = "is_idle"
        case eventType = "event_type"
    }

    enum Columns: String, ColumnExpression {
        case id
        case timestamp
        case appName = "app_name"
        case appBundleId = "app_bundle_id"
        case windowTitle = "window_title"
        case isIdle = "is_idle"
        case eventType = "event_type"
    }

    mutating func didInsert(_ inserted: InsertionSuccess) {
        id = inserted.rowID
    }
}

// MARK: - API Response Models

struct TimelineSegment: Codable {
    let startTime: Date
    let endTime: Date
    let appName: String
    let appBundleId: String?
    let windowTitles: [String]
    let color: String
    let durationSeconds: Int
}

struct DailySummary: Codable {
    let appName: String
    let totalSeconds: Int
    let percentage: Double
    let color: String
}

struct ActivityStatus: Codable {
    let isTracking: Bool
    let isIdle: Bool
    let currentApp: String?
    let currentWindowTitle: String?
}
