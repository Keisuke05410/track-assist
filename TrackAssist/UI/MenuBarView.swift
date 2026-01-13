import SwiftUI

struct MenuBarView: View {
    @ObservedObject private var appState = AppState.shared
    @State private var loginItemEnabled = LoginItemManager.shared.isEnabled
    @State private var showingError = false
    @State private var errorMessage = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // ヘッダー
            HStack {
                Image(systemName: "clock.fill")
                    .foregroundStyle(.blue)
                Text("TrackAssist")
                    .font(.headline)
                Spacer()
                StatusBadge(isTracking: appState.isTracking, isIdle: appState.isIdle)
            }
            .padding(.bottom, 4)

            Divider()

            // 現在のアクティビティ
            VStack(alignment: .leading, spacing: 4) {
                Text("現在のアクティビティ")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if appState.isIdle {
                    Label("アイドル中", systemImage: "moon.zzz.fill")
                        .foregroundStyle(.orange)
                } else {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(appState.currentApp.isEmpty ? "取得中..." : appState.currentApp)
                            .font(.system(.body, weight: .medium))

                        if !appState.currentWindowTitle.isEmpty {
                            Text(appState.currentWindowTitle)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                    }
                }
            }

            Divider()

            // アクセシビリティ状態
            if !appState.accessibilityGranted {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.yellow)
                    Text("アクセシビリティ権限が必要です")
                        .font(.caption)
                }
                .padding(.vertical, 4)

                Button("システム環境設定を開く") {
                    openAccessibilitySettings()
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)

                Divider()
            }

            // アクション
            VStack(spacing: 8) {
                Button {
                    openTimeline()
                } label: {
                    Label("タイムラインを開く", systemImage: "chart.bar.xaxis")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.regular)

                HStack {
                    Toggle("ログイン時に起動", isOn: $loginItemEnabled)
                        .toggleStyle(.switch)
                        .controlSize(.small)
                        .onChange(of: loginItemEnabled) { newValue in
                            toggleLoginItem(enable: newValue)
                        }
                }
            }

            Divider()

            // フッター
            HStack {
                Button("終了") {
                    NSApplication.shared.terminate(nil)
                }
                .buttonStyle(.borderless)
                .foregroundStyle(.red)

                Spacer()

                Text("localhost:\(appState.serverPort)")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding()
        .frame(width: 260)
        .alert("エラー", isPresented: $showingError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage)
        }
    }

    // MARK: - Actions

    private func openTimeline() {
        let url = URL(string: "http://localhost:\(appState.serverPort)")!
        NSWorkspace.shared.open(url)
    }

    private func openAccessibilitySettings() {
        let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")!
        NSWorkspace.shared.open(url)
    }

    private func toggleLoginItem(enable: Bool) {
        do {
            if enable {
                try LoginItemManager.shared.enable()
            } else {
                try LoginItemManager.shared.disable()
            }
        } catch {
            errorMessage = "自動起動の設定に失敗しました: \(error.localizedDescription)"
            showingError = true
            loginItemEnabled = LoginItemManager.shared.isEnabled
        }
    }
}

// MARK: - Components

struct StatusBadge: View {
    let isTracking: Bool
    let isIdle: Bool

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
            Text(statusText)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(statusColor.opacity(0.1))
        .clipShape(Capsule())
    }

    private var statusColor: Color {
        if !isTracking {
            return .gray
        } else if isIdle {
            return .orange
        } else {
            return .green
        }
    }

    private var statusText: String {
        if !isTracking {
            return "停止中"
        } else if isIdle {
            return "アイドル"
        } else {
            return "記録中"
        }
    }
}
