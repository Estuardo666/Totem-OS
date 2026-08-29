import XCTest
@testable import TotemOSKit

@MainActor
final class FileCacheTests: XCTestCase {
    private var directory: URL!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("totem-cache-\(UUID().uuidString)", isDirectory: true)
    }

    override func tearDownWithError() throws {
        if let directory { try? FileManager.default.removeItem(at: directory) }
    }

    func testLRUEvictsOldestBinaryAndKeepsIndexConsistent() throws {
        let cache = try LocalFileCache(directory: directory, maxBytes: 10)
        _ = try cache.put(data: Data(repeating: 1, count: 8), key: "first")
        _ = try cache.put(data: Data(repeating: 2, count: 8), key: "second")

        XCTAssertLessThanOrEqual(cache.currentBytes, 10)
        XCTAssertNil(try cache.data(forKey: "first"))
        XCTAssertEqual(try cache.data(forKey: "second")?.count, 8)
    }

    func testThumbnailAndManualClearDoNotTouchStructuredStore() throws {
        let cache = try LocalFileCache(directory: directory, maxBytes: 100)
        _ = try cache.putThumbnail(data: Data([1, 2, 3]), key: "preview")
        XCTAssertEqual(cache.entries.first?.kind, .thumbnail)

        try cache.clear()

        XCTAssertEqual(cache.currentBytes, 0)
        XCTAssertTrue(cache.entries.isEmpty)
        XCTAssertTrue(FileManager.default.fileExists(atPath: directory.appendingPathComponent(".index.json").path))
    }
}
