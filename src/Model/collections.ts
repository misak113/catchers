import * as firebase from '@firebase/app';
import _ from 'lodash';
import * as firestore from '@firebase/firestore';
import { AuthProviderName } from '../Context/SettleUpContext';

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
	tournament?: string;
	group?: string;
	field: string;
	referees?: string[];
	attendees?: IPersonResult[];
	nonAttendees?: IPersonResult[];
	maybeAttendees?: IPersonResult[];
	attendeesResultLog?: (IPersonResult & { type: AttendeeType })[];
	notificationsSent?: { [userId: string]: {
		notifiedAt: Date;
		email: string;
	} };
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
		tournament: data.tournament,
		group: data.group,
		referees: data.referees,
		attendees: data.attendees?.map(mapPersonResult),
		nonAttendees: data.nonAttendees?.map(mapPersonResult),
		maybeAttendees: data.maybeAttendees?.map(mapPersonResult),
		attendeesResultLog: data.attendeesResultLog?.map(mapPersonResult),
		notificationsSent: data.notificationsSent,
	};
}

export const USERS = 'users';

export enum Privilege {
	WriteFines = 'writeFines',
	SyncMatches = 'syncMatches',
}

export interface IUser {
	id: string;
	email: string;
	name?: string;
	player: boolean;
	linkedUserUids?: string[];
	settleUpProviderName?: AuthProviderName;
	privileges?: Privilege[];
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
		linkedUserUids: data.linkedUserUids,
		settleUpProviderName: data.settleUpProviderName,
		privileges: data.privileges,
	};
}

export const MAILS = 'mail';

export interface IMail {
	to: string[];
	message: {
		subject: string;
		text: string;
		html: string;
	};
	delivery?: {
		startTime: Date;
		state: 'ERROR' | 'PROCESSING' | 'PENDING' | 'SUCCESS';
		attempts: number;
		endTime?: Date;
		error?: string | null;
		leaseExpireTime?: Date | null;
		info?: {
			messageId: string | null;
			accepted: string[];
			rejected: string[];
			pending: string[];
			response: string | null;
		};
	};
}

export function getMailsCollection(firebaseApp: firebase.FirebaseApp) {
	const mailsCollection = firestore.collection(firestore.getFirestore(firebaseApp), MAILS);
	return mailsCollection as firestore.CollectionReference<IMail>;
}

export const USER_PLAYER_LINK_REQUESTS = 'userPlayerLinkRequests';

export interface IUserPlayerLinkRequest {
	id: string;
	hash: string;
	userUid: string;
	/** The ID string from the collection key (not firebase auth user uid) */
	playerId: string;
	requestedAt: Date;
	linkedAt: Date | null;
}

export function getUserPlayerLinkRequestsCollection(firebaseApp: firebase.FirebaseApp) {
	const requestsCollection = firestore.collection(firestore.getFirestore(firebaseApp), USER_PLAYER_LINK_REQUESTS);
	return requestsCollection as firestore.CollectionReference<IUserPlayerLinkRequest>;
}

export function mapUserPlayerLinkRequest(doc: firestore.QueryDocumentSnapshot): IUserPlayerLinkRequest {
	const data = doc.data();
	return {
		id: doc.id,
		hash: data.hash,
		playerId: data.playerId,
		userUid: data.userUid,
		requestedAt: data.requestedAt.toDate(),
		linkedAt: data.linkedAt?.toDate(),
	};
}
