import ServiceManagement
import Foundation

@MainActor
final class LoginItemManager {
    static let shared = LoginItemManager()

    private init() {}

    /// ログイン時の自動起動が有効かどうか
    var isEnabled: Bool {
        SMAppService.mainApp.status == .enabled
    }

    /// ログイン時の自動起動を有効化
    func enable() throws {
        try SMAppService.mainApp.register()
    }

    /// ログイン時の自動起動を無効化
    func disable() throws {
        try SMAppService.mainApp.unregister()
    }

    /// 自動起動の状態をトグル
    func toggle() throws {
        if isEnabled {
            try disable()
        } else {
            try enable()
        }
    }

    /// 現在のステータスを文字列で取得
    var statusDescription: String {
        switch SMAppService.mainApp.status {
        case .notRegistered:
            return "未登録"
        case .enabled:
            return "有効"
        case .requiresApproval:
            return "承認が必要"
        case .notFound:
            return "見つかりません"
        @unknown default:
            return "不明"
        }
    }
}
