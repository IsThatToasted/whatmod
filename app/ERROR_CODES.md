# Aurelium Field Error Codes

User-facing errors intentionally avoid backend/provider implementation details.

## Configuration
- `AF-CFG-001` — general runtime configuration failure
- `AF-CFG-101` — runtime configuration resource missing
- `AF-CFG-102` — runtime configuration resource unreadable
- `AF-CFG-103` — runtime configuration malformed/mismatched
- `AF-CFG-104` — workspace endpoint invalid
- `AF-CFG-105` — public workspace credential missing

## Authentication
- `AF-AUTH-106` — native hosted sign-in could not start
- `AF-AUTH-107` — native sign-in did not return a valid handoff callback
- `AF-AUTH-108` — returned authentication result could not become an Aurelium session
- `AF-AUTH-001` — authenticated organization/session data could not be loaded
- `AF-AUTH-003` — sign-out failed

## Organization
- `AF-ORG-001` — organization creation failed
- `AF-ORG-002` — organization join/invite acceptance failed

## Projects
- `AF-PROJ-001` — project load failed
- `AF-PROJ-002` — project save failed
- `AF-PROJ-003` — project delete failed

## Administration
- `AF-ADM-001` — admin access validation failed
- `AF-ADM-002` — admin data load failed
- `AF-ADM-003` — admin timecard update/review failed
- `AF-ADM-004` — admin timecard deletion failed
- `AF-ADM-005` — employee/member update failed
- `AF-ADM-006` — employee invite action failed

## Time / GPS
- `AF-TIME-001` — timecard load failed
- `AF-TIME-002` — clock-in failed
- `AF-TIME-003` — clock-out failed
- `AF-TIME-004` — timecard submission failed
- `AF-TIME-005` — timecard edit request failed
- `AF-GPS-001` — location capture failed

## Walkthrough
- `AF-WALK-001` — speech permission/capture failed
- `AF-WALK-002` — walkthrough capture failed
- `AF-WALK-003` — evidence capture failed
- `AF-WALK-004` — 3D model export failed
- `AF-WALK-005` — optional video capture failed
- `AF-WALK-006` — walkthrough sync failed
- `AF-WALK-007` — walkthrough archive/completion failed

## General
- `AF-GEN-001` — unclassified failure
