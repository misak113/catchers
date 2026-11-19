import { expect, it } from '@jest/globals';
import { sanitizeLoadingEvent } from './monitoring';

it('keeps only allowlisted diagnostic fields on match loading warnings', () => {
	expect(sanitizeLoadingEvent({
		type: undefined,
		message: 'Match page loading failed',
		release: 'test-release',
		user: { id: 'private' },
		request: { url: 'https://example.test/private' },
		breadcrumbs: [{ message: 'private' }],
		extra: { token: 'private' },
		tags: { loading_operation: 'upcoming', loading_reason: 'private', other: 'private' },
	})).toEqual({
		message: 'Match page loading failed',
		release: 'test-release',
		level: 'warning',
		tags: { loading_operation: 'upcoming', loading_reason: 'unknown' },
	});
});
