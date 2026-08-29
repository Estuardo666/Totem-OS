import Foundation

public enum FileCacheKind: String, Codable {
    case original
    case thumbnail
}

public struct FileCacheEntry: Codable, Equatable {
    public let key: String
    public let kind: FileCacheKind
    public let fileName: String
    public var size: Int
    public var lastAccessAt: Date

    public init(key: String, kind: FileCacheKind, fileName: String, size: Int, lastAccessAt: Date = .now) {
        self.key = key
        self.kind = kind
        self.fileName = fileName
        self.size = size
        self.lastAccessAt = lastAccessAt
    }
}

public enum FileCacheError: Error, Equatable {
    case invalidKey
    case unavailableDirectory
}

/// Caché binaria independiente de SwiftData. Sólo mantiene metadatos pequeños
/// en un índice y aplica LRU antes de superar `maxBytes`.
@MainActor
public final class LocalFileCache {
    public let directory: URL
    public let maxBytes: Int
    private var index: [String: FileCacheEntry] = [:]
    private let fileManager = FileManager.default
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    public init(directory: URL? = nil, maxBytes: Int = 250 * 1024 * 1024) throws {
        guard maxBytes > 0 else { throw FileCacheError.unavailableDirectory }
        if let directory {
            self.directory = directory
        } else if let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first {
            self.directory = caches.appendingPathComponent("TotemOS/Files", isDirectory: true)
        } else {
            throw FileCacheError.unavailableDirectory
        }
        self.maxBytes = maxBytes
        try fileManager.createDirectory(at: self.directory, withIntermediateDirectories: true)
        try Self.excludeFromBackup(self.directory)
        try loadIndex()
        try evictIfNeeded()
    }

    public var currentBytes: Int { index.values.reduce(0) { $0 + $1.size } }
    public var entries: [FileCacheEntry] { index.values.sorted { $0.lastAccessAt < $1.lastAccessAt } }

    @discardableResult
    public func put(data: Data, key: String, kind: FileCacheKind = .original) throws -> URL {
        guard !key.isEmpty, !key.contains(".."), !key.contains("/"), !key.contains("\\") else {
            throw FileCacheError.invalidKey
        }
        let fileName = "\(key)-\(kind.rawValue).bin"
        let url = directory.appendingPathComponent(fileName, isDirectory: false)
        try data.write(to: url, options: .atomic)
        try Self.excludeFromBackup(url)
        let indexKey = Self.indexKey(key: key, kind: kind)
        index[indexKey] = FileCacheEntry(key: key, kind: kind, fileName: fileName, size: data.count)
        try evictIfNeeded()
        try saveIndex()
        return url
    }

    @discardableResult
    public func putThumbnail(data: Data, key: String) throws -> URL {
        try put(data: data, key: key, kind: .thumbnail)
    }

    public func data(forKey key: String, kind: FileCacheKind = .original) throws -> Data? {
        guard let entry = touch(key: key, kind: kind) else { return nil }
        let url = directory.appendingPathComponent(entry.fileName)
        guard fileManager.fileExists(atPath: url.path) else {
            index.removeValue(forKey: Self.indexKey(key: key, kind: kind))
            try saveIndex()
            return nil
        }
        return try Data(contentsOf: url)
    }

    public func url(forKey key: String, kind: FileCacheKind = .original) throws -> URL? {
        guard let entry = touch(key: key, kind: kind) else { return nil }
        return directory.appendingPathComponent(entry.fileName)
    }

    public func remove(key: String, kind: FileCacheKind = .original) throws {
        let indexKey = Self.indexKey(key: key, kind: kind)
        if let entry = index.removeValue(forKey: indexKey) {
            let url = directory.appendingPathComponent(entry.fileName)
            if fileManager.fileExists(atPath: url.path) { try fileManager.removeItem(at: url) }
            try saveIndex()
        }
    }

    public func clear() throws {
        for entry in index.values {
            let url = directory.appendingPathComponent(entry.fileName)
            if fileManager.fileExists(atPath: url.path) { try fileManager.removeItem(at: url) }
        }
        index.removeAll()
        try saveIndex()
    }

    /// Marca un documento sensible para que iOS no lo incluya en backups.
    public static func excludeFromBackup(_ url: URL) throws {
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var target = url
        try target.setResourceValues(values)
    }

    private func touch(key: String, kind: FileCacheKind) -> FileCacheEntry? {
        let indexKey = Self.indexKey(key: key, kind: kind)
        guard var entry = index[indexKey] else { return nil }
        entry.lastAccessAt = .now
        index[indexKey] = entry
        try? saveIndex()
        return entry
    }

    private func evictIfNeeded() throws {
        while currentBytes > maxBytes, let oldest = index.values.min(by: { $0.lastAccessAt < $1.lastAccessAt }) {
            index.removeValue(forKey: Self.indexKey(key: oldest.key, kind: oldest.kind))
            let url = directory.appendingPathComponent(oldest.fileName)
            if fileManager.fileExists(atPath: url.path) { try fileManager.removeItem(at: url) }
        }
    }

    private func loadIndex() throws {
        let url = directory.appendingPathComponent(".index.json")
        guard fileManager.fileExists(atPath: url.path) else { return }
        let data = try Data(contentsOf: url)
        let entries = try decoder.decode([FileCacheEntry].self, from: data)
        index = Dictionary(uniqueKeysWithValues: entries.map { (Self.indexKey(key: $0.key, kind: $0.kind), $0) })
    }

    private func saveIndex() throws {
        let url = directory.appendingPathComponent(".index.json")
        let data = try encoder.encode(Array(index.values))
        try data.write(to: url, options: .atomic)
        try Self.excludeFromBackup(url)
    }

    private static func indexKey(key: String, kind: FileCacheKind) -> String { "\(kind.rawValue)::\(key)" }
}

/// Cola mínima para que el sistema pueda continuar una subida mientras la app
/// pasa a background. El archivo permanece en disco y no entra en SwiftData.
public final class BackgroundFileUploadQueue: NSObject, URLSessionTaskDelegate {
    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.background(withIdentifier: identifier)
        configuration.isDiscretionary = false
        configuration.sessionSendsLaunchEvents = true
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()
    private let identifier: String

    public init(identifier: String = "com.totemmassmedia.totemos.file-upload") {
        self.identifier = identifier
        super.init()
    }

    @discardableResult
    public func enqueue(
        fileURL: URL,
        to endpoint: URL,
        headers: [String: String] = [:]
    ) -> URLSessionUploadTask {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/octet-stream", forHTTPHeaderField: "content-type")
        headers.forEach { request.setValue($1, forHTTPHeaderField: $0) }
        let task = session.uploadTask(with: request, fromFile: fileURL)
        task.resume()
        return task
    }
}
