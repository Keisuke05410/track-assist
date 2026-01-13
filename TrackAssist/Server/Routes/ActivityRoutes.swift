import Foundation
import FlyingFox

enum ActivityRoutes {
    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    // MARK: - GET /api/activities?date=YYYY-MM-DD

    static func getActivities(request: HTTPRequest) async -> HTTPResponse {
        let date = parseDate(from: request) ?? Date()

        do {
            let activities = try DatabaseManager.shared.fetchActivities(for: date)
            let json = try encoder.encode(activities)
            return jsonResponse(json)
        } catch {
            return errorResponse("アクティビティの取得に失敗しました: \(error.localizedDescription)")
        }
    }

    // MARK: - GET /api/timeline?date=YYYY-MM-DD

    static func getTimeline(request: HTTPRequest) async -> HTTPResponse {
        let date = parseDate(from: request) ?? Date()

        do {
            let segments = try DatabaseManager.shared.fetchTimelineSegments(for: date)
            let response = TimelineResponse(
                date: dateFormatter.string(from: date),
                segments: segments
            )
            let json = try encoder.encode(response)
            return jsonResponse(json)
        } catch {
            return errorResponse("タイムラインの取得に失敗しました: \(error.localizedDescription)")
        }
    }

    // MARK: - GET /api/summary?date=YYYY-MM-DD

    static func getSummary(request: HTTPRequest) async -> HTTPResponse {
        let date = parseDate(from: request) ?? Date()

        do {
            let summary = try DatabaseManager.shared.fetchDailySummary(for: date)
            let totalSeconds = summary.reduce(0) { $0 + $1.totalSeconds }
            let response = SummaryResponse(
                date: dateFormatter.string(from: date),
                totalSeconds: totalSeconds,
                apps: summary
            )
            let json = try encoder.encode(response)
            return jsonResponse(json)
        } catch {
            return errorResponse("サマリーの取得に失敗しました: \(error.localizedDescription)")
        }
    }

    // MARK: - GET /api/status

    @MainActor
    static func getStatus() async -> HTTPResponse {
        let appState = AppState.shared
        let status = ActivityStatus(
            isTracking: appState.isTracking,
            isIdle: appState.isIdle,
            currentApp: appState.currentApp.isEmpty ? nil : appState.currentApp,
            currentWindowTitle: appState.currentWindowTitle.isEmpty ? nil : appState.currentWindowTitle
        )

        do {
            let json = try encoder.encode(status)
            return jsonResponse(json)
        } catch {
            return errorResponse("ステータスの取得に失敗しました")
        }
    }

    // MARK: - Helpers

    private static func parseDate(from request: HTTPRequest) -> Date? {
        let query = request.query
        guard let dateString = query.first(where: { $0.name == "date" })?.value else {
            return nil
        }
        return dateFormatter.date(from: dateString)
    }

    private static func jsonResponse(_ data: Data) -> HTTPResponse {
        HTTPResponse(
            statusCode: .ok,
            headers: [
                .contentType: "application/json",
                HTTPHeader("Access-Control-Allow-Origin"): "*"
            ],
            body: data
        )
    }

    private static func errorResponse(_ message: String) -> HTTPResponse {
        let error = ErrorResponse(error: message)
        let data = try? encoder.encode(error)
        return HTTPResponse(
            statusCode: .internalServerError,
            headers: [.contentType: "application/json"],
            body: data ?? Data()
        )
    }
}

// MARK: - Response Types

struct TimelineResponse: Codable {
    let date: String
    let segments: [TimelineSegment]
}

struct SummaryResponse: Codable {
    let date: String
    let totalSeconds: Int
    let apps: [DailySummary]
}

struct ErrorResponse: Codable {
    let error: String
}
