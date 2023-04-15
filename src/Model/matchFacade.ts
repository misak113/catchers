import * as firebase from '@firebase/app';
import * as firestore from '@firebase/firestore';
import { User as FirebaseUser } from '@firebase/auth';
import { useState } from "react";
import { getErrorMessage } from '../Util/error';
import { IMatch, mapMatch, IUser, IPersonResult, getMatchesCollection } from "./collections";
import { safeObjectKeys } from '../Util/object';
import { useAsyncEffect } from '../React/async';


export function useMatches(
	firebaseApp: firebase.FirebaseApp,
	user: FirebaseUser | null,
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [matches, setMatches] = useState<IMatch[]>();
	useAsyncEffect(async () => {
		try {
			const query = firestore.query(getMatchesCollection(firebaseApp), firestore.orderBy('startsAt', 'asc'));
			const { docs } = await firestore.getDocs(query);
			const matches = docs.map(mapMatch);
			console.log('matches', matches);
			setMatches(matches);
			setErrorMessage(undefined);
		} catch (error) {
			console.error(error);
			setErrorMessage(getErrorMessage(error));
		}
	}, [firebaseApp, user, setErrorMessage]);

	return [matches];
}

export function useMatch(
	matchId: string,
	firebaseApp: firebase.FirebaseApp,
	user: FirebaseUser | null,
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [reloadIndex, setReloadIndex] = useState(0);
	const [match, setMatch] = useState<IMatch | null>(null);
	useAsyncEffect(async () => {
		try {
			const doc = await firestore.getDoc(firestore.doc(getMatchesCollection(firebaseApp), matchId));
			const match = mapMatch(doc);
			console.log('match', match);
			setMatch(match);
			setErrorMessage(undefined);
		} catch (error) {
			console.error(error);
			setErrorMessage(getErrorMessage(error));
		}
	}, [matchId, firebaseApp, user, setErrorMessage, reloadIndex]);

	return { match, reloadMatch: () => setReloadIndex(reloadIndex + 1) };
}

export async function addAttendee(
	firebaseApp: firebase.FirebaseApp,
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
	firebaseApp: firebase.FirebaseApp,
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
	firebaseApp: firebase.FirebaseApp,
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

export async function getUpcomingMatches(firebaseApp: firebase.FirebaseApp): Promise<IMatch[]> {
	const query = firestore.query(getMatchesCollection(firebaseApp), firestore.where('startsAt', '>', new Date()), firestore.orderBy('startsAt', 'asc'));
	const { docs } = await firestore.getDocs(query);
	const upcomingMatches = docs.map(mapMatch);
	return upcomingMatches;
}

export function didUserRespondMatch(match: IMatch | null, currentUser: IUser | undefined) {
	return match?.attendees?.some((person) => person.userId === currentUser?.id)
		|| match?.nonAttendees?.some((person) => person.userId === currentUser?.id)
		|| match?.maybeAttendees?.some((person) => person.userId === currentUser?.id);
}

export function getMatchEventName(match: IMatch) {
	return `Hanspaulka - ${match.opponent} - ${match.field}`;
}

async function updateAttendees(
	firebaseApp: firebase.FirebaseApp,
	match: IMatch,
	user: IUser,
	note: string | undefined,
	updateCallback: (currentResult: IPersonResult) => { attendee?: IPersonResult; nonAttendee?: IPersonResult; maybeAttendee?: IPersonResult },
) {
	// refresh match (prevent update conflicts)
	const doc = await getDocOfMatch(firebaseApp, match);
	match = mapMatch(doc);

	const currentAttendees = (match.attendees || []).filter(person => person.userId !== user.id);
	const currentNonAttendees = (match.nonAttendees || []).filter(person => person.userId !== user.id);
	const currentMaybeAttendees = (match.maybeAttendees || []).filter(person => person.userId !== user.id);
	const currentResult: IPersonResult = {
		userId: user.id,
		resultAt: new Date(),
	};
	if (note) {
		currentResult.note = note;
	}
	const result = updateCallback(currentResult);
	const type = safeObjectKeys(result)[0];
	const attendees = [...currentAttendees, ...result.attendee ? [result.attendee] : []];
	const nonAttendees = [...currentNonAttendees, ...result.nonAttendee ? [result.nonAttendee] : []];
	const maybeAttendees = [...currentMaybeAttendees, ...result.maybeAttendee ? [result.maybeAttendee] : []];
	console.log('attendance', type, result, attendees, nonAttendees, maybeAttendees);

	const matchDoc = await firestore.getDoc(firestore.doc(getMatchesCollection(firebaseApp), match.id));
	firestore.updateDoc(matchDoc.ref, {
		attendeesResultLog: [...match.attendeesResultLog || [], { ...currentResult, type }],
		attendees,
		nonAttendees,
		maybeAttendees,
	});
}

async function getDocOfMatch(firebaseApp: firebase.FirebaseApp, match: IMatch) {
	const doc = await firestore.getDoc(firestore.doc(getMatchesCollection(firebaseApp), match.id));
	if (!doc.exists()) {
		throw new Error(`Match ${match.id} was not found`);
	}
	return doc as firestore.QueryDocumentSnapshot<IMatch>;
}
