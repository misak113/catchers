import * as firebase from '@firebase/app';
import _ from 'lodash';
import * as firestore from '@firebase/firestore';

export const MATCHES = 'matches';

export interface IPersonResult {
	userId: string;
	resultAt: Date;
	note?: string;
}

export type AttendeeType = 'attendee' | 'nonAttendee' | 'maybeAttendee';

export interface IMatch {
	id: string;
	startsAt: Date;
	opponent: string;
	field: string;
	referees?: string[];
	attendees?: IPersonResult[];
	nonAttendees?: IPersonResult[];
	maybeAttendees?: IPersonResult[];
	attendeesResultLog?: (IPersonResult & { type: AttendeeType })[];
}

export function getMatchesCollection(firebaseApp: firebase.FirebaseApp) {
	const matchesCollection = firestore.collection(firestore.getFirestore(firebaseApp), MATCHES);
	return matchesCollection as firestore.CollectionReference<IMatch>;
}

function mapPersonResult(doc: any) {
	return _.omitBy({
		userId: doc.userId,
		resultAt: doc.resultAt.toDate(),
		note: doc.note,
		type: doc.type,
	}, _.isUndefined);
}

export function mapMatch<T extends firestore.DocumentSnapshot>(
	doc: T
): T extends firestore.QueryDocumentSnapshot<IMatch> ? IMatch : IMatch | null {
	const data = doc.data();
	if (!data) {
		return null!; // as ReturnType<typeof mapMatch<T>>
	}
	return {
		id: doc.id,
		startsAt: data.startsAt.toDate(),
		field: data.field,
		opponent: data.opponent,
		referees: data.referees,
		attendees: data.attendees?.map(mapPersonResult),
		nonAttendees: data.nonAttendees?.map(mapPersonResult),
		maybeAttendees: data.maybeAttendees?.map(mapPersonResult),
		attendeesResultLog: data.attendeesResultLog?.map(mapPersonResult),
	};
}

export const USERS = 'users';

export interface IUser {
	id: string;
	email: string;
	name?: string;
	player: boolean;
	linkedUserUid?: string;
}

export function getUsersCollection(firebaseApp: firebase.FirebaseApp) {
	const usersCollection = firestore.collection(firestore.getFirestore(firebaseApp), USERS);
	return usersCollection as firestore.CollectionReference<IUser>;
}

export function mapUser(doc: firestore.QueryDocumentSnapshot): IUser {
	const data = doc.data();
	return {
		id: doc.id,
		email: data.email,
		name: data.name,
		player: typeof data.player !== 'undefined' ? data.player : false,
		linkedUserUid: data.linkedUserUid,
	};
}
