import { IMatch } from './collections';
import config from '../config.json';
import { useState } from 'react';
import URL from 'url';
import { useAsyncEffect } from '../React/async';
import { getErrorMessage } from '../Util/error';
import moment from 'moment-timezone';
import { syncCache } from './syncCache';
import fetch from 'isomorphic-fetch';

export type IMatchImport = Pick<IMatch, 'field' | 'opponent' | 'startsAt' | 'tournament' | 'group'>;
export interface IPSMFLeague {
	name: string;
	uri: string | undefined;
	path: string | undefined;
}

const CORS_PROXY = 'https://corsproxy.io/?';
const psmfBaseUrl = 'https://www.psmf.cz';
const MY_TEAM_QUERY_NAME = 'Catchers+SC';
const MY_TEAM_CODE_NAME = 'catchers-sc';

function createHTMLElementFromText(): (html: string) => HTMLElement {
	return (html: string) => {
		const htmlElement = document.createElement('html');
		htmlElement.innerHTML = html;
		return htmlElement;
	};
}

export function getPSMFTournamentUrl(tournament: string) {
	return `${psmfBaseUrl}/souteze/${tournament}/`;
}

export function getPSMFGroupUrl(tournament: string, group: string) {
	return `${psmfBaseUrl}/souteze/${tournament}/${group}/`;
}

export function getPSMFTeamUrl(tournament: string, group: string, team: string) {
	return `${psmfBaseUrl}/souteze/${tournament}/${group}/tymy/${team}/`;
}

export function getPSMFFieldUrl(field: string) {
	return `${psmfBaseUrl}/hriste/#${field}`;
}

export function useLeagues(setErrorMessage: (errorMessage: string | undefined) => void) {
	const [leagues, setLeagues] = useState<IPSMFLeague[] | undefined>(undefined);
	useAsyncEffect(async () => {
		try {
			const leagues = await getLeagues(createHTMLElementFromText());
			setLeagues(leagues);
		} catch (error) {
			setErrorMessage(getErrorMessage(error));
		}
	}, []);
	return leagues;
}

export function useLeagueTeamPath(setErrorMessage: (errorMessage: string | undefined) => void) {
	const [leagueTeamPath, setLeagueTeamPath] = useState<string | undefined>(undefined);
	useAsyncEffect(async () => {
		try {
			const leagues = await getLeagues(createHTMLElementFromText());
			const leagueTeamPath = leagues.find(() => true)?.path;
			setLeagueTeamPath(leagueTeamPath);
		} catch (error) {
			setErrorMessage(getErrorMessage(error));
		}
	}, []);
	return psmfBaseUrl + (leagueTeamPath ?? '');
}

async function getLeagueElements(
	createElement: (html: string) => HTMLElement,
) {
	const url = `${CORS_PROXY}${psmfBaseUrl}/vyhledavani/?query=${MY_TEAM_QUERY_NAME}`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Cannot find team leagues for ${MY_TEAM_QUERY_NAME}`);
	}
	const data = await response.text();
	const dom = createElement(data);
	const resultListItemsSelector = 'section.component--content .container .component__wrap .component__text .search-content ul li';
	const listItems = [...dom.querySelectorAll<HTMLAnchorElement>(resultListItemsSelector).values()];
	return listItems;
}

export async function getLeagues(
	createElement: (html: string) => HTMLElement,
): Promise<IPSMFLeague[]> {
	const listItems = await getLeagueElements(createElement);
	const leagueNames = listItems.map((listItem) => {
		const uri = listItem.querySelector('a')?.href;
		return ({
			name: listItem.innerText,
			uri,
			path: (uri && URL.parse(uri)?.path) || undefined,
		});
	});
	return leagueNames;
}

export function useTeamMatches(
	league: IPSMFLeague | undefined,
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [teamMatches, setTeamMatches] = useState<IMatchImport[] | undefined>(undefined);
	useAsyncEffect(async () => {
		try {
			const teamMatches = league?.path ? await getTeamMatches(league.path, createHTMLElementFromText()) : undefined;
			setTeamMatches(teamMatches);
		} catch (error) {
			setErrorMessage(getErrorMessage(error));
		}
	}, []);
	return teamMatches;
}

/**
 *
 * @param url E.g.: https://www.psmf.cz/souteze/2023-hanspaulska-liga-jaro/6-e/tymy/catchers-sc/
 * @returns E.g.: 2023-hanspaulska-liga-jaro
 */
function parseTournamentGroupFromPath(url: string) {
	const pathParts = url.split('/');
	const tournament = pathParts[2];
	const group = pathParts[3];
	return [tournament, group];
}

export async function getTeamMatches(
	teamPagePath: string,
	createElement: (html: string) => HTMLElement,
): Promise<IMatchImport[]> {
	const [tournament, group] = parseTournamentGroupFromPath(teamPagePath);
	const response = await fetch(CORS_PROXY + psmfBaseUrl + teamPagePath);
	if (!response.ok) {
		throw new Error(`Cannot find team matches for ${psmfBaseUrl + teamPagePath}`);
	}
	const data = await response.text();
	const dom = createElement(data);
	const matchesSelector = 'section.component--opener table.games-new-table tr';
	const matchRowa = [...dom.querySelectorAll<HTMLTableRowElement>(matchesSelector).values()];
	const teamMatches = matchRowa.map((matchRow) => {
		const field = matchRow.querySelector<HTMLAnchorElement>('td:nth-child(3) a')?.innerHTML;

		const startsAtDateCZWithWeekday = matchRow.querySelector<HTMLTableCellElement>('td:nth-child(1)')?.innerHTML;
		const startsAtTimeCZ = matchRow.querySelector<HTMLTableCellElement>('td:nth-child(2)')?.innerHTML;
		const startsAtDateCZParts = startsAtDateCZWithWeekday?.split('&nbsp;').pop()?.split('.');
		const startsAtDate = '20' + startsAtDateCZParts?.[2].padStart(2, '0') + '-' + startsAtDateCZParts?.[1].padStart(2, '0') + '-' + startsAtDateCZParts?.[0].padStart(2, '0');
		const startsAtTime = startsAtTimeCZ?.padStart(5, '0');
		const startsAt = moment.tz(`${startsAtDate}T${startsAtTime}`, config.timezone).toDate();

		const teamsAnchors = [...matchRow.querySelectorAll<HTMLAnchorElement>('td:nth-child(4) a[href^="/souteze/"]')];
		const homeTeamUrl = teamsAnchors[0]?.href;
		const guestTeamUrl = teamsAnchors[1]?.href;
		console.log('teams', homeTeamUrl, guestTeamUrl);
		const homeTeamUrlParts = homeTeamUrl?.split('/');
		const homeTeamCodeName = homeTeamUrlParts?.[homeTeamUrlParts?.length - 2];
		const guestTeamUrlParts = guestTeamUrl?.split('/');
		const guestTeamCodeName = guestTeamUrlParts?.[guestTeamUrlParts?.length - 2];
		const opponent = homeTeamCodeName === MY_TEAM_CODE_NAME ? guestTeamCodeName : homeTeamCodeName;

		console.log('match', opponent, startsAt, field);

		if (!opponent || !field) {
			return null;
		}

		const matchImport: IMatchImport = {
			opponent,
			startsAt,
			field,
			tournament,
			group,
		};
		return matchImport;
	}).filter((match): match is IMatchImport => Boolean(match));

	return teamMatches;
}

export function areMatchesSame(existingMatch: IMatchImport, newMatch: IMatchImport) {
	return existingMatch.field === newMatch.field
		&& existingMatch.startsAt.valueOf() === newMatch.startsAt.valueOf()
		&& existingMatch.opponent === newMatch.opponent
		&& existingMatch.tournament === newMatch.tournament
		&& existingMatch.group === newMatch.group;
}

export type TeamNameOptions = {
	tournament: string | undefined;
	group: string | undefined;
	code: string;
};

export function useTeamName(options: TeamNameOptions) {
	const [teamName, setTeamName] = useState<string | undefined>(undefined);
	useAsyncEffect(async () => {
		try {
			const teamName = await getCachedTeamName(options);
			setTeamName(teamName);
		} catch (error) {
			console.error(error);
		}
	}, []);
	return teamName;
}

const globalTeamNameCache: Map<string, Promise<string | undefined>> = new Map();
const LOCAL_STORAGE_TEAM_NAME_PREFIX = 'PSMF_teamName_';

export async function getCachedTeamName(options: TeamNameOptions) {
	const cacheKey = `${options.tournament}/${options.group}/${options.code}`;
	const cachedTeamName = syncCache.getItem(LOCAL_STORAGE_TEAM_NAME_PREFIX + cacheKey);
	if (cachedTeamName) {
		return cachedTeamName;
	}

	if (globalTeamNameCache.has(cacheKey)) {
		return globalTeamNameCache.get(cacheKey);
	}

	const teamNamePromise = getTeamName(options, createHTMLElementFromText());
	globalTeamNameCache.set(cacheKey, teamNamePromise);
	const teamName = await teamNamePromise;
	if (teamName) {
		syncCache.setItem(LOCAL_STORAGE_TEAM_NAME_PREFIX + cacheKey, teamName);
	}

	return teamName;
}

async function getTeamName(
	{ tournament, group, code }: TeamNameOptions,
	createElement: (html: string) => HTMLElement,
) {
	if (!tournament || !group || !code) {
		return undefined;
	}

	const psmfTeamUri = getPSMFTeamUrl(tournament, group, code);
	const response = await fetch(CORS_PROXY + psmfTeamUri);
	if (!response.ok) {
		return undefined;
	}
	const data = await response.text();
	const dom = createElement(data);
	const teamName = dom.querySelector<HTMLHeadingElement>('.component--title .component__title')?.innerText;

	return teamName;
}
