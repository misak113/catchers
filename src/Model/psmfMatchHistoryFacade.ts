import { useState } from 'react';
import { useAsyncEffect } from '../React/async';

export type PSMFSeasonHalf = 'jaro' | 'podzim';

export interface IPSMFSeason {
	year: number;
	half: PSMFSeasonHalf;
}

export interface IPSMFHistoricalMatchScore {
	home: number;
	guest: number;
	raw: string;
}

export interface IPSMFHistoricalScorer {
	playerName: string;
	minute?: number;
	rawMinute?: string;
	teamSide: 'home' | 'guest' | 'unknown';
	rawText: string;
}

export interface IPSMFHistoricalRawTable {
	title?: string;
	rows: string[][];
}

export interface IPSMFHistoricalMatch {
	id: string;
	startsAtIso: string;
	tournament: string;
	group: string;
	field?: string;
	round?: string;
	opponentCode: string;
	opponentName: string;
	homeTeamCode?: string;
	homeTeamName?: string;
	guestTeamCode?: string;
	guestTeamName?: string;
	detailPath?: string;
	score?: IPSMFHistoricalMatchScore;
	status: 'scheduled' | 'finished' | 'playedWithoutScore';
	scorers: IPSMFHistoricalScorer[];
	raw: {
		rowCells: string[];
		scoreCell?: string;
		detailTitle?: string;
		detailLines?: string[];
		detailTables?: IPSMFHistoricalRawTable[];
	};
}

export interface IPSMFSeasonHistoryCacheDocument {
	seasonKey: string;
	seasonLabel: string;
	season: IPSMFSeason;
	fetchedAtIso: string;
	source: {
		cacheVersion: number;
		searchUrl: string;
		teamPagePath?: string;
		teamPageUrl?: string;
		fromCache?: boolean;
		stale?: boolean;
		errorMessage?: string;
	};
	matches: IPSMFHistoricalMatch[];
}

export const PSMF_MATCH_HISTORY_ENDPOINT = '/api/psmf-match-history';

export function getCurrentPSMFSeason(now = new Date()): IPSMFSeason {
	return {
		year: now.getFullYear(),
		half: now.getMonth() <= 6 ? 'jaro' : 'podzim',
	};
}

export function getPreviousPSMFSeason(season: IPSMFSeason): IPSMFSeason {
	return season.half === 'podzim'
		? { year: season.year, half: 'jaro' }
		: { year: season.year - 1, half: 'podzim' };
}

export function getNextPSMFSeason(season: IPSMFSeason): IPSMFSeason {
	return season.half === 'jaro'
		? { year: season.year, half: 'podzim' }
		: { year: season.year + 1, half: 'jaro' };
}

export function isSamePSMFSeason(season1: IPSMFSeason, season2: IPSMFSeason) {
	return season1.year === season2.year && season1.half === season2.half;
}

export function formatPSMFSeasonLabel(season: IPSMFSeason) {
	return `${season.half === 'jaro' ? 'Jarní' : 'Podzimní'} ${season.year}`;
}

export function buildPSMFSeasonKey(season: IPSMFSeason) {
	return `${season.year}-${season.half}`;
}

export function parsePSMFSeasonKey(seasonKey: string): IPSMFSeason | null {
	const match = seasonKey.match(/^(?<year>\d{4})-(?<half>jaro|podzim)$/);
	if (!match?.groups) {
		return null;
	}
	return {
		year: Number(match.groups.year),
		half: match.groups.half as PSMFSeasonHalf,
	};
}

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
