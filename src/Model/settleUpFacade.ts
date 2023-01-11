import * as firebaseAuth from '@firebase/auth';
import * as database from '@firebase/database';
import { useState } from 'react';
import { getErrorMessage } from "../Util/error";
import { AuthProviderName, SettleUp } from "../Context/SettleUpContext";
import { useAsyncEffect } from '../React/async';
import settleUpDevConfig from '../settleUp.dev.json';
import settleProdConfig from '../settleUp.prod.json';

const settleUpConfig = process.env.NODE_ENV === 'production' ? settleProdConfig : settleUpDevConfig;
export const { baseUrl, groupId, firebase } = settleUpConfig;

export function getSettleUpGroupUrl() {
	return `${baseUrl}/group/${groupId}/join`;
}

export const CurrencyMap: { [currencyCode: string]: string } = {
	CZK: 'Kč',
	EUR: '€',
	USD: '$',
};

enum Collection {
	Transactions = 'transactions',
	Members = 'members',
}

export type SettleUpTransactionType = 'expense' | 'income';

export type SettleUpTransactionParticipant = {
	memberId: string;
	weight: string;
};

export type SettleUpTransactionItem = {
	amount: string;
	forWhom: SettleUpTransactionParticipant[];
}

export interface SettleUpTransaction {
	currencyCode: string;
	dateTime: number;
	fixedExchangeRate: boolean;
	items: SettleUpTransactionItem[];
	purpose: string;
	type: SettleUpTransactionType;
	whoPaid: SettleUpTransactionParticipant[];
}

export interface SettleUpTransactions {
	[transactionId: string]: SettleUpTransaction;
}

export interface SettleUpMember {
	action: boolean;
	defaultWeight: string;
	name: string;
	photoUrl: string;
}

export interface SettleUpMembers {
	[memberId: string]: SettleUpMember;
}

type SettleUpTransactionEntry = [transactionId: string, transaction: SettleUpTransaction];

export function useSettleUpAuth(
	settleUp: SettleUp,
) {
	const [errorMessage, setErrorMessage] = useState<string>();

	const [loggingIn, setLoggingIn] = useState(false);
	const login = async (providerName: AuthProviderName) => {
		try {
			setLoggingIn(true);
			const authProvider = settleUp.firebaseAuthProviders[providerName];
			await firebaseAuth.signInWithPopup(settleUp.firebaseAuth, authProvider);
			setErrorMessage(undefined);
		} catch (error) {
			console.error(error);
			setErrorMessage(getErrorMessage(error));
		} finally {
			setLoggingIn(false);
		}
	};

	const [loggingOut, setLoggingOut] = useState(false);
	const logout = async () => {
		try {
			setLoggingOut(true);
			await firebaseAuth.signOut(settleUp.firebaseAuth);
			setErrorMessage(undefined);
		} catch (error) {
			console.error(error);
			setErrorMessage(getErrorMessage(error));
		} finally {
			setLoggingOut(false);
		}
	};

	const [loading, setLoading] = useState(true);
	const [user, setUser] = useState<firebaseAuth.User | null>(null);

	useAsyncEffect(async () => {
		const settleUpAuth = firebaseAuth.getAuth(settleUp.firebaseApp);
		const unsubscribe = settleUpAuth.onAuthStateChanged((user) => {
			console.info('settleUp.onAuthStateChanged', user);
			setUser(user);
			setLoading(false);
		});
		return unsubscribe;
	}, [settleUp.firebaseApp]);

	return { loading, user, login, loggingIn, logout, loggingOut, errorMessage };
}

export function useSettleUpTransactions(
	settleUp: SettleUp,
	user: firebaseAuth.User | null,
) {
	const [errorMessage, setErrorMessage] = useState<string>();
	const [transactions, setTransactions] = useState<SettleUpTransactions>({});

	useAsyncEffect(async () => {
		if (user) {
			try {
				const transactions = await getSettleUpTransactions(settleUp)
				setTransactions(transactions);
				setErrorMessage(undefined);
			} catch (error) {
				console.error(error);
				setErrorMessage(getErrorMessage(error));
			}
		}
	}, [settleUp, user]);

	return { transactions, errorMessage };
}

export function useSettleUpMembers(
	settleUp: SettleUp,
	user: firebaseAuth.User | null,
) {
	const [errorMessage, setErrorMessage] = useState<string>();
	const [members, setMembers] = useState<SettleUpMembers>({});

	useAsyncEffect(async () => {
		if (user) {
			try {
				const members = await getSettleUpMembers(settleUp)
				setMembers(members);
				setErrorMessage(undefined);
			} catch (error) {
				console.error(error);
				setErrorMessage(getErrorMessage(error));
			}
		}
	}, [settleUp, user]);

	return { members, errorMessage };
}

export async function getSettleUpTransactions(
	settleUp: SettleUp,
) {
	const db = database.getDatabase(settleUp.firebaseApp);
	const transactionRef = database.ref(db, `${Collection.Transactions}/${groupId}`);
	const transactionsSnapshot = await database.get(transactionRef);
	const transactions: SettleUpTransactions = transactionsSnapshot.val();
	console.info('settleUp.transactions', transactions);
	return transactions;
}

export async function getSettleUpMembers(
	settleUp: SettleUp,
) {
	const db = database.getDatabase(settleUp.firebaseApp);
	const membersRef = database.ref(db, `${Collection.Members}/${groupId}`);
	const membersSnapshot = await database.get(membersRef);
	const members: SettleUpMembers = membersSnapshot.val();
	console.info('settleUp.members', members);
	return members;
}

export function calculateTotalAmount(transaction: SettleUpTransaction): number {
	return transaction.items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
}

export function transactionDescDateSorter(transactionEntry1: SettleUpTransactionEntry, transactionEntry2: SettleUpTransactionEntry) {
	return transactionEntry2[1].dateTime - transactionEntry1[1].dateTime;
}
