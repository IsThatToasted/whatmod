import type { ProjectStatus } from '../types/domain';

export function StatusPill({ status }: { status: ProjectStatus }) {
  return <span className={`status status-${status}`}>{status}</span>;
}
