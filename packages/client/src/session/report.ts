// When something breaks on a player's device (a crash, the game server saying no), it's sent to
// the server (/api/report) so it can be seen and fixed: `pnpm errors` lists what came in. Only what
// failed, the build and the page; nothing about the player. A few per visit, each kind once.
import { serverHost } from './room-client.ts';

/** At most this many reports a visit (a broken loop mustn't flood the server). */
const MAX_REPORTS = 8;
const sent = new Set<string>();

export function reportError(kind: string, message: string, detail = ''): void {
  const key = `${kind}|${message}`;
  if (sent.has(key) || sent.size >= MAX_REPORTS) return;
  sent.add(key);
  if (import.meta.env.DEV) return void console.warn(`[report ${kind}] ${message}`, detail);
  const protocol = location.protocol === 'https:' ? 'https:' : 'http:';
  // (keepalive: it still goes out if the page is closing.)
  void fetch(`${protocol}//${serverHost()}/api/report`, {
    method: 'POST',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, message: message.slice(0, 300), detail: detail.slice(0, 2000), build: __BUILD_ID__, page: location.pathname + location.search.replace(/transfer=[^&]*/, 'transfer=…') }),
  }).catch(() => {});
}

/** Crashes the game didn't catch: thrown errors and failed promises. */
export function installErrorReports(): void {
  addEventListener('error', (e) => {
    // A script or asset that failed to load has no error object; say which.
    const where = e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno}:${e.colno})` : '';
    reportError('crash', `${e.message || 'error'}${where}`, e.error instanceof Error ? (e.error.stack ?? '') : '');
  });
  addEventListener('unhandledrejection', (e) => {
    const r = e.reason as unknown;
    reportError('promise', r instanceof Error ? r.message : String(r), r instanceof Error ? (r.stack ?? '') : '');
  });
}
