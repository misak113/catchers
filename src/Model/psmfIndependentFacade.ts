import { syncCache } from './syncCache';

export const CORS_PROXY = 'https://corsproxy.io/?';
export const psmfBaseUrl = 'https://www.psmf.cz';

export type TeamNameOptions = {
	tournament: string | undefined;
	group: string | undefined;
	code: string;
};

const globalTeamNameCache: Map<string, Promise<string | undefined>> = new Map();
const LOCAL_STORAGE_TEAM_NAME_PREFIX = 'PSMF_teamName_';

export function getPSMFTeamUrl(tournament: string, group: string, team: string) {
	return `${psmfBaseUrl}/souteze/${tournament}/${group}/tymy/${team}/`;
}

export async function getCachedTeamName(
	options: TeamNameOptions,
	convertHTMLElementFromText: (html: string) => HTMLElement,
): Promise<string | undefined> {
	const cacheKey = `${options.tournament}/${options.group}/${options.code}`;
	const cachedTeamName = syncCache.getItem(LOCAL_STORAGE_TEAM_NAME_PREFIX + cacheKey);
	if (cachedTeamName) {
		return cachedTeamName;
	}

	if (globalTeamNameCache.has(cacheKey)) {
		return globalTeamNameCache.get(cacheKey);
	}

	const teamNamePromise = getTeamName(options, convertHTMLElementFromText);
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
	const response = await fetch(CORS_PROXY + psmfTeamUri + `?v=${Math.random()}`);
	if (!response.ok) {
		return undefined;
	}
	const data = await response.text();
	const dom = createElement(data);
	const teamName = dom.querySelector<HTMLHeadingElement>('.component--title .component__title')?.innerText;

	return teamName;
}
