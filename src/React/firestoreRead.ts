import { FirebaseApp } from '@firebase/app';
import { disableNetwork, enableNetwork, getFirestore } from '@firebase/firestore';
import { DependencyList, useLayoutEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../Util/error';
import { reportLoadingFailure, type LoadingOperation } from '../monitoring';

export const FIRESTORE_READ_TIMEOUT_MS = 20000;
const networkRecoveries = new WeakMap<FirebaseApp, Promise<void>>();

function recoverNetwork(firebaseApp: FirebaseApp) {
	const pending = networkRecoveries.get(firebaseApp);
	if (pending) {
		return pending;
	}
	const database = getFirestore(firebaseApp);
	const recovery = disableNetwork(database).then(() => enableNetwork(database));
	networkRecoveries.set(firebaseApp, recovery);
	void recovery.then(() => networkRecoveries.delete(firebaseApp), () => networkRecoveries.delete(firebaseApp));
	return recovery;
}

export function useFirestoreRead<T>(
	firebaseApp: FirebaseApp,
	enabled: boolean,
	load: () => Promise<T>,
	deps: DependencyList,
	setErrorMessage?: (errorMessage: string | undefined) => void,
	operation?: LoadingOperation,
) {
	const [data, setData] = useState<T>();
	const [loading, setLoading] = useState(enabled);
	const [error, setError] = useState<string>();
	const [hasLoaded, setHasLoaded] = useState(false);
	const [reloadIndex, setReloadIndex] = useState(0);
	const retry = useRef<() => void>(() => {});

	useLayoutEffect(() => {
		setData(undefined);
		setHasLoaded(false);
		setError(undefined);
		setLoading(enabled);
		if (!enabled) {
			return;
		}
		let generation = 0;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let deadline: number | undefined;
		let recoveryStarted = false;
		let requiresRetry = false;
		const finish = () => {
			generation++;
			deadline = undefined;
			clearTimeout(timer);
			setLoading(false);
		};
		const fail = (message: string, reason: 'timeout' | 'request' | 'reconnect') => {
			requiresRetry = reason === 'timeout';
			finish();
			setError(message);
			setErrorMessage?.(message);
			if (operation) {
				reportLoadingFailure(operation, reason);
			}
		};
		const expire = () => fail('Načítání dat trvá příliš dlouho. Zkontroluj připojení a zkus to znovu.', 'timeout');
		const start = (recover: boolean, manual = false) => {
			if (deadline !== undefined && Date.now() >= deadline) {
				expire();
			}
			if (requiresRetry && !manual) {
				return;
			}
			if (deadline === undefined) {
				deadline = Date.now() + FIRESTORE_READ_TIMEOUT_MS;
				recoveryStarted = false;
				requiresRetry = false;
				setError(undefined);
				setErrorMessage?.(undefined);
				setLoading(true);
				timer = setTimeout(expire, FIRESTORE_READ_TIMEOUT_MS);
			}
			// A resume may replace a stuck read once, without extending its deadline.
			if (recover && recoveryStarted) {
				return;
			}
			recoveryStarted = recover;
			const currentGeneration = ++generation;
			const isCurrent = () => {
				if (currentGeneration !== generation) {
					return false;
				}
				if (deadline !== undefined && Date.now() >= deadline) {
					expire();
					return false;
				}
				return true;
			};
			const request = async () => {
				let stage: 'reconnect' | 'request' = recover ? 'reconnect' : 'request';
				try {
					if (recover) {
						await recoverNetwork(firebaseApp);
					}
					if (!isCurrent()) {
						return;
					}
					stage = 'request';
					const result = await load();
					if (isCurrent()) {
						setData(result);
						setHasLoaded(true);
						finish();
					}
				} catch (error) {
					if (isCurrent()) {
						fail(getErrorMessage(error), stage);
					}
				}
			};
			void request();
		};
		const resume = () => {
			if (document.visibilityState === 'visible') {
				start(true);
			}
		};
		const restore = (event: PageTransitionEvent) => {
			if (event.persisted) {
				resume();
			}
		};
		retry.current = () => start(true, true);
		document.addEventListener('visibilitychange', resume);
		window.addEventListener('online', resume);
		window.addEventListener('pageshow', restore);
		start(false);
		return () => {
			generation++;
			clearTimeout(timer);
			retry.current = () => {};
			document.removeEventListener('visibilitychange', resume);
			window.removeEventListener('online', resume);
			window.removeEventListener('pageshow', restore);
		};
	// Load identity is supplied through deps to avoid refetching on every render.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [firebaseApp, enabled, setErrorMessage, operation, reloadIndex, ...deps]);

	return { data, error, loading, hasLoaded, reload: () => setReloadIndex(index => index + 1), retry: () => retry.current() };
}
