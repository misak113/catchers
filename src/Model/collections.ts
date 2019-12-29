
import firebase from 'firebase';

export const MATCHES = 'matches';

export interface IPersonResult {
	email: string;
	resultAt: Date;
}

export interface IMatch {
	id: string;
	startsAt: Date;
	opponent: string;
	field: string;
	referees?: string[];
	attendees?: IPersonResult[];
	nonAttendees?: IPersonResult[];
}

function mapPersonResult(doc: any) {
	return {
		email: doc.email,
		resultAt: doc.resultAt.toDate(),
	};
}

export function mapMatch(doc: firebase.firestore.QueryDocumentSnapshot): IMatch {
	const data = doc.data();
	return {
		id: doc.id,
		startsAt: data.startsAt.toDate(),
		field: data.field,
		opponent: data.opponent,
		referees: data.referees,
		attendees: data.attendees?.map(mapPersonResult),
		nonAttendees: data.nonAttendees?.map(mapPersonResult),
	};
}

export const USERS = 'users';

export interface IUser {
	id: string;
	email: string;
	name?: string;
	player: boolean;
}

export function mapUser(doc: firebase.firestore.QueryDocumentSnapshot): IUser {
	const data = doc.data();
	return {
		id: doc.id,
		email: data.email,
		name: data.name,
		player: typeof data.player !== 'undefined' ? data.player : false,
	};
}
