import AppKit
import ApplicationServices

struct AccessibilityHelper {
    /// アクセシビリティ権限が許可されているか確認
    static func isAccessibilityEnabled() -> Bool {
        AXIsProcessTrusted()
    }

    /// アクセシビリティ権限をリクエスト（プロンプト表示）
    static func requestAccessibilityPermission() -> Bool {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        return AXIsProcessTrustedWithOptions(options)
    }

    /// 指定したプロセスIDのフォーカスされたウィンドウタイトルを取得
    static func getWindowTitle(for pid: pid_t) -> String? {
        let appElement = AXUIElementCreateApplication(pid)

        // フォーカスされたウィンドウを取得
        var focusedWindow: CFTypeRef?
        let focusResult = AXUIElementCopyAttributeValue(
            appElement,
            kAXFocusedWindowAttribute as CFString,
            &focusedWindow
        )

        guard focusResult == .success, let window = focusedWindow else {
            return nil
        }

        // ウィンドウタイトルを取得
        var title: CFTypeRef?
        let titleResult = AXUIElementCopyAttributeValue(
            window as! AXUIElement,
            kAXTitleAttribute as CFString,
            &title
        )

        guard titleResult == .success, let titleString = title as? String else {
            return nil
        }

        return titleString
    }

    /// フロントモストアプリの情報を取得
    static func getFrontmostAppInfo() -> (name: String, bundleId: String?, pid: pid_t)? {
        guard let app = NSWorkspace.shared.frontmostApplication else {
            return nil
        }

        let name = app.localizedName ?? "Unknown"
        return (name, app.bundleIdentifier, app.processIdentifier)
    }

    /// フロントモストアプリのウィンドウタイトルを取得
    static func getFrontmostWindowTitle() -> String? {
        guard let app = NSWorkspace.shared.frontmostApplication else {
            return nil
        }
        return getWindowTitle(for: app.processIdentifier)
    }
}
