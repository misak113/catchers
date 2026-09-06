import * as firestore from '@firebase/firestore';
import { JSDOM } from 'jsdom';
import moment from 'moment-timezone';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import config from '../config.json';
import { initFirebase } from '../Model/firebaseFacade';
import {
	buildPSMFSeasonKey,
	formatPSMFSeasonLabel,
	getCurrentPSMFSeason,
	IPSMFHistoricalMatch,
	IPSMFHistoricalRawTable,
	IPSMFHistoricalScorer,
	IPSMFSeason,
	IPSMFSeasonHistoryCacheDocument,
	parsePSMFSeasonKey,
} from '../Model/psmfMatchHistoryFacade';

const MATCH_HISTORY_COLLECTION = 'psmfMatchHistory';
const PSMF_BASE_URL = 'https://www.psmf.cz';
const TEAM_QUERY_NAME = 'Catchers+SC';
const TEAM_CODE_NAME = 'catchers-sc';
const CACHE_VERSION = 1;
const CURRENT_SEASON_REFRESH_AGE_MS = 12 * 60 * 60 * 1e3;
const SEARCH_URL = `${PSMF_BASE_URL}/vyhledavani/?query=${TEAM_QUERY_NAME}`;
const MATCH_ROW_SELECTOR = 'section.component--opener table.games-new-table tr';
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

type GoalBlock = {
	title?: string;
	lines: string[];
	columns?: { side: 'home' | 'guest' | 'unknown'; lines: string[] }[];
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
	const firebaseApp = await initFirebase();
	const historyCollection = firestore.collection(firestore.getFirestore(firebaseApp), MATCH_HISTORY_COLLECTION) as firestore.CollectionReference<CachedHistoryDocument>;
	const historyDocRef = firestore.doc(historyCollection, seasonKey);
	const cachedDoc = await firestore.getDoc(historyDocRef);
	const currentSeasonKey = buildPSMFSeasonKey(currentSeason);

	if (cachedDoc.exists()) {
		const cachedData = cachedDoc.data();
		if (!shouldRefreshCache(cachedData, seasonKey === currentSeasonKey)) {
			res.status(200).json({
				...cachedData,
				source: {
					...cachedData.source,
					fromCache: true,
				},
			});
			return;
		}
	}

	try {
		const seasonHistory = await loadSeasonHistory(requestedSeason);
		await firestore.setDoc(historyDocRef, seasonHistory);
		res.status(200).json(seasonHistory);
	} catch (error) {
		if (cachedDoc.exists()) {
			const cachedData = cachedDoc.data();
			res.status(200).json({
				...cachedData,
				source: {
					...cachedData.source,
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
	if (!match?.groups || match.groups.teamCode !== TEAM_CODE_NAME) {
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

function parseTeamPageMatches(document: Document, teamPagePath: string): IPSMFHistoricalMatch[] {
	const tournamentGroup = getTournamentGroupPath(teamPagePath);
	if (!tournamentGroup) {
		return [];
	}
	const rows = [...document.querySelectorAll<HTMLTableRowElement>(MATCH_ROW_SELECTOR)];
	return rows.map((row, index) => parseTeamPageMatchRow(row, tournamentGroup.tournament, tournamentGroup.group, index))
		.filter((match): match is IPSMFHistoricalMatch => Boolean(match));
}

function parseTeamPageMatchRow(row: HTMLTableRowElement, tournament: string, group: string, index: number) {
	const cells = [...row.querySelectorAll<HTMLTableCellElement>('td')];
	if (cells.length < 4) {
		return null;
	}

	const startsAt = parseMatchStartsAt(
		normalizeText(cells[0]?.innerHTML),
		normalizeText(cells[1]?.textContent),
	);
	const teamAnchors = [...row.querySelectorAll<HTMLAnchorElement>('td:nth-child(4) a[href^="/souteze/"]')];
	const homeTeam = parseTeamAnchor(teamAnchors[0]);
	const guestTeam = parseTeamAnchor(teamAnchors[1]);
	if (!startsAt || !homeTeam?.code || !guestTeam?.code) {
		return null;
	}

	const isCatchersHome = homeTeam.code === TEAM_CODE_NAME;
	const opponent = isCatchersHome ? guestTeam : homeTeam;
	const rowCells = cells.map((cell) => normalizeText(cell.textContent));
	const detailPath = getDetailPath(row);
	const scoreCell = rowCells.find((cellText) => Boolean(parseScore(cellText)));
	const score = scoreCell ? parseScore(scoreCell) : undefined;
	const matchId = detailPath?.match(/\/zapas\/(?<matchId>[^/?#]+)/)?.groups?.matchId ?? `${tournament}-${group}-${index}`;

	return {
		id: matchId,
		startsAtIso: startsAt.toISOString(),
		tournament,
		group,
		field: normalizeText(cells[2]?.textContent) || undefined,
		round: getRoundLabel(rowCells),
		opponentCode: opponent.code,
		opponentName: opponent.name || opponent.code,
		homeTeamCode: homeTeam.code,
		homeTeamName: homeTeam.name,
		guestTeamCode: guestTeam.code,
		guestTeamName: guestTeam.name,
		detailPath,
		score,
		status: score ? 'finished' : startsAt.getTime() < Date.now() ? 'playedWithoutScore' : 'scheduled',
		scorers: [],
		raw: {
			rowCells,
			scoreCell: scoreCell || undefined,
		},
	};
}

function parseMatchStartsAt(dateCellHtml: string, timeCellText: string) {
	const dateText = dateCellHtml.split('&nbsp;').pop() ?? dateCellHtml;
	const parts = dateText.split('.').map((part) => part.trim()).filter(Boolean);
	if (parts.length < 3 || !timeCellText) {
		return null;
	}
	const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
	const dateIso = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T${timeCellText.padStart(5, '0')}`;
	const startsAt = moment.tz(dateIso, config.timezone);
	return startsAt.isValid() ? startsAt.toDate() : null;
}

function parseTeamAnchor(anchor: HTMLAnchorElement | undefined) {
	if (!anchor) {
		return null;
	}
	const href = anchor.getAttribute('href');
	const pathname = href ? new URL(href, PSMF_BASE_URL).pathname : '';
	const code = pathname.split('/').filter(Boolean).pop();
	return {
		code,
		name: normalizeText(anchor.textContent) || code,
	};
}

function getDetailPath(row: HTMLTableRowElement) {
	const detailHref = [...row.querySelectorAll<HTMLAnchorElement>('a')]
		.map((anchor) => anchor.getAttribute('href'))
		.find((href) => Boolean(href && /\/zapas\//.test(href)));
	if (!detailHref) {
		return undefined;
	}
	return new URL(detailHref, PSMF_BASE_URL).pathname;
}

function getRoundLabel(rowCells: string[]) {
	return rowCells.find((cell) => /^\d+\.$/.test(cell)) || undefined;
}

function parseScore(value: string) {
	const match = value.match(/(?<home>\d+)\s*:\s*(?<guest>\d+)/);
	if (!match?.groups) {
		return null;
	}
	return {
		home: Number(match.groups.home),
		guest: Number(match.groups.guest),
		raw: `${match.groups.home}:${match.groups.guest}`,
	};
}

function extractScorers(document: Document, match: IPSMFHistoricalMatch) {
	const goalBlocks = collectGoalBlocks(document, match);
	const scorers: IPSMFHistoricalScorer[] = [];

	for (const block of goalBlocks) {
		if (block.columns && block.columns.length > 0) {
			for (const column of block.columns) {
				for (const line of column.lines) {
					scorers.push(...parseScorerLine(line, column.side));
				}
			}
			continue;
		}
		const teamSide = getSideFromText(block.title, match);
		for (const line of block.lines) {
			scorers.push(...parseScorerLine(line, teamSide));
		}
	}

	return scorers.filter((scorer, index, array) => {
		return array.findIndex((candidate) =>
			candidate.playerName === scorer.playerName
			&& candidate.minute === scorer.minute
			&& candidate.teamSide === scorer.teamSide
			&& candidate.rawText === scorer.rawText
		) === index;
	});
}

function collectGoalBlocks(document: Document, match: IPSMFHistoricalMatch): GoalBlock[] {
	const blocks: GoalBlock[] = [];
	for (const table of document.querySelectorAll<HTMLTableElement>('table')) {
		const tableText = normalizeText(table.textContent).toLowerCase();
		if (!tableText || !/gól|brank|střelec/.test(tableText)) {
			continue;
		}
		const rows = [...table.querySelectorAll<HTMLTableRowElement>('tr')];
		if (rows.length < 1) {
			continue;
		}
		const headerRow = rows[0];
		const headerCells = [...headerRow.querySelectorAll<HTMLTableCellElement | HTMLTableHeaderCellElement>('td,th')]
			.map((cell) => normalizeText(cell.textContent));
		const columnSides = headerCells.map((headerCell) => getSideFromText(headerCell, match));
		const columns = columnSides.map((side, index) => ({
			side,
			lines: rows.slice(1).flatMap((row) => {
				const cell = [...row.querySelectorAll<HTMLTableCellElement | HTMLTableHeaderCellElement>('td,th')][index];
				return cell ? splitHtmlLines(cell.innerHTML) : [];
			}).filter(Boolean),
		})).filter((column) => column.lines.length > 0);
		blocks.push({
			title: headerCells.join(' | '),
			lines: rows.flatMap((row) => [...row.querySelectorAll<HTMLTableCellElement | HTMLTableHeaderCellElement>('td,th')].flatMap((cell) => splitHtmlLines(cell.innerHTML))),
			columns,
		});
	}

	if (blocks.length > 0) {
		return blocks;
	}

	return [...document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,strong')]
		.filter((heading) => /gól|brank|střelec/i.test(normalizeText(heading.textContent)))
		.map((heading) => {
			const lines: string[] = [];
			let currentElement = heading.nextElementSibling;
			while (currentElement && !/^H[1-4]$/i.test(currentElement.tagName)) {
				lines.push(...splitHtmlLines(currentElement.innerHTML));
				currentElement = currentElement.nextElementSibling as HTMLElement | null;
			}
			return {
				title: normalizeText(heading.textContent),
				lines,
			};
		})
		.filter((block) => block.lines.length > 0);
}

function parseScorerLine(line: string, teamSide: 'home' | 'guest' | 'unknown') {
	const cleanedLine = normalizeText(line)
		.replace(/^[•·\-–—]\s*/, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!cleanedLine || /gól|brank|střelec/i.test(cleanedLine) || /^\d+\s*:\s*\d+$/.test(cleanedLine)) {
		return [];
	}

	const linesToParse = cleanedLine.split(/\s{2,}|;\s*/).map((part) => part.trim()).filter(Boolean);
	return linesToParse.flatMap((value) => {
		const minuteMatches = [...value.matchAll(/\b(?<minute>\d{1,3})\./g)];
		if (minuteMatches.length > 0) {
			const minutes = minuteMatches.map((match) => Number(match.groups?.minute)).filter((minute) => Number.isFinite(minute));
			const playerName = normalizeText(value.replace(/\b\d{1,3}\./g, '').replace(/[(),]/g, ' ')).trim();
			if (!playerName) {
				return [];
			}
			return minutes.map((minute) => ({
				playerName,
				minute,
				rawMinute: `${minute}.`,
				teamSide,
				rawText: value,
			}));
		}

		const minuteAtEnd = value.match(/^(?<player>.+?)\s+(?<minutes>\d{1,3}(?:\s*,\s*\d{1,3})*)$/);
		if (minuteAtEnd?.groups) {
			const playerName = normalizeText(minuteAtEnd.groups.player);
			return minuteAtEnd.groups.minutes.split(',').map((minuteValue) => {
				const minute = Number(minuteValue.trim());
				return {
					playerName,
					minute,
					rawMinute: minuteValue.trim(),
					teamSide,
					rawText: value,
				};
			});
		}

		return [{
			playerName: value,
			teamSide,
			rawText: value,
		}];
	});
}

function collectRelevantDetailLines(document: Document, match: IPSMFHistoricalMatch) {
	const detailText = normalizeText(document.body.textContent);
	return detailText
		.split(/\s{2,}/)
		.map((line) => line.trim())
		.filter((line) => line.length > 2)
		.filter((line) => {
			const lowerLine = line.toLowerCase();
			return /gól|brank|žlut|červen|karta|střelec/.test(lowerLine)
				|| lowerLine.includes((match.homeTeamName || '').toLowerCase())
				|| lowerLine.includes((match.guestTeamName || '').toLowerCase());
		})
		.slice(0, 30);
}

function collectRelevantDetailTables(document: Document, match: IPSMFHistoricalMatch): IPSMFHistoricalRawTable[] {
	return [...document.querySelectorAll<HTMLTableElement>('table')]
		.map((table) => {
			const rows = [...table.querySelectorAll<HTMLTableRowElement>('tr')]
				.map((row) => [...row.querySelectorAll<HTMLTableCellElement | HTMLTableHeaderCellElement>('td,th')]
					.map((cell) => normalizeText(cell.textContent))
					.filter(Boolean))
				.filter((row) => row.length > 0);
			const flattened = rows.flat().join(' ').toLowerCase();
			if (!flattened) {
				return null;
			}
			const hasRelevantContent = /gól|brank|žlut|červen|karta|střelec/.test(flattened)
				|| flattened.includes((match.homeTeamName || '').toLowerCase())
				|| flattened.includes((match.guestTeamName || '').toLowerCase());
			if (!hasRelevantContent) {
				return null;
			}
			const title = normalizeText(table.previousElementSibling?.textContent);
			return {
				title: title || undefined,
				rows: rows.slice(0, 20),
			};
		})
		.filter((table): table is IPSMFHistoricalRawTable => Boolean(table))
		.slice(0, 6);
}

function getSideFromText(value: string | undefined, match: IPSMFHistoricalMatch): 'home' | 'guest' | 'unknown' {
	const normalizedValue = normalizeText(value).toLowerCase();
	if (!normalizedValue) {
		return 'unknown';
	}
	if (normalizedValue.includes('domác')) {
		return 'home';
	}
	if (normalizedValue.includes('host')) {
		return 'guest';
	}
	if (match.homeTeamName && normalizedValue.includes(match.homeTeamName.toLowerCase())) {
		return 'home';
	}
	if (match.guestTeamName && normalizedValue.includes(match.guestTeamName.toLowerCase())) {
		return 'guest';
	}
	if (match.homeTeamCode && normalizedValue.includes(match.homeTeamCode.toLowerCase())) {
		return 'home';
	}
	if (match.guestTeamCode && normalizedValue.includes(match.guestTeamCode.toLowerCase())) {
		return 'guest';
	}
	return 'unknown';
}

function splitHtmlLines(html: string) {
	return html
		.split(/<br\s*\/?>/i)
		.map((line) => normalizeText(line.replace(/<[^>]+>/g, ' ')))
		.filter(Boolean);
}

function normalizeText(value: string | null | undefined) {
	return (value ?? '')
		.replace(/&nbsp;/g, ' ')
		.replace(/\u00a0/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}
