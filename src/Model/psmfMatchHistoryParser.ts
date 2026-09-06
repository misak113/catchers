import moment from 'moment-timezone';
import config from '../config.json';
import { IPSMFHistoricalMatch, IPSMFHistoricalRawTable, IPSMFHistoricalScorer } from './psmfMatchHistoryShared';

const PSMF_BASE_URL = 'https://www.psmf.cz';
const TEAM_CODE_NAME = 'catchers-sc';
const MATCH_ROW_SELECTOR = 'section.component--opener table.games-new-table tr';

type GoalBlock = {
	title?: string;
	lines: string[];
	columns?: { side: 'home' | 'guest' | 'unknown'; lines: string[] }[];
};

export function parseTeamPageMatches(document: Document, teamPagePath: string): IPSMFHistoricalMatch[] {
	const tournamentGroup = getTournamentGroupPath(teamPagePath);
	if (!tournamentGroup) {
		return [];
	}
	const rows = [...document.querySelectorAll<HTMLTableRowElement>(MATCH_ROW_SELECTOR)];
	return rows.map((row, index) => parseTeamPageMatchRow(row, tournamentGroup.tournament, tournamentGroup.group, index))
		.filter((match): match is IPSMFHistoricalMatch => Boolean(match));
}

export function extractScorers(document: Document, match: IPSMFHistoricalMatch) {
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

function parseTeamPageMatchRow(row: HTMLTableRowElement, tournament: string, group: string, index: number): IPSMFHistoricalMatch | null {
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
	const scoreCell = rowCells.slice(4).find((cellText) => Boolean(parseScore(cellText)));
	const parsedScore = scoreCell ? parseScore(scoreCell) : null;
	const score = parsedScore ?? undefined;
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
	const normalizedDate = normalizeText(dateCellHtml);
	const dateMatch = normalizedDate.match(/(?<day>\d{1,2})\.(?<month>\d{1,2})\.(?<year>\d{2,4})/);
	if (!dateMatch?.groups || !timeCellText) {
		return null;
	}
	const year = dateMatch.groups.year.length === 2 ? `20${dateMatch.groups.year}` : dateMatch.groups.year;
	const dateIso = `${year}-${dateMatch.groups.month.padStart(2, '0')}-${dateMatch.groups.day.padStart(2, '0')}T${timeCellText.padStart(5, '0')}`;
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
	if (!code) {
		return null;
	}
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

function collectGoalBlocks(document: Document, match: IPSMFHistoricalMatch): GoalBlock[] {
	const blocks: GoalBlock[] = [];
	for (const table of document.querySelectorAll<HTMLTableElement>('table')) {
		const tableText = normalizeText(table.textContent).toLowerCase();
		const relatedHeadingText = normalizeText(table.previousElementSibling?.textContent).toLowerCase();
		if (!tableText || (!/gól|brank|střel/.test(tableText) && !/gól|brank|střel/.test(relatedHeadingText))) {
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
		.filter((heading) => /gól|brank|střel/i.test(normalizeText(heading.textContent)))
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
	if (!cleanedLine || /gól|brank|střel/i.test(cleanedLine) || /^\d+\s*:\s*\d+$/.test(cleanedLine)) {
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

export function collectRelevantDetailLines(document: Document, match: IPSMFHistoricalMatch) {
	const detailText = normalizeText(document.body.textContent);
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

export function collectRelevantDetailTables(document: Document, match: IPSMFHistoricalMatch): IPSMFHistoricalRawTable[] {
	const tables: (IPSMFHistoricalRawTable | null)[] = [...document.querySelectorAll<HTMLTableElement>('table')]
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
			const hasRelevantContent = /gól|brank|žlut|červen|karta|střel/.test(flattened)
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
		.slice(0, 6);
	return tables.filter((table): table is IPSMFHistoricalRawTable => table !== null);
}
