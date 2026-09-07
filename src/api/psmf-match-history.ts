import * as firestore from '@firebase/firestore';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initFirebase } from '../Model/firebaseFacade';
import {
	buildPSMFSeasonKey,
	formatPSMFSeasonLabel,
	getCurrentPSMFSeason,
	IPSMFHistoricalMatch,
	IPSMFHistoricalStatsCategory,
	IPSMFSeason,
	IPSMFSeasonHistoryCacheDocument,
	parsePSMFSeasonKey,
} from '../Model/psmfMatchHistoryShared';
import {
	getGroupPagePath,
	parseGroupPageMatches,
	getSeasonPagePath,
	getSeasonTeamPagePath,
	parseGroupPageResultPaths,
	parseRoundResults,
	parseStatsCategories,
	parseStatsCategoryTables,
	parseTeamPageMatches,
} from '../Model/psmfMatchHistoryParser';
import { omitUndefinedDeep } from '../Util/object';

const MATCH_HISTORY_COLLECTION = 'psmfMatchHistory';
const PSMF_BASE_URL = 'https://www.psmf.cz';
const TEAM_QUERY_NAME = 'Catchers+SC';
const CACHE_VERSION = 1;
const CURRENT_SEASON_REFRESH_AGE_MS = 12 * 60 * 60 * 1e3;
const SEARCH_URL = `${PSMF_BASE_URL}/vyhledavani/?query=${TEAM_QUERY_NAME}`;
const PSMF_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
	'Accept-Language': 'cs,en;q=0.9',
	'Cache-Control': 'no-cache',
	'Pragma': 'no-cache',
};

type CachedHistoryDocument = Omit<IPSMFSeasonHistoryCacheDocument, 'season'> & {
	season: IPSMFSeason;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'GET') {
		res.setHeader('Allow', 'GET');
		res.status(405).json({ error: 'Method not allowed' });
		return;
	}

	const currentSeason = getCurrentPSMFSeason();
	const requestedSeason = typeof req.query.season === 'string'
		? parsePSMFSeasonKey(req.query.season)
		: currentSeason;
	if (!requestedSeason) {
		res.status(400).json({ error: 'Invalid season key' });
		return;
	}

	const seasonKey = buildPSMFSeasonKey(requestedSeason);
	const currentSeasonKey = buildPSMFSeasonKey(currentSeason);
	const cache = await getHistoryCacheDocument(seasonKey);

	if (cache.cachedData && !shouldRefreshCache(cache.cachedData, seasonKey === currentSeasonKey)) {
		res.status(200).json({
			...cache.cachedData,
			source: {
				...cache.cachedData.source,
				fromCache: true,
			},
		});
		return;
	}

	try {
		const seasonHistory = await loadSeasonHistory(requestedSeason);
		if (cache.historyDocRef) {
			await firestore.setDoc(cache.historyDocRef, omitUndefinedDeep(seasonHistory));
		}
		res.status(200).json(seasonHistory);
	} catch (error) {
		if (cache.cachedData) {
			res.status(200).json({
				...cache.cachedData,
				source: {
					...cache.cachedData.source,
					fromCache: true,
					stale: true,
					errorMessage: error instanceof Error ? error.message : 'Nepodařilo se obnovit historii zápasů.',
				},
			});
			return;
		}

		console.error('Failed to load PSMF match history', error);
		res.status(500).json({ error: error instanceof Error ? error.message : 'Nepodařilo se načíst historii zápasů.' });
	}
}

async function getHistoryCacheDocument(seasonKey: string) {
	try {
		const firebaseApp = await initFirebase();
		const historyCollection = firestore.collection(firestore.getFirestore(firebaseApp), MATCH_HISTORY_COLLECTION) as firestore.CollectionReference<CachedHistoryDocument>;
		const historyDocRef = firestore.doc(historyCollection, seasonKey);
		const cachedDoc = await firestore.getDoc(historyDocRef);
		return {
			historyDocRef,
			cachedData: cachedDoc.exists() ? cachedDoc.data() : null,
		};
	} catch (error) {
		console.warn('PSMF history cache unavailable, continuing without shared cache', error instanceof Error ? error.message : error);
		return {
			historyDocRef: null,
			cachedData: null,
		};
	}
}

export function shouldRefreshCache(cache: CachedHistoryDocument, isCurrentSeason: boolean) {
	if (cache.source.cacheVersion !== CACHE_VERSION) {
		return true;
	}
	if (!isCurrentSeason) {
		return false;
	}
	if (cache.matches.length < 1 || cache.matches.every((match) => !match.score)) {
		return true;
	}
	const fetchedAt = Date.parse(cache.fetchedAtIso);
	return Number.isNaN(fetchedAt) || Date.now() - fetchedAt > CURRENT_SEASON_REFRESH_AGE_MS;
}

async function loadSeasonHistory(season: IPSMFSeason): Promise<CachedHistoryDocument> {
	const seasonKey = buildPSMFSeasonKey(season);
	const searchHtml = await fetchHtml(SEARCH_URL);
	const teamPagePath = getSeasonTeamPagePath(searchHtml, seasonKey);
	if (!teamPagePath) {
		return {
			seasonKey,
			seasonLabel: formatPSMFSeasonLabel(season),
			season,
			fetchedAtIso: new Date().toISOString(),
			source: {
				cacheVersion: CACHE_VERSION,
				searchUrl: SEARCH_URL,
			},
			matches: [],
		};
	}

	const teamPageUrl = new URL(teamPagePath, PSMF_BASE_URL).toString();
	const teamPageHtml = await fetchHtml(teamPageUrl);
	const groupPagePath = getGroupPagePath(teamPagePath);
	const seasonPagePath = getSeasonPagePath(teamPagePath);
	const [groupPageHtml, seasonPageHtml] = await Promise.all([
		groupPagePath ? fetchHtml(new URL(groupPagePath, PSMF_BASE_URL).toString()) : Promise.resolve(''),
		seasonPagePath ? fetchHtml(new URL(seasonPagePath, PSMF_BASE_URL).toString()) : Promise.resolve(''),
	]);
	const teamMatches = parseTeamPageMatches(teamPageHtml, teamPagePath);
	const groupMatches = groupPageHtml && groupPagePath ? parseGroupPageMatches(groupPageHtml, groupPagePath) : [];
	const resultPaths = groupPageHtml ? parseGroupPageResultPaths(groupPageHtml) : [];
	const roundMatches = await loadRoundMatches(resultPaths, groupPagePath);
	const statsCategories = seasonPageHtml ? await loadStatsCategories(seasonPageHtml) : [];
	const matches = mergeMatches(teamMatches, mergeMatches(groupMatches, roundMatches));

	return {
		seasonKey,
		seasonLabel: formatPSMFSeasonLabel(season),
		season,
		fetchedAtIso: new Date().toISOString(),
		source: {
			cacheVersion: CACHE_VERSION,
			searchUrl: SEARCH_URL,
			teamPagePath,
			teamPageUrl,
			groupPagePath,
			groupPageUrl: groupPagePath ? new URL(groupPagePath, PSMF_BASE_URL).toString() : undefined,
			resultPaths: resultPaths.length > 0 ? resultPaths : undefined,
			statsPaths: statsCategories.length > 0 ? statsCategories.map((category) => category.sourcePath) : undefined,
		},
		matches,
		statsCategories: statsCategories.length > 0 ? statsCategories : undefined,
	};
}

async function fetchHtml(url: string) {
	const response = await fetch(url, {
		headers: PSMF_HEADERS,
	});
	if (!response.ok) {
		throw new Error(`PSMF request failed for ${url} with status ${response.status}`);
	}
	return response.text();
}

async function loadRoundMatches(resultPaths: string[], groupPagePath: string | undefined) {
	if (!groupPagePath || resultPaths.length < 1) {
		return [];
	}
	const roundMatches = await Promise.all(resultPaths.map(async (resultPath) => {
		try {
			const responseText = await fetchHtml(new URL(resultPath, PSMF_BASE_URL).toString());
			return parseRoundResults(responseText, groupPagePath);
		} catch (error) {
			console.error('Failed to load PSMF round results', resultPath, error);
			return [];
		}
	}));
	return roundMatches.flat();
}

async function loadStatsCategories(seasonPageHtml: string): Promise<IPSMFHistoricalStatsCategory[]> {
	const categories = parseStatsCategories(seasonPageHtml);
	const loadedCategories = await Promise.all(categories.map(async (category) => {
		try {
			const statsHtml = await fetchHtml(new URL(category.sourcePath, PSMF_BASE_URL).toString());
			return parseStatsCategoryTables(statsHtml, category);
		} catch (error) {
			console.error('Failed to load PSMF stats category', category.sourcePath, error);
			return {
				...category,
				tables: [],
			};
		}
	}));
	return loadedCategories.filter((category) => category.tables.length > 0);
}

function mergeMatches(teamMatches: IPSMFHistoricalMatch[], roundMatches: IPSMFHistoricalMatch[]) {
	const matchesByKey = new Map<string, IPSMFHistoricalMatch>();
	for (const match of roundMatches) {
		matchesByKey.set(getMatchMergeKey(match), match);
	}
	for (const match of teamMatches) {
		const key = getMatchMergeKey(match);
		const existingMatch = matchesByKey.get(key);
		matchesByKey.set(key, existingMatch ? mergeMatch(existingMatch, match) : match);
	}
	return [...matchesByKey.values()].sort((match1, match2) => Date.parse(match1.startsAtIso) - Date.parse(match2.startsAtIso));
}

function getMatchMergeKey(match: IPSMFHistoricalMatch) {
	return [
		match.round || '',
		match.startsAtIso,
		match.homeTeamCode || '',
		match.guestTeamCode || '',
		match.opponentCode,
	].join('|');
}

function mergeMatch(preferredMatch: IPSMFHistoricalMatch, fallbackMatch: IPSMFHistoricalMatch): IPSMFHistoricalMatch {
	return {
		...fallbackMatch,
		...preferredMatch,
		field: preferredMatch.field || fallbackMatch.field,
		round: preferredMatch.round || fallbackMatch.round,
		opponentName: preferredMatch.opponentName || fallbackMatch.opponentName,
		homeTeamName: preferredMatch.homeTeamName || fallbackMatch.homeTeamName,
		guestTeamName: preferredMatch.guestTeamName || fallbackMatch.guestTeamName,
		detailPath: preferredMatch.detailPath || fallbackMatch.detailPath,
		score: preferredMatch.score || fallbackMatch.score,
		status: preferredMatch.score
			? preferredMatch.status
			: fallbackMatch.score
				? fallbackMatch.status
				: preferredMatch.status,
		scorers: preferredMatch.scorers.length > 0 ? preferredMatch.scorers : fallbackMatch.scorers,
		raw: {
			...fallbackMatch.raw,
			...preferredMatch.raw,
			rowCells: preferredMatch.raw.rowCells.length > 0 ? preferredMatch.raw.rowCells : fallbackMatch.raw.rowCells,
		},
	};
}
