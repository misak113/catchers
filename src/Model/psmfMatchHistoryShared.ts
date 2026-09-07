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

export interface IPSMFHistoricalStatsCategory {
	key: string;
	title: string;
	sourcePath: string;
	tables: IPSMFHistoricalRawTable[];
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
		sourcePath?: string;
		groupResultGameId?: string;
		groupResultRound?: string;
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
		groupPagePath?: string;
		groupPageUrl?: string;
		resultPaths?: string[];
		statsPaths?: string[];
		fromCache?: boolean;
		stale?: boolean;
		errorMessage?: string;
	};
	matches: IPSMFHistoricalMatch[];
	statsCategories?: IPSMFHistoricalStatsCategory[];
}

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
