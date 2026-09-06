import * as firestore from '@firebase/firestore';
import { JSDOM } from 'jsdom';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initFirebase } from '../Model/firebaseFacade';
import {
	buildPSMFSeasonKey,
	formatPSMFSeasonLabel,
	getCurrentPSMFSeason,
	IPSMFSeason,
	IPSMFSeasonHistoryCacheDocument,
	parsePSMFSeasonKey,
} from '../Model/psmfMatchHistoryFacade';
import { collectRelevantDetailLines, collectRelevantDetailTables, extractScorers, parseTeamPageMatches } from '../Model/psmfMatchHistoryParser';

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
	const searchDom = createDom(searchHtml);
	const teamPagePath = getSeasonTeamPagePath(searchDom.window.document, seasonKey);
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
	const teamPageDom = createDom(teamPageHtml);
	const matches = parseTeamPageMatches(teamPageDom.window.document, teamPagePath);
	const matchesWithDetails = await Promise.all(matches.map(async (match) => {
		if (!match.detailPath || !match.score) {
			return match;
		}
		try {
			const detailHtml = await fetchHtml(new URL(match.detailPath, PSMF_BASE_URL).toString());
			const detailDom = createDom(detailHtml);
			return {
				...match,
				scorers: extractScorers(detailDom.window.document, match),
				raw: {
					...match.raw,
					detailTitle: normalizeText(detailDom.window.document.querySelector('.component--title .component__title, h1')?.textContent),
					detailLines: collectRelevantDetailLines(detailDom.window.document, match),
					detailTables: collectRelevantDetailTables(detailDom.window.document, match),
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

function createDom(html: string) {
	return new JSDOM(html);
}

function getSeasonTeamPagePath(document: Document, seasonKey: string) {
	const listItems = [...document.querySelectorAll<HTMLLIElement>('section.component--content .container .component__wrap .component__text .search-content ul li')];
	for (const listItem of listItems) {
		const href = listItem.querySelector<HTMLAnchorElement>('a')?.getAttribute('href');
		if (!href) {
			continue;
		}
		const tournamentGroupPath = getTournamentGroupPath(href);
		if (!tournamentGroupPath) {
			continue;
		}
		if (getSeasonKeyFromTournament(tournamentGroupPath.tournament) === seasonKey) {
			return tournamentGroupPath.teamPagePath;
		}
	}
	return undefined;
}

function getTournamentGroupPath(path: string) {
	const pathname = new URL(path, PSMF_BASE_URL).pathname;
	const match = pathname.match(/^\/souteze\/(?<tournament>[^/]+)\/(?<group>[^/]+)\/tymy\/(?<teamCode>[^/]+)\/?$/);
	if (!match?.groups || match.groups.teamCode !== 'catchers-sc') {
		return null;
	}
	return {
		tournament: match.groups.tournament,
		group: match.groups.group,
		teamPagePath: pathname.endsWith('/') ? pathname : `${pathname}/`,
	};
}

function getSeasonKeyFromTournament(tournament: string) {
	const yearMatch = tournament.match(/(?<year>\d{4})/);
	if (!yearMatch?.groups?.year) {
		return null;
	}
	const half = /podzim/i.test(tournament) ? 'podzim' : /jaro/i.test(tournament) ? 'jaro' : null;
	if (!half) {
		return null;
	}
	return `${yearMatch.groups.year}-${half}`;
}

function normalizeText(value: string | null | undefined) {
	return (value ?? '')
		.replace(/&nbsp;/g, ' ')
		.replace(/\u00a0/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}
