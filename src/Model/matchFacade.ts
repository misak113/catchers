import _ from 'lodash';
import { useEffect, useState } from "react";
import { MATCHES, IMatch, mapMatch, IUser, IPersonResult } from "./collections";

export function useMatches(
	firebaseApp: firebase.app.App,
	user: firebase.User | null,
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [matches, setMatches] = useState<IMatch[]>();
	useEffect(() => {
		(async () => {
			try {
				const { docs } = await firebaseApp.firestore().collection(MATCHES).get();
				const matches = docs.map(mapMatch);
				console.log('matches', matches);
				setMatches(matches);
				setErrorMessage(undefined);
			} catch (error) {
				console.error(error);
				setErrorMessage(error.message);
			}
		})();
	}, [firebaseApp, user, setErrorMessage]);

	return [matches];
}

export function useMatch(
	matchId: string,
	firebaseApp: firebase.app.App,
	user: firebase.User | null,
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [reloadIndex, setReloadIndex] = useState(0);
	const [match, setMatch] = useState<IMatch>();
	useEffect(() => {
		(async () => {
			try {
				const doc = await firebaseApp.firestore().collection(MATCHES).doc(matchId).get();
				const match = doc.exists ? mapMatch(doc as firebase.firestore.QueryDocumentSnapshot) : undefined;
				console.log('match', match);
				setMatch(match);
				setErrorMessage(undefined);
			} catch (error) {
				console.error(error);
				setErrorMessage(error.message);
			}
		})();
	}, [matchId, firebaseApp, user, setErrorMessage, reloadIndex]);

	return { match, reloadMatch: () => setReloadIndex(reloadIndex + 1) };
}

export async function addAttendee(
	firebaseApp: firebase.app.App,
	match: IMatch,
	user: IUser,
	note: string | undefined,
) {
	await updateAttendees(
		firebaseApp,
		match,
		user,
		note,
		(result) => ({ attendee: result }),
	);
}

export async function addNonAttendee(
	firebaseApp: firebase.app.App,
	match: IMatch,
	user: IUser,
	note: string | undefined,
) {
	await updateAttendees(
		firebaseApp,
		match,
		user,
		note,
		(result) => ({ nonAttendee: result }),
	);
}

export async function addMaybeAttendee(
	firebaseApp: firebase.app.App,
	match: IMatch,
	user: IUser,
	note: string | undefined,
) {
	await updateAttendees(
		firebaseApp,
		match,
		user,
		note,
		(result) => ({ maybeAttendee: result }),
	);
}

async function updateAttendees(
	firebaseApp: firebase.app.App,
	match: IMatch,
	user: IUser,
	note: string | undefined,
	updateCallback: (currentResult: IPersonResult) => { attendee?: IPersonResult; nonAttendee?: IPersonResult; maybeAttendee?: IPersonResult },
) {
	// refresh match (prenvent update colissions)
	match = mapMatch(await firebaseApp.firestore().collection(MATCHES).doc(match.id).get() as firebase.firestore.QueryDocumentSnapshot);

	const currentAttendees = (match.attendees || []).filter(person => person.userId !== user.id);
	const currentNonAttendees = (match.nonAttendees || []).filter(person => person.userId !== user.id);
	const currentMaybeAttendees = (match.maybeAttendees || []).filter(person => person.userId !== user.id);
	const currentResult = _.omitBy<IPersonResult>({
		userId: user.id,
		resultAt: new Date(),
		note,
	}, _.isUndefined) as IPersonResult;
	const result = updateCallback(currentResult);
	const type = Object.keys(result)[0];
	const attendees = [...currentAttendees, ...result.attendee ? [result.attendee] : []];
	const nonAttendees = [...currentNonAttendees, ...result.nonAttendee ? [result.nonAttendee] : []];
	const maybeAttendees = [...currentMaybeAttendees, ...result.maybeAttendee ? [result.maybeAttendee] : []];
	console.log('attendance', type, result, attendees, nonAttendees, maybeAttendees);

	/*
	await firebaseApp.firestore().collection(MATCHES).doc(match.id).collection('attendeesResultLog').doc((match.attendeesResultLog?.length || 0).toString()).set(
		{ ...currentResult, type },
	);
	*/
	await firebaseApp.firestore().collection(MATCHES).doc(match.id).update({
		attendeesResultLog: [...match.attendeesResultLog || [], { ...currentResult, type }],
		attendees,
		nonAttendees,
		maybeAttendees,
	});
}
