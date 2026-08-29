import Foundation

enum AFErrorCode: String, Sendable {
    case configuration = "AF-CFG-001"
    case configurationResourceMissing = "AF-CFG-101"
    case configurationResourceUnreadable = "AF-CFG-102"
    case configurationResourceMalformed = "AF-CFG-103"
    case configurationEndpointInvalid = "AF-CFG-104"
    case configurationPublicKeyMissing = "AF-CFG-105"
    case authentication = "AF-AUTH-001"
    case signOut = "AF-AUTH-003"
    case nativeAuthStart = "AF-AUTH-106"
    case nativeAuthCallback = "AF-AUTH-107"
    case nativeAuthExchange = "AF-AUTH-108"
    case organizationCreate = "AF-ORG-001"
    case organizationJoin = "AF-ORG-002"
    case projectLoad = "AF-PROJ-001"
    case projectSave = "AF-PROJ-002"
    case projectDelete = "AF-PROJ-003"
    case adminAccess = "AF-ADM-001"
    case adminLoad = "AF-ADM-002"
    case adminTimeUpdate = "AF-ADM-003"
    case adminTimeDelete = "AF-ADM-004"
    case adminMemberUpdate = "AF-ADM-005"
    case adminInvite = "AF-ADM-006"
    case clockLoad = "AF-TIME-001"
    case clockIn = "AF-TIME-002"
    case clockOut = "AF-TIME-003"
    case timeSubmit = "AF-TIME-004"
    case timeEdit = "AF-TIME-005"
    case location = "AF-GPS-001"
    case speechPermission = "AF-WALK-001"
    case walkthroughCapture = "AF-WALK-002"
    case evidenceCapture = "AF-WALK-003"
    case modelExport = "AF-WALK-004"
    case videoCapture = "AF-WALK-005"
    case walkthroughSync = "AF-WALK-006"
    case walkthroughArchive = "AF-WALK-007"
    case unknown = "AF-GEN-001"
}

struct AFPublicError: LocalizedError, Sendable {
    let code: AFErrorCode
    let message: String

    var errorDescription: String? { displayText }
    var displayText: String { "\(message) Reference: \(code.rawValue)" }

    static func text(_ code: AFErrorCode, _ message: String = "We couldn't complete that action.") -> String {
        AFPublicError(code: code, message: message).displayText
    }

    static func error(_ code: AFErrorCode, _ message: String = "We couldn't complete that action.") -> AFPublicError {
        AFPublicError(code: code, message: message)
    }

    static func capture(_ error: Error, code: AFErrorCode) {
        #if DEBUG
        print("[\(code.rawValue)] \(String(describing: error))")
        #endif
    }
}
