import { useState } from 'react';
import { useAsyncEffect } from '../React/async';
export {
	buildPSMFSeasonKey,
	formatPSMFSeasonLabel,
	getCurrentPSMFSeason,
	getNextPSMFSeason,
	getPreviousPSMFSeason,
	isSamePSMFSeason,
	parsePSMFSeasonKey,
	type IPSMFHistoricalMatch,
	type IPSMFHistoricalRawTable,
	type IPSMFHistoricalScorer,
	type IPSMFSeason,
	type IPSMFSeasonHistoryCacheDocument,
} from './psmfMatchHistoryShared';
import { buildPSMFSeasonKey, IPSMFSeason, IPSMFSeasonHistoryCacheDocument } from './psmfMatchHistoryShared';

export const PSMF_MATCH_HISTORY_ENDPOINT = '/api/psmf-match-history';

export function useSeasonMatchHistory(season: IPSMFSeason) {
	const [data, setData] = useState<IPSMFSeasonHistoryCacheDocument>();
	const [errorMessage, setErrorMessage] = useState<string>();
	const [loading, setLoading] = useState(false);
	const seasonKey = buildPSMFSeasonKey(season);

	useAsyncEffect(async () => {
		setData(undefined);
		setLoading(true);
		try {
			const response = await fetch(`${PSMF_MATCH_HISTORY_ENDPOINT}?season=${encodeURIComponent(seasonKey)}`);
			const responseData = await parseMatchHistoryResponse(response);
			if (!response.ok) {
				throw new Error('error' in responseData ? responseData.error || 'Nepodařilo se načíst historii zápasů.' : 'Nepodařilo se načíst historii zápasů.');
			}
			setData(responseData as IPSMFSeasonHistoryCacheDocument);
			setErrorMessage(undefined);
		} catch (error) {
			console.error(error);
			setErrorMessage(error instanceof Error ? error.message : 'Nepodařilo se načíst historii zápasů.');
		} finally {
			setLoading(false);
		}
	}, [seasonKey]);

	return {
		data,
		errorMessage,
		loading,
	};
}

export async function parseMatchHistoryResponse(response: Pick<Response, 'text'>): Promise<IPSMFSeasonHistoryCacheDocument | { error?: string }> {
	const responseText = await response.text();
	if (!responseText) {
		return {};
	}
	try {
		return JSON.parse(responseText) as IPSMFSeasonHistoryCacheDocument | { error?: string };
	} catch {
		const normalizedMessage = responseText.startsWith('<') || responseText.startsWith('A server error')
			? 'Server vrátil neplatnou odpověď při načítání historie zápasů.'
			: responseText.slice(0, 200);
		return {
			error: normalizedMessage,
		};
	}
}
