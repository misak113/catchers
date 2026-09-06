// @ts-nocheck
import { parseMatchHistoryResponse } from './psmfMatchHistoryFacade';

describe('parseMatchHistoryResponse', () => {
	it('returns json payload when response is valid json', async () => {
		const response = {
			text: async () => JSON.stringify({ seasonKey: '2026-podzim' }),
		};

		await expect(parseMatchHistoryResponse(response)).resolves.toEqual({ seasonKey: '2026-podzim' });
	});

	it('converts html server errors into structured json error', async () => {
		const response = {
			text: async () => 'A server error has occurred',
		};

		await expect(parseMatchHistoryResponse(response)).resolves.toEqual({
			error: 'Server vrátil neplatnou odpověď při načítání historie zápasů.',
		});
	});
});
