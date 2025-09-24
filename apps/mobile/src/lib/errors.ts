export function captureException(error: unknown): void {
  try {
    const sentry = (globalThis as any)?.Sentry;
    if (sentry && typeof sentry.captureException === 'function') {
      sentry.captureException(error);
      return;
    }
  } catch {}
  console.warn('[error]', error);
}


