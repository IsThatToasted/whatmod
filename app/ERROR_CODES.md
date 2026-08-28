# Aurelium Field — Public Error Reference Codes

Production UI must never render raw backend/provider errors, provider names, SQL/PostgREST messages, storage errors, API payloads, keys, URLs, or stack traces. Users receive a neutral message plus one of these stable reference codes.

| Code | Area | Meaning / engineering lookup |
| --- | --- | --- |
| AF-CFG-001 | Configuration | Required app cloud configuration was not injected into the build. |
| AF-AUTH-001 | Authentication | Sign-in/session operation failed. |
| AF-AUTH-002 | Authentication | OAuth/deep-link callback could not establish a session. |
| AF-AUTH-003 | Authentication | Sign-out failed. |
| AF-ORG-001 | Organization | Organization creation failed. |
| AF-ORG-002 | Organization | Organization invitation/join failed. |
| AF-PROJ-001 | Projects | Project list/load failed. |
| AF-PROJ-002 | Projects | Project save/update failed. |
| AF-PROJ-003 | Projects | Project deletion failed. |
| AF-ADM-001 | Admin | Current user is not authorized for the admin operation. |
| AF-ADM-002 | Admin | Admin dashboard data failed to load. |
| AF-ADM-003 | Admin | Admin timecard review/update failed. |
| AF-ADM-004 | Admin | Permanent admin timecard deletion failed. |
| AF-ADM-005 | Admin | Employee/member update or removal failed. |
| AF-ADM-006 | Admin | Employee invitation create/revoke failed. |
| AF-TIME-001 | Time | Timecard history failed to load. |
| AF-TIME-002 | Time | Clock-in failed. |
| AF-TIME-003 | Time | Clock-out failed. |
| AF-TIME-004 | Time | Timecard submission failed. |
| AF-TIME-005 | Time | Timecard correction/edit-request failed. |
| AF-GPS-001 | Location | Required location permission/reading was unavailable. |
| AF-WALK-001 | Walkthrough | Narration permission/capture failed. |
| AF-WALK-002 | Walkthrough | Spatial walkthrough capture failed. |
| AF-WALK-003 | Walkthrough | Tagged evidence capture failed. |
| AF-WALK-004 | Walkthrough | 3D room model/geometry export failed. |
| AF-WALK-005 | Walkthrough | Optional review-video capture failed. |
| AF-WALK-006 | Walkthrough | Walkthrough cloud synchronization failed. |
| AF-WALK-007 | Walkthrough | Project walkthrough archive/completion failed. |
| AF-GEN-001 | General | Unclassified recoverable failure. |

## UI format

Example: `We couldn't save that timecard. Reference: AF-TIME-004`

Raw technical errors may be emitted only in local DEBUG/development diagnostics. Production user-facing views must use the public code system.
