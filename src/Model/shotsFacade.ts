import * as firebase from '@firebase/app';
import * as firestore from '@firebase/firestore';
import { User as FirebaseUser } from '@firebase/auth';
import { useState } from 'react';
import { useAsyncEffect } from '../React/async';
import { getErrorMessage } from '../Util/error';

export const SHOT_TYPES = 'shotTypes';
export const SHOT_EVENTS = 'shotEvents';

export enum ShotEventType {
	Debt = 'debt',
	Settlement = 'settlement',
}

type ShotTypeDoc = {
	name: string;
	description?: string;
	defaultAmount: number;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
};

type ShotEventDoc = {
	userId: string;
	type: ShotEventType;
	shotTypeId?: string;
	shotTypeName?: string;
	amount: number;
	description?: string;
	eventAt: Date;
	createdAt: Date;
	createdByUserId?: string;
};

export interface IShotType extends ShotTypeDoc {
	id: string;
}

export interface IShotEvent extends ShotEventDoc {
	id: string;
}

export type IShotBalance = {
	userId: string;
	debt: number;
	settled: number;
	balance: number;
};

export function getShotTypesCollection(firebaseApp: firebase.FirebaseApp) {
	const shotTypesCollection = firestore.collection(firestore.getFirestore(firebaseApp), SHOT_TYPES);
	return shotTypesCollection as firestore.CollectionReference<ShotTypeDoc>;
}

export function getShotEventsCollection(firebaseApp: firebase.FirebaseApp) {
	const shotEventsCollection = firestore.collection(firestore.getFirestore(firebaseApp), SHOT_EVENTS);
	return shotEventsCollection as firestore.CollectionReference<ShotEventDoc>;
}

function mapDateValue(value: unknown) {
	if (value instanceof Date) {
		return value;
	}
	if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
		return value.toDate();
	}
	return new Date();
}

function mapShotType(doc: firestore.QueryDocumentSnapshot<ShotTypeDoc>): IShotType {
	const data = doc.data();
	return {
		id: doc.id,
		name: data.name,
		description: data.description,
		defaultAmount: data.defaultAmount,
		active: data.active,
		createdAt: mapDateValue(data.createdAt),
		updatedAt: mapDateValue(data.updatedAt),
	};
}

function mapShotEvent(doc: firestore.QueryDocumentSnapshot<ShotEventDoc>): IShotEvent {
	const data = doc.data();
	return {
		id: doc.id,
		userId: data.userId,
		type: data.type,
		shotTypeId: data.shotTypeId,
		shotTypeName: data.shotTypeName,
		amount: data.amount,
		description: data.description,
		eventAt: mapDateValue(data.eventAt),
		createdAt: mapDateValue(data.createdAt),
		createdByUserId: data.createdByUserId,
	};
}

export function useShotTypes(
	firebaseApp: firebase.FirebaseApp,
	user: FirebaseUser | null,
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [shotTypes, setShotTypes] = useState<IShotType[]>([]);
	useAsyncEffect(async () => {
		if (!user) {
			setShotTypes([]);
			return;
		}
		try {
			const query = firestore.query(getShotTypesCollection(firebaseApp), firestore.orderBy('name', 'asc'));
			const { docs } = await firestore.getDocs(query);
			setShotTypes(docs.map(mapShotType));
			setErrorMessage(undefined);
		} catch (error) {
			console.error(error);
			setErrorMessage(getErrorMessage(error));
		}
	}, [firebaseApp, user, setErrorMessage]);
	return [shotTypes];
}

export function useShotEvents(
	firebaseApp: firebase.FirebaseApp,
	user: FirebaseUser | null,
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [shotEvents, setShotEvents] = useState<IShotEvent[]>([]);
	useAsyncEffect(async () => {
		if (!user) {
			setShotEvents([]);
			return;
		}
		try {
			const query = firestore.query(getShotEventsCollection(firebaseApp), firestore.orderBy('eventAt', 'desc'));
			const { docs } = await firestore.getDocs(query);
			setShotEvents(docs.map(mapShotEvent));
			setErrorMessage(undefined);
		} catch (error) {
			console.error(error);
			setErrorMessage(getErrorMessage(error));
		}
	}, [firebaseApp, user, setErrorMessage]);
	return [shotEvents];
}

export async function addShotType(
	firebaseApp: firebase.FirebaseApp,
	shotType: Pick<IShotType, 'name' | 'description' | 'defaultAmount'>,
) {
	const now = new Date();
	await firestore.addDoc(getShotTypesCollection(firebaseApp), {
		name: shotType.name,
		description: shotType.description,
		defaultAmount: shotType.defaultAmount,
		active: true,
		createdAt: now,
		updatedAt: now,
	});
}

export async function updateShotType(
	firebaseApp: firebase.FirebaseApp,
	shotTypeId: string,
	shotType: Partial<Pick<IShotType, 'name' | 'description' | 'defaultAmount' | 'active'>>,
) {
	const shotTypeRef = firestore.doc(getShotTypesCollection(firebaseApp), shotTypeId);
	await firestore.updateDoc(shotTypeRef, {
		...shotType,
		updatedAt: new Date(),
	});
}

export async function addShotDebtEvent(
	firebaseApp: firebase.FirebaseApp,
	shotEvent: {
		userId: string;
		amount: number;
		eventAt: Date;
		shotTypeId: string;
		shotTypeName: string;
		description?: string;
		createdByUserId?: string;
	},
) {
	await firestore.addDoc(getShotEventsCollection(firebaseApp), {
		userId: shotEvent.userId,
		type: ShotEventType.Debt,
		amount: shotEvent.amount,
		eventAt: shotEvent.eventAt,
		shotTypeId: shotEvent.shotTypeId,
		shotTypeName: shotEvent.shotTypeName,
		description: shotEvent.description,
		createdByUserId: shotEvent.createdByUserId,
		createdAt: new Date(),
	});
}

export async function addShotSettlementEvent(
	firebaseApp: firebase.FirebaseApp,
	shotEvent: {
		userId: string;
		amount: number;
		eventAt: Date;
		description?: string;
		createdByUserId?: string;
	},
) {
	await firestore.addDoc(getShotEventsCollection(firebaseApp), {
		userId: shotEvent.userId,
		type: ShotEventType.Settlement,
		amount: shotEvent.amount,
		eventAt: shotEvent.eventAt,
		description: shotEvent.description,
		createdByUserId: shotEvent.createdByUserId,
		createdAt: new Date(),
	});
}

export async function importShotEvents(
	firebaseApp: firebase.FirebaseApp,
	events: Array<{
		userId: string;
		amount: number;
		eventAt: Date;
		shotTypeId: string;
		shotTypeName: string;
		description?: string;
		createdByUserId?: string;
	}>,
) {
	const db = firestore.getFirestore(firebaseApp);
	const batch = firestore.writeBatch(db);
	for (const event of events) {
		const shotEventRef = firestore.doc(getShotEventsCollection(firebaseApp));
		const isSettlement = event.amount < 0;
		const shotEventData: ShotEventDoc = {
			userId: event.userId,
			type: isSettlement ? ShotEventType.Settlement : ShotEventType.Debt,
			amount: Math.abs(event.amount),
			eventAt: event.eventAt,
			description: event.description,
			createdByUserId: event.createdByUserId,
			createdAt: new Date(),
			...(isSettlement ? {} : {
				shotTypeId: event.shotTypeId,
				shotTypeName: event.shotTypeName,
			}),
		};
		batch.set(shotEventRef, {
			...shotEventData,
		});
	}
	await batch.commit();
}

export function calculateShotBalances(shotEvents: IShotEvent[]) {
	const balances: { [userId: string]: IShotBalance } = {};
	for (const event of shotEvents) {
		const currentBalance = balances[event.userId] ?? {
			userId: event.userId,
			debt: 0,
			settled: 0,
			balance: 0,
		};
		if (event.type === ShotEventType.Debt) {
			currentBalance.debt += event.amount;
			currentBalance.balance += event.amount;
		} else {
			currentBalance.settled += event.amount;
			currentBalance.balance -= event.amount;
		}
		balances[event.userId] = currentBalance;
	}
	return balances;
}
