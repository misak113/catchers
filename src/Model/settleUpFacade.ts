import * as firebaseAuth from '@firebase/auth';
import * as database from '@firebase/database';
import { useState } from 'react';
import { getErrorMessage } from "../Util/error";
import { AuthProviderName, SettleUp } from "../Context/SettleUpContext";
import { useAsyncEffect } from '../React/async';
import settleUpDevConfig from '../settleUp.dev.json';
import settleProdConfig from '../settleUp.prod.json';

export enum SettleUpType {
	Accounting = 'accounting',
	Fines = 'fines',
}

const settleUpConfig = process.env.NODE_ENV === 'production' ? settleProdConfig : settleUpDevConfig;
export const firebase = settleUpConfig.firebase;

export const DEFAULT_CURRENCY_CODE = 'CZK';

export function getSettleUpGroupUrl(type: SettleUpType) {
	return settleUpConfig[type].shareLinkUrl;
}

enum Collection {
	Transactions = 'transactions',
	Members = 'members',
	Debts = 'debts',
}

export type SettleUpTransactionType = 'expense' | 'transfer';

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
	active: boolean;
	defaultWeight: string;
	name: string;
	photoUrl: string;
	bankAccount?: string;
}

export interface SettleUpMembers {
	[memberId: string]: SettleUpMember;
}

export interface SettleUpDebt {
	from: string;
	to: string;
	amount: string;
}

export type SettleUpDebts = SettleUpDebt[];

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

export async function createTransaction(
	settleUp: SettleUp,
	type: SettleUpType,
	transaction: SettleUpTransaction,
) {
	const db = database.getDatabase(settleUp.firebaseApp);
	const transactionRef = database.ref(db, `${Collection.Transactions}/${settleUpConfig[type].groupId}`);
	const newTransactionRef = database.push(transactionRef);
	await database.set(newTransactionRef, transaction);
}

export function useSettleUpTransactions(
	settleUp: SettleUp,
	type: SettleUpType,
	user: firebaseAuth.User | null,
) {
	const [errorMessage, setErrorMessage] = useState<string>();
	const [transactions, setTransactions] = useState<SettleUpTransactions>({});

	useAsyncEffect(async () => {
		if (user) {
			try {
				const transactions = await getSettleUpTransactions(settleUp, type);
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
	type: SettleUpType,
	user: firebaseAuth.User | null,
) {
	const [errorMessage, setErrorMessage] = useState<string>();
	const [members, setMembers] = useState<SettleUpMembers>({});

	useAsyncEffect(async () => {
		if (user) {
			try {
				const members = await getSettleUpMembers(settleUp, type);
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

export function useSettleUpDebts(
	settleUp: SettleUp,
	type: SettleUpType,
	user: firebaseAuth.User | null,
) {
	const [errorMessage, setErrorMessage] = useState<string>();
	const [debts, setDebts] = useState<SettleUpDebts>([]);

	useAsyncEffect(async () => {
		if (user) {
			try {
				const debts = await getSettleUpDebts(settleUp, type);
				setDebts(debts);
				setErrorMessage(undefined);
			} catch (error) {
				console.error(error);
				setErrorMessage(getErrorMessage(error));
			}
		}
	}, [settleUp, user]);

	return { debts, errorMessage };
}

export async function getSettleUpTransactions(
	settleUp: SettleUp,
	type: SettleUpType,
) {
	const db = database.getDatabase(settleUp.firebaseApp);
	const transactionRef = database.ref(db, `${Collection.Transactions}/${settleUpConfig[type].groupId}`);
	const transactionsSnapshot = await database.get(transactionRef);
	const transactions: SettleUpTransactions = transactionsSnapshot.val();
	console.info('settleUp.transactions', transactions);
	return transactions;
}

export async function getSettleUpMembers(
	settleUp: SettleUp,
	type: SettleUpType,
) {
	const db = database.getDatabase(settleUp.firebaseApp);
	const membersRef = database.ref(db, `${Collection.Members}/${settleUpConfig[type].groupId}`);
	const membersSnapshot = await database.get(membersRef);
	const members: SettleUpMembers = membersSnapshot.val();
	console.info('settleUp.members', members);
	return members;
}

export async function getSettleUpDebts(
	settleUp: SettleUp,
	type: SettleUpType,
) {
	const db = database.getDatabase(settleUp.firebaseApp);
	const debtsRef = database.ref(db, `${Collection.Debts}/${settleUpConfig[type].groupId}`);
	const debtsSnapshot = await database.get(debtsRef);
	const debts: SettleUpDebts = debtsSnapshot.val();
	console.info('settleUp.debts', debts);
	return debts;
}

export function calculateTotalAmount(transaction: SettleUpTransaction): number {
	return transaction.items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
}

export function transactionDescDateSorter(transactionEntry1: SettleUpTransactionEntry, transactionEntry2: SettleUpTransactionEntry) {
	return transactionEntry2[1].dateTime - transactionEntry1[1].dateTime;
}

export function debtsDescAmountSorter(debt1: SettleUpDebt, debt2: SettleUpDebt) {
	return parseFloat(debt2.amount) - parseFloat(debt1.amount);
}
