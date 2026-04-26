import XCTest
@testable import CapacitorClerk

final class KeychainStoreTests: XCTestCase {
    func testRoundtrip() throws {
        let key = "test-key-\(UUID().uuidString)"
        defer { KeychainStore.shared.remove(key: key) }

        XCTAssertNil(KeychainStore.shared.get(key: key))

        KeychainStore.shared.set(key: key, value: "abc")
        XCTAssertEqual(KeychainStore.shared.get(key: key), "abc")

        KeychainStore.shared.set(key: key, value: "xyz")
        XCTAssertEqual(KeychainStore.shared.get(key: key), "xyz")

        KeychainStore.shared.remove(key: key)
        XCTAssertNil(KeychainStore.shared.get(key: key))
    }
}
