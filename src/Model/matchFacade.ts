import * as firebase from '@firebase/app';
import * as firestore from '@firebase/firestore';
import { User as FirebaseUser } from '@firebase/auth';
import _ from 'lodash';
import { useEffect, useState } from "react";
import { getErrorMessage } from '../Util/error';
import { IMatch, mapMatch, IUser, IPersonResult, getMatchesCollection, AttendeeType } from "./collections";


export function useMatches(
	firebaseApp: firebase.FirebaseApp,
	user: FirebaseUser | null,
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [matches, setMatches] = useState<IMatch[]>();
	useEffect(() => {
		(async () => {
			try {
				const { docs } = await firestore.getDocs(getMatchesCollection(firebaseApp));
				const matches = docs.map(mapMatch);
				console.log('matches', matches);
				setMatches(matches);
				setErrorMessage(undefined);
			} catch (error) {
				console.error(error);
				setErrorMessage(getErrorMessage(error));
			}
		})();
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
	const [match, setMatch] = useState<IMatch>();
	useEffect(() => {
		(async () => {
			try {
				const doc = await firestore.getDoc(firestore.doc(getMatchesCollection(firebaseApp), matchId));
				const match = doc.exists() ? mapMatch(doc as firestore.QueryDocumentSnapshot) : undefined;
				console.log('match', match);
				setMatch(match);
				setErrorMessage(undefined);
			} catch (error) {
				console.error(error);
				setErrorMessage(getErrorMessage(error));
			}
		})();
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
	const currentResult = _.omitBy<IPersonResult>({
		userId: user.id,
		resultAt: new Date(),
		note,
	}, _.isUndefined) as IPersonResult;
	const result = updateCallback(currentResult);
	const type = Object.keys(result)[0] as AttendeeType;
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
	return doc as firestore.QueryDocumentSnapshot;
}
