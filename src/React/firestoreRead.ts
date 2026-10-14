import { FirebaseApp } from '@firebase/app';
import { disableNetwork, enableNetwork, getFirestore } from '@firebase/firestore';
import { DependencyList, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../Util/error';

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
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [data, setData] = useState<T>();
	const [loading, setLoading] = useState(enabled);
	const [hasLoaded, setHasLoaded] = useState(false);
	const [reloadIndex, setReloadIndex] = useState(0);
	const retry = useRef<() => void>(() => {});

	useEffect(() => {
		setData(undefined);
		setHasLoaded(false);
		setLoading(enabled);
		if (!enabled) {
			return;
		}
		let generation = 0;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const start = (recover: boolean) => {
			const currentGeneration = ++generation;
			clearTimeout(timer);
			setErrorMessage(undefined);
			setLoading(true);
			timer = setTimeout(() => {
				if (currentGeneration === generation) {
					generation++;
					setLoading(false);
					setErrorMessage('Načítání dat trvá příliš dlouho. Zkontroluj připojení a zkus to znovu.');
				}
			}, FIRESTORE_READ_TIMEOUT_MS);
			const request = async () => {
				try {
					if (recover) {
						await recoverNetwork(firebaseApp);
					}
					if (currentGeneration !== generation) {
						return;
					}
					const result = await load();
					if (currentGeneration === generation) {
						setData(result);
						setHasLoaded(true);
					}
				} catch (error) {
					if (currentGeneration === generation) {
						setErrorMessage(getErrorMessage(error));
					}
				} finally {
					if (currentGeneration === generation) {
						clearTimeout(timer);
						setLoading(false);
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
		retry.current = () => start(true);
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
	}, [firebaseApp, enabled, setErrorMessage, reloadIndex, ...deps]);

	return { data, loading, hasLoaded, reload: () => setReloadIndex(index => index + 1), retry: () => retry.current() };
}
