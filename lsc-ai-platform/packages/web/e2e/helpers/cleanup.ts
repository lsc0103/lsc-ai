import { ApiHelper } from './api.helper';

/**
 * Clean up test sessions (those prefixed with "test-")
 */
export async function cleanupTestSessions(api: ApiHelper) {
  const sessions = await api.getSessions();
  const testSessions = (Array.isArray(sessions) ? sessions : sessions.data || [])
    .filter((s: any) => s.title?.startsWith('test-'));

  for (const session of testSessions) {
    await api.deleteSession(session.id).catch(() => {});
  }
}
