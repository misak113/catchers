import moment from 'moment-timezone';
import config from '../config.json';
import { IPSMFHistoricalMatch, IPSMFHistoricalRawTable, IPSMFHistoricalScorer, IPSMFHistoricalStatsCategory } from './psmfMatchHistoryShared';

const PSMF_BASE_URL = 'https://www.psmf.cz';
const TEAM_CODE_NAME = 'catchers-sc';

export function getSeasonTeamPagePath(searchHtml: string, seasonKey: string) {
	const teamPaths = matchAll(searchHtml, /href=["'](?<href>[^"']*\/souteze\/[^"']+\/[^"']+\/tymy\/catchers-sc\/?)["']/gi)
		.map((match) => match.groups?.href)
		.filter((href): href is string => Boolean(href));

	for (const href of teamPaths) {
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

export function parseTeamPageMatches(teamPageHtml: string, teamPagePath: string): IPSMFHistoricalMatch[] {
	const tournamentGroup = getTournamentGroupPath(teamPagePath);
	if (!tournamentGroup) {
		return [];
	}

	const tableHtml = extractTableByClass(teamPageHtml, 'games-new-table');
	if (!tableHtml) {
		return [];
	}

	return extractRows(tableHtml)
		.map((rowHtml, index) => parseMatchRow(rowHtml, {
			tournament: tournamentGroup.tournament,
			group: tournamentGroup.group,
			index,
			sourcePath: tournamentGroup.teamPagePath,
		}))
		.filter((match): match is IPSMFHistoricalMatch => Boolean(match));
}

export function getGroupPagePath(teamPagePath: string) {
	const tournamentGroup = getTournamentGroupPath(teamPagePath);
	if (!tournamentGroup) {
		return undefined;
	}
	return `/souteze/${tournamentGroup.tournament}/${tournamentGroup.group}/`;
}

export function getSeasonPagePath(teamPagePath: string) {
	const tournamentGroup = getTournamentGroupPath(teamPagePath);
	if (!tournamentGroup) {
		return undefined;
	}
	return `/souteze/${tournamentGroup.tournament}/`;
}

export function parseGroupPageResultPaths(groupPageHtml: string) {
	return uniqueStrings(
		matchAll(groupPageHtml, /<a\b[^>]*class=["'][^"']*results-action[^"']*["'][^>]*data-url=["'](?<path>[^"']+)["'][^>]*>/gi)
			.map((match) => decodePath(match.groups?.path))
			.filter((path): path is string => Boolean(path))
	);
}

export function parseGroupPageOldMatchPaths(groupPageHtml: string) {
	return uniqueStrings(
		matchAll(groupPageHtml, /<a\b[^>]*class=["'][^"']*games-action[^"']*["'][^>]*data-gtype=["']old["'][^>]*data-url=["'](?<path>[^"']+)["'][^>]*>/gi)
			.map((match) => decodePath(match.groups?.path))
			.filter((path): path is string => Boolean(path))
	);
}

export function parseGroupPageMatches(groupPageHtml: string, groupPagePath: string) {
	const tournamentGroup = getGroupTournamentPath(groupPagePath);
	if (!tournamentGroup) {
		return [];
	}
	const parsedMatches: Array<IPSMFHistoricalMatch | null> = extractRows(groupPageHtml)
		.map((rowHtml, index) => parseGroupPageMatchRow(rowHtml, {
			tournament: tournamentGroup.tournament,
			group: tournamentGroup.group,
			index,
			sourcePath: groupPagePath,
		}));
	return parsedMatches.filter((match): match is IPSMFHistoricalMatch => Boolean(match));
}

export function parseOldMatchPage(responseText: string, groupPagePath: string) {
	const payloadHtml = unwrapHtmlPayload(responseText);
	return {
		matches: parseGroupPageMatches(payloadHtml, groupPagePath),
		nextPath: parseOldMatchMorePath(payloadHtml),
	};
}

export function parseStatsCategories(html: string) {
	return uniqueBy(
		matchAll(html, /<a\b[^>]*class=["'][^"']*stats-action[^"']*["'][^>]*data-url=["'](?<path>[^"']+)["'][^>]*>(?<title>[\s\S]*?)<\/a>/gi)
			.map((match) => {
				const path = decodePath(match.groups?.path);
				if (!path) {
					return null;
				}
				return {
					key: getStatsCategoryKey(path),
					title: stripAndDecode(match.groups?.title || '') || 'Statistiky',
					sourcePath: path,
				};
			})
			.filter((category): category is Pick<IPSMFHistoricalStatsCategory, 'key' | 'title' | 'sourcePath'> => Boolean(category)),
		(category) => category.sourcePath
	);
}

export function parseStatsCategoryTables(statsHtml: string, category: Pick<IPSMFHistoricalStatsCategory, 'key' | 'title' | 'sourcePath'>): IPSMFHistoricalStatsCategory {
	const payloadHtml = unwrapHtmlPayload(statsHtml);
	return {
		...category,
		tables: extractTables(payloadHtml)
			.map(({ tableHtml, previousHeadingHtml }) => ({
				title: previousHeadingHtml ? stripAndDecode(previousHeadingHtml) || undefined : undefined,
				rows: extractRows(tableHtml)
					.map((rowHtml) => extractHeaderOrCells(rowHtml).map(stripAndDecode).filter(Boolean))
					.filter((row) => row.length > 0),
			}))
			.filter((table) => table.rows.length > 0),
	};
}

function parseGroupPageMatchRow(rowHtml: string, options: ParseMatchRowOptions) {
	const cells = extractCells(rowHtml);
	if (cells.length < 6 || !cells.some((cell) => Boolean(parseScore(stripAndDecode(cell))))) {
		return null;
	}
	const infoLinkHtml = matchAll(rowHtml, /<a\b[^>]*class=["'][^"']*game-result-info-link[^"']*["'][^>]*>/gi)[0]?.[0];
	const match = parseMatchRow(rowHtml, {
		...options,
		matchId: readAttribute(infoLinkHtml || rowHtml, 'data-gameid') || options.matchId,
	});
	if (!match) {
		return null;
	}
	return {
		...match,
		raw: {
			...match.raw,
			groupResultGameId: readAttribute(infoLinkHtml || rowHtml, 'data-gameid') || match.raw.groupResultGameId,
			groupResultRound: readAttribute(infoLinkHtml || rowHtml, 'data-round') || match.raw.groupResultRound,
		},
	};
}

function parseOldMatchMorePath(html: string) {
	return decodePath(matchAll(html, /<a\b[^>]*class=["'][^"']*games-old-more[^"']*["'][^>]*data-url=["'](?<path>[^"']+)["'][^>]*>/gi)[0]?.groups?.path);
}

export function parseRoundResults(responseText: string, groupPagePath: string): IPSMFHistoricalMatch[] {
	const tournamentGroup = getGroupTournamentPath(groupPagePath);
	if (!tournamentGroup) {
		return [];
	}
	const payloadHtml = unwrapHtmlPayload(responseText);
	const parsedMatches: Array<IPSMFHistoricalMatch | null> = matchAll(payloadHtml, /<div\b[^>]*id=["']GameResultItem(?<gameId>\d+)["'][^>]*>(?<content>[\s\S]*?)(?=<div\b[^>]*id=["']GameResultItem\d+["']|$)/gi)
		.map((blockMatch, index) => {
			const gameId = blockMatch.groups?.gameId;
			const blockHtml = blockMatch[0];
			const match = parseResultBlock(blockHtml, {
				tournament: tournamentGroup.tournament,
				group: tournamentGroup.group,
				index,
				matchId: gameId,
				sourcePath: groupPagePath,
			});
			if (!match) {
				return null;
			}
			const detailData = extractMatchDetailData(blockHtml, match);
			return {
				...match,
				scorers: detailData.scorers,
				raw: {
					...match.raw,
					groupResultGameId: gameId || undefined,
					detailTitle: detailData.detailTitle,
					detailLines: detailData.detailLines,
					detailTables: detailData.detailTables,
				},
			};
		});
	return parsedMatches.filter((match): match is IPSMFHistoricalMatch => Boolean(match));
}

type ParseMatchRowOptions = {
	tournament: string;
	group: string;
	index: number;
	matchId?: string;
	sourcePath?: string;
};

export function extractMatchDetailData(detailHtml: string, match: IPSMFHistoricalMatch) {
	return {
		detailTitle: extractFirstText(detailHtml, [
			/<[^>]*class=["'][^"']*component__title[^"']*["'][^>]*>(?<text>[\s\S]*?)<\/[^>]+>/i,
			/<h1[^>]*>(?<text>[\s\S]*?)<\/h1>/i,
		]),
		scorers: extractScorers(detailHtml, match),
		detailLines: collectRelevantDetailLines(detailHtml, match),
		detailTables: collectRelevantDetailTables(detailHtml, match),
	};
}

export function extractScorers(detailHtml: string, match: IPSMFHistoricalMatch) {
	const goalBlocks = collectGoalBlocks(detailHtml, match);
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

export function collectRelevantDetailLines(detailHtml: string, match: IPSMFHistoricalMatch) {
	const detailText = decodeHtml(stripTags(detailHtml));
	return detailText
		.split(/\s{2,}/)
		.map((line) => line.trim())
		.filter((line) => line.length > 2)
		.filter((line) => {
			const lowerLine = line.toLowerCase();
			return /gól|brank|žlut|červen|karta|střel/.test(lowerLine)
				|| lowerLine.includes((match.homeTeamName || '').toLowerCase())
				|| lowerLine.includes((match.guestTeamName || '').toLowerCase());
		})
		.slice(0, 30);
}

export function collectRelevantDetailTables(detailHtml: string, match: IPSMFHistoricalMatch): IPSMFHistoricalRawTable[] {
	const tables: IPSMFHistoricalRawTable[] = [];
	for (const { tableHtml, previousHeadingHtml } of extractTables(detailHtml)) {
		const rows = extractRows(tableHtml).map((rowHtml) => extractCells(rowHtml).map(stripAndDecode).filter(Boolean)).filter((row) => row.length > 0);
		const flattened = rows.flat().join(' ').toLowerCase();
		if (!flattened) {
			continue;
		}
		const hasRelevantContent = /gól|brank|žlut|červen|karta|střel/.test(flattened)
			|| flattened.includes((match.homeTeamName || '').toLowerCase())
			|| flattened.includes((match.guestTeamName || '').toLowerCase());
		if (!hasRelevantContent) {
			continue;
		}
		tables.push({
			title: previousHeadingHtml ? stripAndDecode(previousHeadingHtml) || undefined : undefined,
			rows: rows.slice(0, 20),
		});
		if (tables.length >= 6) {
			break;
		}
	}
	return tables;
}

type GoalBlock = {
	title?: string;
	lines: string[];
	columns?: { side: 'home' | 'guest' | 'unknown'; lines: string[] }[];
};

function parseMatchRow(rowHtml: string, { tournament, group, index, matchId, sourcePath }: ParseMatchRowOptions): IPSMFHistoricalMatch | null {
	const cells = extractCells(rowHtml);
	if (cells.length < 4) {
		return null;
	}

	const startsAt = parseMatchStartsAt(cells[0], stripAndDecode(cells[1]));
	const teamsCellHtml = cells.find((cellHtml) => extractAnchors(cellHtml).filter((anchor) => isTeamPath(anchor.href)).length >= 2);
	if (!teamsCellHtml) {
		return null;
	}
	const teamAnchors = extractAnchors(teamsCellHtml).filter((anchor) => isTeamPath(anchor.href));
	const homeTeam = parseTeamAnchor(teamAnchors[0]);
	const guestTeam = parseTeamAnchor(teamAnchors[1]);
	if (!startsAt || !homeTeam?.code || !guestTeam?.code) {
		return null;
	}

	const opponent = homeTeam.code === TEAM_CODE_NAME ? guestTeam : homeTeam;
	const rowCells = cells.map(stripAndDecode);
	const detailAnchor = extractAnchors(rowHtml).find((anchor) => /\/zapas\//.test(anchor.href));
	const detailPath = detailAnchor ? new URL(detailAnchor.href, PSMF_BASE_URL).pathname : undefined;
	const scoreCell = rowCells.slice(4).find((cellText) => Boolean(parseScore(cellText)));
	const score = scoreCell ? parseScore(scoreCell) ?? undefined : undefined;
	const resolvedMatchId = matchId
		|| detailPath?.match(/\/zapas\/(?<matchId>[^/?#]+)/)?.groups?.matchId
		|| `${tournament}-${group}-${index}`;

	return {
		id: resolvedMatchId,
		startsAtIso: startsAt.toISOString(),
		tournament,
		group,
		field: stripAndDecode(cells[2]) || undefined,
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
			sourcePath,
			scoreCell: scoreCell || undefined,
		},
	};
}

function parseResultBlock(blockHtml: string, options: ParseMatchRowOptions) {
	const summaryTable = extractTables(blockHtml)
		.find(({ tableHtml }) => /Domácí\s*-\s*Hosté/i.test(tableHtml) && /Výsledek/i.test(tableHtml));
	if (!summaryTable) {
		return null;
	}
	const summaryRow = extractRows(summaryTable.tableHtml).find((rowHtml) => extractCells(rowHtml).length >= 6 && extractAnchors(rowHtml).some((anchor) => isTeamPath(anchor.href)));
	return summaryRow ? parseMatchRow(summaryRow, options) : null;
}

function parseMatchStartsAt(dateCellHtml: string, timeCellText: string) {
	const normalizedDate = stripAndDecode(dateCellHtml);
	const dateMatch = normalizedDate.match(/(?<day>\d{1,2})\.(?<month>\d{1,2})\.(?<year>\d{2,4})/);
	if (!dateMatch?.groups || !timeCellText) {
		return null;
	}
	const year = dateMatch.groups.year.length === 2 ? `20${dateMatch.groups.year}` : dateMatch.groups.year;
	const dateIso = `${year}-${dateMatch.groups.month.padStart(2, '0')}-${dateMatch.groups.day.padStart(2, '0')}T${timeCellText.padStart(5, '0')}`;
	const startsAt = moment.tz(dateIso, config.timezone);
	return startsAt.isValid() ? startsAt.toDate() : null;
}

function parseTeamAnchor(anchor: { href: string; text: string } | undefined) {
	if (!anchor) {
		return null;
	}
	const pathname = new URL(anchor.href, PSMF_BASE_URL).pathname;
	const code = pathname.split('/').filter(Boolean).pop();
	if (!code) {
		return null;
	}
	return {
		code,
		name: anchor.text || code,
	};
}

function getGroupTournamentPath(path: string) {
	const pathname = new URL(path, PSMF_BASE_URL).pathname;
	const match = pathname.match(/^\/souteze\/(?<tournament>[^/]+)\/(?<group>[^/]+)\/?$/);
	if (!match?.groups) {
		return null;
	}
	return {
		tournament: match.groups.tournament,
		group: match.groups.group,
		groupPagePath: pathname.endsWith('/') ? pathname : `${pathname}/`,
	};
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

function getStatsCategoryKey(path: string) {
	return path.match(/[?&]subtype=(?<subtype>[^&#]+)/)?.groups?.subtype || 'default';
}

function isTeamPath(path: string) {
	return /\/souteze\/[^/]+\/[^/]+\/tymy\/[^/]+\/?/.test(path);
}

function collectGoalBlocks(detailHtml: string, match: IPSMFHistoricalMatch): GoalBlock[] {
	const blocks: GoalBlock[] = [];
	for (const { tableHtml, previousHeadingHtml } of extractTables(detailHtml)) {
		const tableText = stripAndDecode(tableHtml).toLowerCase();
		const relatedHeadingText = previousHeadingHtml ? stripAndDecode(previousHeadingHtml).toLowerCase() : '';
		if (!tableText || (!/gól|brank|střel/.test(tableText) && !/gól|brank|střel/.test(relatedHeadingText))) {
			continue;
		}
		const rows = extractRows(tableHtml);
		if (rows.length < 1) {
			continue;
		}
		const headerCells = extractHeaderOrCells(rows[0]).map(stripAndDecode);
		const columnSides = inferColumnSides(headerCells, match);
		const columns = columnSides.map((side, index) => ({
			side,
			lines: rows.slice(1).flatMap((rowHtml) => splitHtmlLines(extractHeaderOrCells(rowHtml)[index] || '')),
		})).filter((column) => column.lines.length > 0);
		blocks.push({
			title: headerCells.join(' | '),
			lines: rows.flatMap((rowHtml) => extractHeaderOrCells(rowHtml).flatMap((cellHtml) => splitHtmlLines(cellHtml))),
			columns,
		});
	}

	if (blocks.length > 0) {
		return blocks;
	}

	return matchAll(detailHtml, /<(?<tag>h1|h2|h3|h4|strong)[^>]*>(?<title>[\s\S]*?)<\/\1>(?<after>[\s\S]*?)(?=<h1|<h2|<h3|<h4|<strong|$)/gi)
		.map((section) => ({
			title: stripAndDecode(section.groups?.title || ''),
			after: section.groups?.after || '',
		}))
		.filter((section) => /gól|brank|střel/i.test(section.title))
		.map((section) => ({
			title: section.title,
			lines: splitHtmlLines(section.after),
		}))
		.filter((section) => section.lines.length > 0);
}

function parseScorerLine(line: string, teamSide: 'home' | 'guest' | 'unknown') {
	const cleanedLine = stripAndDecode(line)
		.replace(/^[•·\-–—]\s*/, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!cleanedLine || /gól|brank|střel/i.test(cleanedLine) || /^\d+\s*:\s*\d+$/.test(cleanedLine)) {
		return [];
	}

	const linesToParse = cleanedLine.split(/\s{2,}|;\s*/).map((part) => part.trim()).filter(Boolean);
	return linesToParse.flatMap((value) => {
		const minuteMatches = [...value.matchAll(/\b(?<minute>\d{1,3})\./g)];
		if (minuteMatches.length > 0) {
			const minutes = minuteMatches.map((match) => Number(match.groups?.minute)).filter((minute) => Number.isFinite(minute));
			const playerName = stripAndDecode(value.replace(/\b\d{1,3}\./g, '').replace(/[(),]/g, ' ')).trim();
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
			const playerName = stripAndDecode(minuteAtEnd.groups.player);
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

function getSideFromText(value: string | undefined, match: IPSMFHistoricalMatch): 'home' | 'guest' | 'unknown' {
	const normalizedValue = stripAndDecode(value || '').toLowerCase();
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

function inferColumnSides(headerCells: string[], match: IPSMFHistoricalMatch) {
	const resolvedSides = headerCells.map((headerCell) => getSideFromText(headerCell, match));
	if (resolvedSides.some((side) => side !== 'unknown')) {
		return resolvedSides;
	}
	if (headerCells.length >= 4) {
		const middleIndex = Math.floor(headerCells.length / 2);
		return headerCells.map((_, index) => {
			if (index < middleIndex) {
				return 'home';
			}
			if (index > middleIndex) {
				return 'guest';
			}
			return headerCells.length % 2 === 0 ? 'guest' : 'unknown';
		});
	}
	return resolvedSides;
}

function extractTableByClass(html: string, className: string) {
	return extractTables(html).find(({ tableHtml }) => new RegExp(`class=["'][^"']*${escapeRegExp(className)}[^"']*["']`, 'i').test(tableHtml))?.tableHtml;
}

function extractTables(html: string) {
	const results: { tableHtml: string; previousHeadingHtml?: string }[] = [];
	const tableRegex = /<table\b[^>]*>[\s\S]*?<\/table>/gi;
	let match: RegExpExecArray | null;
	while ((match = tableRegex.exec(html)) !== null) {
		const prefix = html.slice(0, match.index);
		const previousHeadingMatches = matchAll(prefix, /<(h1|h2|h3|h4|strong)\b[^>]*>[\s\S]*?<\/\1>/gi);
		const previousHeadingHtml = previousHeadingMatches.length > 0 ? previousHeadingMatches[previousHeadingMatches.length - 1][0] : undefined;
		results.push({
			tableHtml: match[0],
			previousHeadingHtml,
		});
	}
	return results;
}

function extractRows(tableHtml: string) {
	return matchAll(tableHtml, /<tr\b[^>]*>(?<content>[\s\S]*?)<\/tr>/gi).map((match) => match.groups?.content || '');
}

function extractCells(rowHtml: string) {
	return matchAll(rowHtml, /<td\b[^>]*>(?<content>[\s\S]*?)<\/td>/gi).map((match) => match.groups?.content || '');
}

function extractHeaderOrCells(rowHtml: string) {
	const headers = matchAll(rowHtml, /<th\b[^>]*>(?<content>[\s\S]*?)<\/th>/gi).map((match) => match.groups?.content || '');
	return headers.length > 0 ? headers : extractCells(rowHtml);
}

function extractAnchors(html: string) {
	return matchAll(html, /<a\b[^>]*href=["'](?<href>[^"']+)["'][^>]*>(?<text>[\s\S]*?)<\/a>/gi).map((match) => ({
		href: match.groups?.href || '',
		text: stripAndDecode(match.groups?.text || ''),
	}));
}

function extractFirstText(html: string, regexes: RegExp[]) {
	for (const regex of regexes) {
		const match = regex.exec(html);
		if (match?.groups?.text) {
			return stripAndDecode(match.groups.text) || undefined;
		}
	}
	return undefined;
}

function splitHtmlLines(html: string) {
	return html
		.split(/<br\s*\/?>/i)
		.map(stripAndDecode)
		.filter(Boolean);
}

function stripAndDecode(value: string) {
	return decodeHtml(stripTags(value)).replace(/\s+/g, ' ').trim();
}

function stripTags(value: string) {
	return value.replace(/<[^>]+>/g, ' ');
}

function decodeHtml(value: string) {
	return value
		.replace(/&nbsp;/gi, ' ')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&amp;/gi, '&')
		.replace(/\u00a0/g, ' ');
}

function decodePath(value: string | undefined) {
	if (!value) {
		return undefined;
	}
	return decodeHtml(value).trim();
}

function readAttribute(html: string, attributeName: string) {
	const match = html.match(new RegExp(`${escapeRegExp(attributeName)}=["'](?<value>[^"']+)["']`, 'i'));
	return match?.groups?.value;
}

function unwrapHtmlPayload(value: string) {
	const trimmedValue = value.trim();
	if (!trimmedValue.startsWith('{')) {
		return trimmedValue;
	}
	try {
		const parsed = JSON.parse(trimmedValue) as { html?: string };
		return parsed.html || trimmedValue;
	} catch {
		return trimmedValue;
	}
}

function matchAll(value: string, regex: RegExp) {
	return Array.from(value.matchAll(regex));
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueStrings(values: string[]) {
	return [...new Set(values)];
}

function uniqueBy<T>(values: T[], getKey: (value: T) => string) {
	const keys = new Set<string>();
	return values.filter((value) => {
		const key = getKey(value);
		if (keys.has(key)) {
			return false;
		}
		keys.add(key);
		return true;
	});
}
