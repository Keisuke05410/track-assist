import AppKit
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem?
    private var popover: NSPopover?
    private var activityTracker: ActivityTracker?
    private var webServer: WebServer?
    private let appState = AppState.shared

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupStatusItem()
        setupPopover()
        checkAccessibilityPermission()
        startServices()
    }

    func applicationWillTerminate(_ notification: Notification) {
        activityTracker?.stopTracking()
        if let webServer = webServer {
            Task {
                await webServer.stop()
            }
        }
    }

    // MARK: - Setup

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        if let button = statusItem?.button {
            button.image = NSImage(systemSymbolName: "clock.fill", accessibilityDescription: "TrackAssist")
            button.action = #selector(togglePopover)
            button.target = self
        }
    }

    private func setupPopover() {
        popover = NSPopover()
        popover?.contentSize = NSSize(width: 280, height: 320)
        popover?.behavior = .transient
        popover?.contentViewController = NSHostingController(rootView: MenuBarView())
    }

    private func checkAccessibilityPermission() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        let trusted = AXIsProcessTrustedWithOptions(options)

        if !trusted {
            appState.accessibilityGranted = false
            print("アクセシビリティ権限が必要です。システム環境設定で許可してください。")
        } else {
            appState.accessibilityGranted = true
        }
    }

    private func startServices() {
        // データベース初期化
        do {
            try DatabaseManager.shared.setup()
        } catch {
            print("データベース初期化エラー: \(error)")
            return
        }

        // アクティビティトラッキング開始
        activityTracker = ActivityTracker()
        activityTracker?.startTracking()
        appState.isTracking = true

        // Webサーバー開始
        webServer = WebServer()
        Task {
            do {
                try await webServer?.start()
            } catch {
                print("Webサーバー開始エラー: \(error)")
            }
        }
    }

    // MARK: - Actions

    @objc private func togglePopover() {
        guard let button = statusItem?.button, let popover = popover else { return }

        if popover.isShown {
            popover.performClose(nil)
        } else {
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            NSApp.activate(ignoringOtherApps: true)
        }
    }
}
