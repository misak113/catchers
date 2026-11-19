import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { initializeApp } from '@firebase/app';
import type { User } from '@firebase/auth';
import { AuthProvider, AUTH_RESTORE_TIMEOUT_MS } from '../Context/AuthContext';
import { FirebaseContext } from '../Context/FirebaseContext';
import { FIRESTORE_READ_TIMEOUT_MS } from '../React/firestoreRead';
import Matches from './Matches';

const mockObserve = jest.fn<(next: (user: User | null) => void, error: () => void) => () => void>();
const mockGetDocs = jest.fn<(kind: string) => Promise<{ docs: [] }>>();
const mockRecover = jest.fn<() => Promise<void>>();
const mockFetch = jest.fn<typeof fetch>();
jest.mock('@firebase/auth', () => ({
	getAuth: () => ({ onAuthStateChanged: mockObserve }),
	FacebookAuthProvider: class { addScope() {} },
}));
jest.mock('@firebase/firestore', () => ({
	getFirestore: jest.fn(), collection: jest.fn(), orderBy: jest.fn(), limit: jest.fn(),
	where: (_field: string, operator: string) => operator,
	query: (_collection: unknown, firstConstraint?: string) => firstConstraint,
	getDocs: (kind: string) => mockGetDocs(kind),
	disableNetwork: () => mockRecover(), enableNetwork: async () => {},
}));
jest.mock('../Components/Match/SyncMatches', () => ({ __esModule: true, default: () => null }));
jest.mock('react-chartjs-2', () => ({ Bar: () => <div>History chart rendered</div> }));

const firebaseApp = initializeApp({ projectId: 'matches-page-test' }, 'matches-page-test');
const user: User = {
	uid: 'test-account', email: null, displayName: null, phoneNumber: null, photoURL: null,
	emailVerified: false, isAnonymous: false, providerId: 'firebase', providerData: [],
	metadata: {}, refreshToken: '', tenantId: null,
	delete: async () => {}, getIdToken: async () => '',
	getIdTokenResult: async () => { throw new Error('Not used'); },
	reload: async () => {}, toJSON: () => ({}),
};
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });

let root: Root;
let container: HTMLDivElement;
const originalFetch = globalThis.fetch;
const table = (index: number) => container.querySelectorAll('table')[index];
const mount = () => act(async () => root.render(
	<FirebaseContext.Provider value={{ firebaseApp }}>
		<AuthProvider><Matches/></AuthProvider>
	</FirebaseContext.Provider>
));

beforeEach(() => {
	jest.useFakeTimers();
	window.history.replaceState(null, "", "/zapasy");
	mockObserve.mockClear();
	mockGetDocs.mockClear();
	mockFetch.mockClear();
	container = document.createElement('div');
	root = createRoot(container);
	globalThis.fetch = mockFetch;
	mockObserve.mockImplementation(() => jest.fn());
	mockRecover.mockResolvedValue(undefined);
	mockFetch.mockResolvedValue(new Response(JSON.stringify({
		matches: [{ startsAtIso: '2026-04-01T17:00:00Z', opponentName: 'Test', score: { home: 1, away: 0 } }],
	})));
});

afterEach(async () => {
	await act(async () => root.unmount());
	globalThis.fetch = originalFetch;
	jest.useRealTimers();
});

describe('matches page loading', () => {
	it('times out suspended auth, coalesces retry, ignores stale auth, and shows sign-in without hiding history', async () => {
		await mount();
		expect(table(0).textContent).toContain('Ověřuji přihlášení');
		expect(container.textContent).toContain('History chart rendered');
		expect(mockGetDocs).not.toHaveBeenCalled();
		jest.setSystemTime(Date.now() + AUTH_RESTORE_TIMEOUT_MS + 1);
		await act(async () => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
		expect(table(0).textContent).toContain('Přihlášení se nepodařilo ověřit');
		await act(async () => container.querySelectorAll('table button').forEach(button => {
			if (button instanceof HTMLButtonElement) button.click();
		}));
		expect(mockObserve).toHaveBeenCalledTimes(2);
		await act(async () => mockObserve.mock.calls[0][0](user));
		expect(table(0).textContent).toContain('Ověřuji přihlášení');
		await act(async () => mockObserve.mock.calls[1][0](null));
		expect(table(0).textContent).toContain('přihlas pomocí nabídky');
		expect(table(1).textContent).toContain('přihlas pomocí nabídky');
		expect(mockGetDocs).not.toHaveBeenCalled();
		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(container.textContent).toContain('History chart rendered');
	});

	it('shows independent results and retries only the failed table', async () => {
		mockGetDocs.mockImplementation(kind => kind === '>' ? new Promise(() => {}) : Promise.resolve({ docs: [] }));
		await mount();
		await act(async () => mockObserve.mock.calls[0][0](user));
		expect(table(0).textContent).toContain('Načítám zápasy');
		expect(table(1).textContent).toContain('Žádné zápasy');
		await act(async () => jest.advanceTimersByTime(FIRESTORE_READ_TIMEOUT_MS));
		expect(table(0).textContent).toContain('Zápasy se nepodařilo načíst');
		expect(table(1).textContent).toContain('Žádné zápasy');
		mockGetDocs.mockClear().mockResolvedValue({ docs: [] });
		await act(async () => table(0).querySelector('button')?.click());
		expect(mockGetDocs.mock.calls).toEqual([['>']]);
		expect(table(0).textContent).toContain('Žádné zápasy');
	});
});
