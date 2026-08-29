import Foundation

public enum ConflictChoice: Equatable {
    case local
    case server
}

public struct SyncConflict: Codable, Equatable {
    public let base: [String: APIJSONValue]?
    public let local: [String: APIJSONValue]?
    public let server: [String: APIJSONValue]?
    public let localDeleted: Bool
    public let serverDeleted: Bool

    public init(
        base: [String: APIJSONValue]?,
        local: [String: APIJSONValue]?,
        server: [String: APIJSONValue]?,
        localDeleted: Bool = false,
        serverDeleted: Bool = false
    ) {
        self.base = base
        self.local = local
        self.server = server
        self.localDeleted = localDeleted
        self.serverDeleted = serverDeleted
    }
}

public struct ConflictResolution: Equatable {
    public let merged: [String: APIJSONValue]?
    public let mergedDeleted: Bool
    public let unresolvedFields: [String]

    public var isResolved: Bool { unresolvedFields.isEmpty }

    public init(merged: [String: APIJSONValue]?, mergedDeleted: Bool, unresolvedFields: [String]) {
        self.merged = merged
        self.mergedDeleted = mergedDeleted
        self.unresolvedFields = unresolvedFields
    }
}

/// Fusión de tres versiones. Sólo hay decisión humana cuando ambos lados
/// cambiaron el mismo campo o cuando un lado eliminó mientras el otro editó.
public enum SyncConflictResolver {
    public static let deleteField = "__deleted"

    public static func merge(_ conflict: SyncConflict) -> ConflictResolution {
        var merged: [String: APIJSONValue] = [:]
        var unresolved: [String] = []
        let keys = Set((conflict.base ?? [:]).keys)
            .union((conflict.local ?? [:]).keys)
            .union((conflict.server ?? [:]).keys)

        for key in keys.sorted() {
            let baseValue = conflict.base?[key]
            let localValue = conflict.local?[key]
            let serverValue = conflict.server?[key]
            let localChanged = localValue != baseValue
            let serverChanged = serverValue != baseValue

            if localChanged && serverChanged && localValue != serverValue {
                unresolved.append(key)
            } else if localChanged {
                if let localValue { merged[key] = localValue }
            } else if serverChanged {
                if let serverValue { merged[key] = serverValue }
            } else if let baseValue {
                merged[key] = baseValue
            }
        }

        let deletionDiffers = conflict.localDeleted != conflict.serverDeleted
        if deletionDiffers {
            let deletedSideHasEdit: Bool
            if conflict.localDeleted {
                deletedSideHasEdit = hasChanges(conflict.base, conflict.server)
            } else {
                deletedSideHasEdit = hasChanges(conflict.base, conflict.local)
            }
            if deletedSideHasEdit {
                unresolved.append(deleteField)
            }
        }

        let mergedDeleted: Bool
        if conflict.localDeleted == conflict.serverDeleted {
            mergedDeleted = conflict.localDeleted
        } else {
            // Si sólo un lado elimina y el otro no modificó datos, la eliminación
            // es segura; en caso contrario queda pendiente de decisión.
            mergedDeleted = conflict.localDeleted || conflict.serverDeleted
        }
        return ConflictResolution(merged: merged.isEmpty ? nil : merged, mergedDeleted: mergedDeleted, unresolvedFields: unresolved)
    }

    public static func resolve(
        _ conflict: SyncConflict,
        choices: [String: ConflictChoice]
    ) -> ConflictResolution {
        let automatic = merge(conflict)
        guard !automatic.unresolvedFields.isEmpty else { return automatic }

        var merged = automatic.merged ?? [:]
        var unresolved: [String] = []
        var mergedDeleted = automatic.mergedDeleted
        for field in automatic.unresolvedFields {
            guard let choice = choices[field] else {
                unresolved.append(field)
                continue
            }
            if field == deleteField {
                mergedDeleted = choice == .local ? conflict.localDeleted : conflict.serverDeleted
                continue
            }
            let source = choice == .local ? conflict.local : conflict.server
            if let value = source?[field] {
                merged[field] = value
            } else {
                merged.removeValue(forKey: field)
            }
        }
        return ConflictResolution(
            merged: merged.isEmpty ? nil : merged,
            mergedDeleted: mergedDeleted,
            unresolvedFields: unresolved
        )
    }

    private static func hasChanges(
        _ base: [String: APIJSONValue]?,
        _ candidate: [String: APIJSONValue]?
    ) -> Bool {
        base != candidate
    }
}
