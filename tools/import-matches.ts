import fetch from 'node-fetch';
import * as FirebaseApp from '@firebase/app';
import * as FirebaseAuth from '@firebase/auth';
import { addMatch, getUpcomingMatches, updateMatch } from '../src/Model/matchFacade';
import { email, password } from '../credentials.json';
import firebaseConfig from '../src/firebase.json';
import { getLeagueTeamPath, getTeamMatches } from '../src/Model/psmfFacade';

global.fetch = fetch as any;

async function importMatches() {
	const firebaseApp = FirebaseApp.initializeApp(firebaseConfig);
	const firebaseAuth = FirebaseAuth.getAuth(firebaseApp);
	const credentials = await FirebaseAuth.signInWithEmailAndPassword(firebaseAuth, email, password);
	console.log("Logged in", credentials);
	const existingMatches = await getUpcomingMatches(firebaseApp);
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

importMatches();
