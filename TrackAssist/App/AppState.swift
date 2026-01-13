import Foundation
import SwiftUI
import Combine

@MainActor
final class AppState: ObservableObject {
    static let shared = AppState()

    @Published var isTracking: Bool = false
    @Published var isIdle: Bool = false
    @Published var accessibilityGranted: Bool = false
    @Published var currentApp: String = ""
    @Published var currentWindowTitle: String = ""
    @Published var serverPort: UInt16 = 8080

    private init() {}
}
