import type { RecordedSession } from '../types/pose';

export function downloadSession(session: RecordedSession) {
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = session.startedAt.replaceAll(':', '-').replaceAll('.', '-');
  link.href = url;
  link.download = `viMotionCoach-session-${timestamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
