import Foundation
import Security

/// Thin wrapper around iOS Keychain Services for storing strings.
/// Uses `kSecClassGenericPassword` with `kSecAttrAccessibleAfterFirstUnlock`
/// so values survive across app launches but require the device to be
/// unlocked at least once after a reboot.
struct KeychainStore {
    static let shared = KeychainStore()

    /// Service label scoping our keys. Avoids collisions with other
    /// Keychain users in the same app.
    private let service = "io.clerk.capacitor-clerk"

    private init() {}

    /// Read a string for the given key, or nil if not found.
    func get(key: String) -> String? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    /// Store or overwrite a string for the given key.
    func set(key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }

        // Try to update first; if the entry doesn't exist, add it.
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key,
        ]
        let attrs: [CFString: Any] = [
            kSecValueData: data,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlock,
        ]

        let updateStatus = SecItemUpdate(query as CFDictionary, attrs as CFDictionary)
        if updateStatus == errSecItemNotFound {
            var addQuery = query
            addQuery[kSecValueData] = data
            addQuery[kSecAttrAccessible] = kSecAttrAccessibleAfterFirstUnlock
            SecItemAdd(addQuery as CFDictionary, nil)
        }
    }

    /// Delete the entry for the given key. No-op if not found.
    func remove(key: String) {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
