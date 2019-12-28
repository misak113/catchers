
import firebase from 'firebase';

export const MATCHES = 'matches';

export interface IMatch {
	id: string;
	startsAt: Date;
	opponent: string;
	field: string;
	referees?: string[];
}

export function mapMatch(doc: firebase.firestore.QueryDocumentSnapshot): IMatch {
	const data = doc.data();
	return {
		id: doc.id,
		startsAt: data.startsAt.toDate(),
		field: data.field,
		opponent: data.opponent,
		referees: data.referees,
	};
}
