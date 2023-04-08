import * as FirebaseApp from '@firebase/app';
import * as FirebaseFirestore from '@firebase/firestore';
import * as FirebaseAuth from '@firebase/auth';
import fetch from 'node-fetch';
import JSDOM from 'jsdom';
import { getMatchesCollection, IMatch, mapMatch } from '../src/Model/collections';
import config from '../src/config.json';
import { email, password } from '../credentials.json';
import firebaseConfig from '../src/firebase.json';

type IMatchImport = Pick<IMatch, 'field' | 'opponent' | 'startsAt'>

const LEAGUE_NAME = 'Hanspaulská liga';
const psmfBaseUrl = 'https://www.psmf.cz';
const MY_TEAM_QUERY_NAME = 'Catchers+SC';
const MY_TEAM_CODE_NAME = 'catchers-sc';

const currentTimezoneOffset = new Date().getTimezoneOffset();

const CURRENT_TIMEZONE_OFFSET = config.timezoneOffset ?? (- currentTimezoneOffset / 60).toString().padStart(2, '0').padStart(3, '+') + ':00';

async function importMatches() {
	const firebaseApp = FirebaseApp.initializeApp(firebaseConfig);
	const firebaseAuth = FirebaseAuth.getAuth(firebaseApp);
	const credentials = await FirebaseAuth.signInWithEmailAndPassword(firebaseAuth, email, password);
	console.log("Logged in", credentials);
	const existingMatches = await getExistingMatches(firebaseApp);
	console.log('Existing matches', existingMatches);
	const teamPagaPath = await getLeagueTeamPath();
	console.log('Team page path', teamPagaPath);
	const teamMatches = await getTeamMatches(teamPagaPath);
	console.log('Team matches', teamMatches);

	for (const newMatch of teamMatches) {
		const existingMatch = existingMatches.find((match) => match.opponent === newMatch.opponent);
		if (existingMatch) {
			console.log('Match already exists', newMatch);
			if (existingMatch.field !== newMatch.field || existingMatch.startsAt.valueOf() !== newMatch.startsAt.valueOf()) {
				await updateMatch(firebaseApp, existingMatch, newMatch);
			}
		} else {
			await addMatch(firebaseApp, newMatch);
		}
	}
}

async function updateMatch(firebaseApp: FirebaseApp.FirebaseApp, existingMatch: IMatch, newMatch: IMatchImport) {
	console.log('Updating match', newMatch);
	const existingMatchRef = FirebaseFirestore.doc(getMatchesCollection(firebaseApp), existingMatch.id);
	await FirebaseFirestore.updateDoc(existingMatchRef, newMatch);
}

async function addMatch(firebaseApp: FirebaseApp.FirebaseApp, match: IMatchImport) {
	console.log('Adding match', match);
	const matchRef = await FirebaseFirestore.addDoc(getMatchesCollection(firebaseApp), match);
	console.log('Match added', matchRef);
}

async function getExistingMatches(firebaseApp: FirebaseApp.FirebaseApp): Promise<IMatch[]> {
	const query = FirebaseFirestore.query(getMatchesCollection(firebaseApp), FirebaseFirestore.where('startsAt', '>', new Date()), FirebaseFirestore.orderBy('startsAt', 'asc'));
	const { docs } = await FirebaseFirestore.getDocs(query);
	const existingMatches = docs.map(mapMatch);
	return existingMatches;
}

async function getTeamMatches(teamPagePath: string): Promise<IMatchImport[]> {
	const response = await fetch(psmfBaseUrl + teamPagePath);
	const data = await response.text();
	const dom = new JSDOM.JSDOM(data);
	const matchesSelector = 'section.component--opener table.games-new-table tr';
	const matchRowa = [...dom.window.document.querySelectorAll<HTMLTableRowElement>(matchesSelector).values()];
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

async function getLeagueTeamPath() {
	const url = `${psmfBaseUrl}/vyhledavani/?query=${MY_TEAM_QUERY_NAME}`;
	const response = await fetch(url);
	const data = await response.text();
	const dom = new JSDOM.JSDOM(data);
	const resultListItemsSelector = 'section.component--content .container .component__wrap .component__text .search-content ul li';
	const listItems = [...dom.window.document.querySelectorAll<HTMLAnchorElement>(resultListItemsSelector).values()];
	const leagueListItem = listItems.find((item) => item.innerHTML.includes(LEAGUE_NAME));
	const leagueTeamPath = leagueListItem?.querySelector('a')?.href;

	if (!leagueTeamPath) {
		throw new Error(`League ${LEAGUE_NAME} not found`);
	}

	return leagueTeamPath;
}

importMatches();
