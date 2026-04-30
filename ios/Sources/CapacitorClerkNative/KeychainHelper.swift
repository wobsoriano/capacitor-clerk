import Security
import Foundation

enum KeychainHelper {
    private static var service: String {
        Bundle.main.bundleIdentifier ?? ""
    }

    private static func baseQuery(for key: String) -> [String: Any] {
        [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
    }

    static func write(key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }
        var query = baseQuery(for: key)
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        query[kSecValueData as String] = data

        let status = SecItemAdd(query as CFDictionary, nil)
        if status == errSecDuplicateItem {
            let attrs: [String: Any] = [
                kSecValueData as String:   data,
                kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            ]
            SecItemUpdate(baseQuery(for: key) as CFDictionary, attrs as CFDictionary)
        }
    }

    static func read(key: String) -> String? {
        var query = baseQuery(for: key)
        query[kSecReturnData as String]  = true
        query[kSecMatchLimit as String]  = kSecMatchLimitOne

        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
