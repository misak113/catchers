import * as Sentry from '@sentry/react';
import { browserTracingIntegration, startBrowserTracingNavigationSpan } from '@sentry/react';

const sentryDsn = process.env.REACT_APP_SENTRY_DSN;
const sentryTraceSampleRate = Number(process.env.REACT_APP_SENTRY_TRACE_SAMPLE_RATE || '0.1');

const isValidSampleRate = Number.isFinite(sentryTraceSampleRate) && sentryTraceSampleRate >= 0 && sentryTraceSampleRate <= 1;

if (process.env.NODE_ENV === 'production' && sentryDsn) {
	Sentry.init({
		dsn: sentryDsn,
		environment: process.env.REACT_APP_SENTRY_ENVIRONMENT || 'production',
		integrations: [browserTracingIntegration({
			instrumentNavigation: false,
		})],
		tracesSampleRate: isValidSampleRate ? sentryTraceSampleRate : 0.1,
	});
}

export const recordNavigation = (path: string) => {
	const client = Sentry.getClient();
	if (!client) {
		return;
	}

	startBrowserTracingNavigationSpan(client, {
		op: 'navigation',
		name: path,
	}, {
		url: window.location.href,
	});
};
