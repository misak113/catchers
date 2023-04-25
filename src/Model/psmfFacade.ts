import { IMatch } from './collections';
import config from '../config.json';
import { useState } from 'react';
import { useAsyncEffect } from '../React/async';

export type IMatchImport = Pick<IMatch, 'field' | 'opponent' | 'startsAt'>

const LEAGUE_NAME = 'Hanspaulská liga';
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

export function useLeagueTeamPath() {
	const [leagueTeamPath, setLeagueTeamPath] = useState<string | undefined>(undefined);
	useAsyncEffect(async () => {
		try {
			const leagueTeamPath = await getLeagueTeamPath(createHTMLElementFromText());
			setLeagueTeamPath(leagueTeamPath);
		} catch (error) {
			console.error(error);
		}
	}, []);
	return psmfBaseUrl + '/' + (leagueTeamPath ?? '');
}

export async function getLeagueTeamPath(
	createElement: (html: string) => HTMLElement,
) {
	const url = `${psmfBaseUrl}/vyhledavani/?query=${MY_TEAM_QUERY_NAME}`;
	const response = await fetch(url);
	const data = await response.text();
	const dom = createElement(data);
	const resultListItemsSelector = 'section.component--content .container .component__wrap .component__text .search-content ul li';
	const listItems = [...dom.querySelectorAll<HTMLAnchorElement>(resultListItemsSelector).values()];
	const leagueListItem = listItems.find((item) => item.innerHTML.includes(LEAGUE_NAME));
	const leagueTeamPath = leagueListItem?.querySelector('a')?.href;

	if (!leagueTeamPath) {
		throw new Error(`League ${LEAGUE_NAME} not found`);
	}

	return leagueTeamPath;
}

export async function getTeamMatches(
	teamPagePath: string,
	createElement: (html: string) => HTMLElement,
): Promise<IMatchImport[]> {
	const response = await fetch(psmfBaseUrl + teamPagePath);
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
		console.log('startsAt', `${startsAtDate}T${startsAtTime}${CURRENT_TIMEZONE_OFFSET}`, startsAt)

		const homeTeamUrl = matchRow.querySelector<HTMLAnchorElement>('td:nth-child(4) a:nth-child(1)')?.href;
		const guestTeamUrl = matchRow.querySelector<HTMLAnchorElement>('td:nth-child(4) a:nth-child(3)')?.href;
		const homeTeamUrlParts = homeTeamUrl?.split('/');
		const homeTeamCodeName = homeTeamUrlParts?.[homeTeamUrlParts?.length - 2];
		const guestTeamUrlParts = guestTeamUrl?.split('/');
		const guestTeamCodeName = guestTeamUrlParts?.[guestTeamUrlParts?.length - 2];
		const opponent = homeTeamCodeName === MY_TEAM_CODE_NAME ? guestTeamCodeName : homeTeamCodeName;

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
