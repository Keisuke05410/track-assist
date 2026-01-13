import Foundation
import IOKit

final class IdleDetector {
    /// アイドル判定の閾値（秒）- 5分
    let idleThreshold: TimeInterval = 300

    /// システムのアイドル時間を取得（秒）
    func getSystemIdleTime() -> TimeInterval? {
        var iterator: io_iterator_t = 0
        defer {
            if iterator != 0 {
                IOObjectRelease(iterator)
            }
        }

        let result = IOServiceGetMatchingServices(
            kIOMainPortDefault,
            IOServiceMatching("IOHIDSystem"),
            &iterator
        )

        guard result == KERN_SUCCESS else {
            return nil
        }

        let entry: io_registry_entry_t = IOIteratorNext(iterator)
        defer {
            if entry != 0 {
                IOObjectRelease(entry)
            }
        }

        guard entry != 0 else {
            return nil
        }

        var unmanagedDict: Unmanaged<CFMutableDictionary>?
        let propertiesResult = IORegistryEntryCreateCFProperties(
            entry,
            &unmanagedDict,
            kCFAllocatorDefault,
            0
        )

        guard propertiesResult == KERN_SUCCESS,
              let dict = unmanagedDict?.takeRetainedValue() as? [String: Any],
              let idleTimeNs = dict["HIDIdleTime"] as? Int64 else {
            return nil
        }

        // ナノ秒から秒に変換
        return Double(idleTimeNs) / Double(NSEC_PER_SEC)
    }

    /// ユーザーがアイドル状態かどうか
    var isUserIdle: Bool {
        guard let idleTime = getSystemIdleTime() else {
            return false
        }
        return idleTime >= idleThreshold
    }

    /// 現在のアイドル時間を人間が読める形式で取得
    func formattedIdleTime() -> String {
        guard let idleTime = getSystemIdleTime() else {
            return "不明"
        }

        if idleTime < 60 {
            return "\(Int(idleTime))秒"
        } else if idleTime < 3600 {
            return "\(Int(idleTime / 60))分"
        } else {
            let hours = Int(idleTime / 3600)
            let minutes = Int((idleTime.truncatingRemainder(dividingBy: 3600)) / 60)
            return "\(hours)時間\(minutes)分"
        }
    }
}
