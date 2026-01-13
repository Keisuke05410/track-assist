import Foundation
import FlyingFox

actor WebServer {
    private var server: HTTPServer?
    private let port: UInt16 = 8080

    func start() async throws {
        server = HTTPServer(address: .loopback(port: port))

        guard let server = server else { return }

        // 静的ファイルのルート
        await server.appendRoute("GET /") { [self] _ in
            await self.serveStaticFile(named: "index.html", contentType: "text/html; charset=utf-8")
        }

        await server.appendRoute("GET /styles.css") { [self] _ in
            await self.serveStaticFile(named: "styles.css", contentType: "text/css; charset=utf-8")
        }

        await server.appendRoute("GET /app.js") { [self] _ in
            await self.serveStaticFile(named: "app.js", contentType: "application/javascript; charset=utf-8")
        }

        // APIルート
        await server.appendRoute("GET /api/activities") { request in
            await ActivityRoutes.getActivities(request: request)
        }

        await server.appendRoute("GET /api/timeline") { request in
            await ActivityRoutes.getTimeline(request: request)
        }

        await server.appendRoute("GET /api/summary") { request in
            await ActivityRoutes.getSummary(request: request)
        }

        await server.appendRoute("GET /api/status") { _ in
            await ActivityRoutes.getStatus()
        }

        print("Webサーバーを開始しました: http://localhost:\(port)")
        try await server.run()
    }

    func stop() async {
        await server?.stop()
        print("Webサーバーを停止しました")
    }

    // MARK: - Helpers

    private func serveStaticFile(named filename: String, contentType: String) -> HTTPResponse {
        // SPMのBundle.moduleからリソースを取得
        if let url = Bundle.module.url(forResource: filename, withExtension: nil, subdirectory: "Web"),
           let data = try? Data(contentsOf: url) {
            return HTTPResponse(
                statusCode: .ok,
                headers: [.contentType: contentType],
                body: data
            )
        }

        // フォールバック: Webディレクトリ直下を探す
        if let url = Bundle.module.url(forResource: "Web/\(filename)", withExtension: nil),
           let data = try? Data(contentsOf: url) {
            return HTTPResponse(
                statusCode: .ok,
                headers: [.contentType: contentType],
                body: data
            )
        }

        // デバッグ用: 利用可能なリソースパスを出力
        print("リソースが見つかりません: \(filename)")
        print("Bundle.module path: \(Bundle.module.bundlePath)")

        return HTTPResponse(statusCode: .notFound, body: "File not found: \(filename)".data(using: .utf8)!)
    }
}
