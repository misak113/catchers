import * as firestore from '@firebase/firestore';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initFirebase } from '../Model/firebaseFacade';
import {
	buildPSMFSeasonKey,
	formatPSMFSeasonLabel,
	getCurrentPSMFSeason,
	IPSMFSeason,
	IPSMFSeasonHistoryCacheDocument,
	parsePSMFSeasonKey,
} from '../Model/psmfMatchHistoryShared';
import { extractMatchDetailData, getSeasonTeamPagePath, parseTeamPageMatches } from '../Model/psmfMatchHistoryParser';

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
			await firestore.setDoc(cache.historyDocRef, seasonHistory);
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

function shouldRefreshCache(cache: CachedHistoryDocument, isCurrentSeason: boolean) {
	if (cache.source.cacheVersion !== CACHE_VERSION) {
		return true;
	}
	if (!isCurrentSeason) {
		return false;
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
	const matches = parseTeamPageMatches(teamPageHtml, teamPagePath);
	const matchesWithDetails = await Promise.all(matches.map(async (match) => {
		if (!match.detailPath || !match.score) {
			return match;
		}
		try {
			const detailHtml = await fetchHtml(new URL(match.detailPath, PSMF_BASE_URL).toString());
			const detailData = extractMatchDetailData(detailHtml, match);
			return {
				...match,
				scorers: detailData.scorers,
				raw: {
					...match.raw,
					detailTitle: detailData.detailTitle,
					detailLines: detailData.detailLines,
					detailTables: detailData.detailTables,
				},
			};
		} catch (error) {
			console.error('Failed to load PSMF match detail', match.detailPath, error);
			return match;
		}
	}));

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
		},
		matches: matchesWithDetails,
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
