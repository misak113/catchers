import * as Sentry from '@sentry/react';
import { browserTracingIntegration, startBrowserTracingNavigationSpan } from '@sentry/react';

const LOADING_FAILURE = 'Match page loading failed';
const loadingOperations = ['auth', 'upcoming', 'past'];
const loadingReasons = ['timeout', 'request', 'reconnect'];
export type LoadingOperation = 'auth' | 'upcoming' | 'past';
type LoadingReason = 'timeout' | 'request' | 'reconnect';

const sentryDsn = process.env.REACT_APP_SENTRY_DSN;
const sentryTraceSampleRate = Number(process.env.REACT_APP_SENTRY_TRACE_SAMPLE_RATE || '0.1');

const isValidSampleRate = Number.isFinite(sentryTraceSampleRate) && sentryTraceSampleRate >= 0 && sentryTraceSampleRate <= 1;

if (process.env.NODE_ENV === 'production' && sentryDsn) {
	Sentry.init({
		dsn: sentryDsn,
		environment: process.env.REACT_APP_SENTRY_ENVIRONMENT || 'production',
		release: process.env.REACT_APP_SENTRY_RELEASE,
		beforeSend: sanitizeLoadingEvent,
		integrations: [browserTracingIntegration({
			instrumentNavigation: false,
		})],
		tracesSampleRate: isValidSampleRate ? sentryTraceSampleRate : 0.1,
	});
}

export function sanitizeLoadingEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
	if (event.message !== LOADING_FAILURE) {
		return event;
	}
	const category = event.tags?.loading_operation;
	const reason = event.tags?.loading_reason;
	return {
		type: undefined,
		event_id: event.event_id,
		timestamp: event.timestamp,
		message: LOADING_FAILURE,
		level: 'warning',
		release: event.release,
		environment: event.environment,
		tags: {
			loading_operation: typeof category === 'string' && loadingOperations.includes(category) ? category : 'unknown',
			loading_reason: typeof reason === 'string' && loadingReasons.includes(reason) ? reason : 'unknown',
		},
	};
}

export function reportLoadingFailure(operation: LoadingOperation, reason: LoadingReason) {
	if (Sentry.getClient()) {
		Sentry.captureMessage(LOADING_FAILURE, {
			level: 'warning',
			tags: { loading_operation: operation, loading_reason: reason },
		});
	}
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
