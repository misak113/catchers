// @ts-nocheck
import { shouldRefreshCache } from './psmf-match-history';

describe('psmf match history cache refresh', () => {
	it('refreshes current season cache when it is empty', () => {
		expect(shouldRefreshCache({
			seasonKey: '2026-podzim',
			seasonLabel: 'Podzimní 2026',
			season: {
				year: 2026,
				half: 'podzim',
			},
			fetchedAtIso: new Date().toISOString(),
			source: {
				cacheVersion: 1,
				searchUrl: 'https://www.psmf.cz/vyhledavani/?query=Catchers+SC',
			},
			matches: [],
		}, true)).toBe(true);
	});

	it('keeps non-current season cache when version matches', () => {
		expect(shouldRefreshCache({
			seasonKey: '2025-podzim',
			seasonLabel: 'Podzimní 2025',
			season: {
				year: 2025,
				half: 'podzim',
			},
			fetchedAtIso: new Date().toISOString(),
			source: {
				cacheVersion: 1,
				searchUrl: 'https://www.psmf.cz/vyhledavani/?query=Catchers+SC',
			},
			matches: [{
				id: '1',
				startsAtIso: new Date().toISOString(),
				tournament: '2025-hanspaulska-liga-podzim',
				group: '6-e',
				opponentCode: 'youngsters-fc-b',
				opponentName: 'Youngsters FC B',
				status: 'finished',
				scorers: [],
				score: {
					home: 2,
					guest: 6,
					raw: '2:6',
				},
				raw: {
					rowCells: [],
				},
			}],
		}, false)).toBe(false);
	});
});
