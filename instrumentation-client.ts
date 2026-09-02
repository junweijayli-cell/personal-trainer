import * as Sentry from '@sentry/browser';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  try {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_MARKET === 'cn' ? 'china-production' : 'global-production',
      tracesSampleRate: 0.1,
      beforeSend(event) {
        if (event.user) delete event.user.email;
        return event;
      },
    });
  } catch {
    // Monitoring must never prevent the training interface from loading.
  }
}
