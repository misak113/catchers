import _ from 'lodash';
import firebase from 'firebase';

export const MATCHES = 'matches';

export interface IPersonResult {
	userId: string;
	resultAt: Date;
	note?: string;
}

export interface IMatch {
	id: string;
	startsAt: Date;
	opponent: string;
	field: string;
	referees?: string[];
	attendees?: IPersonResult[];
	nonAttendees?: IPersonResult[];
	maybeAttendees?: IPersonResult[];
	attendeesResultLog?: (IPersonResult & { type: 'attendee' | 'nonAttendee' | 'maybeAttendee' })[];
}

function mapPersonResult(doc: any) {
	return _.omitBy({
		userId: doc.userId,
		resultAt: doc.resultAt.toDate(),
		note: doc.note,
		type: doc.type,
	}, _.isUndefined);
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

export function mapUser(doc: firebase.firestore.QueryDocumentSnapshot): IUser {
	const data = doc.data();
	return {
		id: doc.id,
		email: data.email,
		name: data.name,
		player: typeof data.player !== 'undefined' ? data.player : false,
		linkedUserUid: data.linkedUserUid,
	};
}
