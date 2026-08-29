export const AF_ERROR = {
  configuration: 'AF-CFG-001',
  authentication: 'AF-AUTH-001',
  authCallback: 'AF-AUTH-002',
  organizationCreate: 'AF-ORG-001',
  organizationJoin: 'AF-ORG-002',
  adminAccess: 'AF-ADM-001',
  adminLoad: 'AF-ADM-002',
  adminTimeUpdate: 'AF-ADM-003',
  adminTimeDelete: 'AF-ADM-004',
  adminMemberUpdate: 'AF-ADM-005',
  adminInvite: 'AF-ADM-006',
  clockLoad: 'AF-TIME-001',
  clockIn: 'AF-TIME-002',
  clockOut: 'AF-TIME-003',
  timeSubmit: 'AF-TIME-004',
  location: 'AF-GPS-001',
  projectLoad: 'AF-PROJ-001',
  projectSave: 'AF-PROJ-002',
  projectDelete: 'AF-PROJ-003',
  unknown: 'AF-GEN-001',
} as const;

export type AFErrorCode = (typeof AF_ERROR)[keyof typeof AF_ERROR];

export function publicError(code: AFErrorCode, message = "We couldn't complete that action.") {
  return `${message} Reference: ${code}`;
}

export function debugError(code: AFErrorCode, error: unknown) {
  if (import.meta.env.DEV) console.error(`[${code}]`, error);
}
