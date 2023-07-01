import { IMatch } from './collections';
import config from '../config.json';
import { useState } from 'react';
import URL from 'url';
import { useAsyncEffect } from '../React/async';
import { getErrorMessage } from '../Util/error';

export type IMatchImport = Pick<IMatch, 'field' | 'opponent' | 'startsAt'>
export interface IPSMFLeague {
	name: string;
	uri: string | undefined;
	path: string | undefined;
}

const CORS_PROXY = 'https://corsproxy.io/?';
const psmfBaseUrl = 'https://www.psmf.cz';
const MY_TEAM_QUERY_NAME = 'Catchers+SC';
const MY_TEAM_CODE_NAME = 'catchers-sc';

const currentTimezoneOffset = new Date().getTimezoneOffset();

const CURRENT_TIMEZONE_OFFSET = config.timezoneOffset ?? (- currentTimezoneOffset / 60).toString().padStart(2, '0').padStart(3, '+') + ':00';

function createHTMLElementFromText(): (html: string) => HTMLElement {
	return (html: string) => {
		const htmlElement = document.createElement('html');
		htmlElement.innerHTML = html;
		return htmlElement;
	};
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

export async function getTeamMatches(
	teamPagePath: string,
	createElement: (html: string) => HTMLElement,
): Promise<IMatchImport[]> {
	const response = await fetch(CORS_PROXY + psmfBaseUrl + teamPagePath);
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
		const startsAt = new Date(`${startsAtDate}T${startsAtTime}${CURRENT_TIMEZONE_OFFSET}`);

		const homeTeamUrl = matchRow.querySelector<HTMLAnchorElement>('td:nth-child(4) a:nth-child(1)')?.href;
		const guestTeamUrl = matchRow.querySelector<HTMLAnchorElement>('td:nth-child(4) a:nth-child(2)')?.href;
		console.log('teams', homeTeamUrl, guestTeamUrl);
		const homeTeamUrlParts = homeTeamUrl?.split('/');
		const homeTeamCodeName = homeTeamUrlParts?.[homeTeamUrlParts?.length - 2];
		const guestTeamUrlParts = guestTeamUrl?.split('/');
		const guestTeamCodeName = guestTeamUrlParts?.[guestTeamUrlParts?.length - 2];
		const opponent = homeTeamCodeName === MY_TEAM_CODE_NAME ? guestTeamCodeName : homeTeamCodeName;

		console.log('match', opponent, startsAt, field);

		if (!opponent) {
			return null;
		}

		return {
			opponent,
			startsAt,
			field,
		};
	}).filter((match): match is IMatchImport => Boolean(match));

	return teamMatches;
}

export function areMatchesSame(existingMatch: IMatchImport, newMatch: IMatchImport) {
	return existingMatch.field === newMatch.field && existingMatch.startsAt.valueOf() === newMatch.startsAt.valueOf();
}
