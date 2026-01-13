import AppKit
import Foundation

@MainActor
final class ActivityTracker {
    private var currentApp: String?
    private var currentBundleId: String?
    private var currentWindowTitle: String?
    private var heartbeatTimer: Timer?
    private var idleCheckTimer: Timer?
    private var isIdle: Bool = false

    private let idleDetector = IdleDetector()
    private let appState = AppState.shared

    // MARK: - Public Methods

    func startTracking() {
        // アプリ切り替え通知を監視
        NSWorkspace.shared.notificationCenter.addObserver(
            self,
            selector: #selector(activeAppChanged),
            name: NSWorkspace.didActivateApplicationNotification,
            object: nil
        )

        // ウィンドウタイトル変更を検出するためのタイマー（3秒ごと）
        Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.checkWindowTitleChange()
            }
        }

        // 60秒ごとのハートビート
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 60.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.recordHeartbeat()
            }
        }

        // 10秒ごとのアイドルチェック
        idleCheckTimer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.checkIdleState()
            }
        }

        // 初回記録
        recordInitialState()

        print("アクティビティトラッキングを開始しました")
    }

    func stopTracking() {
        NSWorkspace.shared.notificationCenter.removeObserver(self)
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        idleCheckTimer?.invalidate()
        idleCheckTimer = nil

        print("アクティビティトラッキングを停止しました")
    }

    // MARK: - Private Methods

    private func recordInitialState() {
        guard let appInfo = AccessibilityHelper.getFrontmostAppInfo() else { return }

        currentApp = appInfo.name
        currentBundleId = appInfo.bundleId
        currentWindowTitle = AccessibilityHelper.getFrontmostWindowTitle()

        updateAppState()
        recordActivity(eventType: .change)
    }

    @objc private func activeAppChanged(_ notification: Notification) {
        guard let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication else {
            return
        }

        let appName = app.localizedName ?? "Unknown"
        let bundleId = app.bundleIdentifier
        let windowTitle = AccessibilityHelper.getWindowTitle(for: app.processIdentifier)

        // アプリが変わった場合のみ記録
        if appName != currentApp {
            currentApp = appName
            currentBundleId = bundleId
            currentWindowTitle = windowTitle

            // アイドル解除チェック
            if isIdle {
                isIdle = false
                recordActivity(eventType: .idleEnd)
            }

            updateAppState()
            recordActivity(eventType: .change)
        }
    }

    private func checkWindowTitleChange() {
        guard let appInfo = AccessibilityHelper.getFrontmostAppInfo() else { return }
        let windowTitle = AccessibilityHelper.getWindowTitle(for: appInfo.pid)

        // ウィンドウタイトルが変わった場合
        if windowTitle != currentWindowTitle && appInfo.name == currentApp {
            currentWindowTitle = windowTitle
            updateAppState()
            recordActivity(eventType: .change)
        }
    }

    private func checkIdleState() {
        let nowIdle = idleDetector.isUserIdle

        if nowIdle && !isIdle {
            // アイドル開始
            isIdle = true
            appState.isIdle = true
            recordActivity(eventType: .idleStart)
            print("アイドル状態を検出しました")
        } else if !nowIdle && isIdle {
            // アイドル解除
            isIdle = false
            appState.isIdle = false
            recordActivity(eventType: .idleEnd)
            print("アイドル状態が解除されました")
        }
    }

    private func recordHeartbeat() {
        // アイドル中はハートビートを記録しない
        guard !isIdle else { return }
        recordActivity(eventType: .heartbeat)
    }

    private func recordActivity(eventType: ActivityRecord.EventType) {
        guard let appName = currentApp else { return }

        let record = ActivityRecord(
            id: nil,
            timestamp: Date(),
            appName: appName,
            appBundleId: currentBundleId,
            windowTitle: currentWindowTitle,
            isIdle: isIdle,
            eventType: eventType
        )

        do {
            try DatabaseManager.shared.insertActivity(record)
        } catch {
            print("アクティビティ記録エラー: \(error)")
        }
    }

    private func updateAppState() {
        appState.currentApp = currentApp ?? ""
        appState.currentWindowTitle = currentWindowTitle ?? ""
    }
}
