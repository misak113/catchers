import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { initializeApp } from '@firebase/app';
import { User } from '@firebase/auth';
import { startAfter } from '@firebase/firestore';
import { useMatch, usePastMatches, useUpcomingMatches } from './matchFacade';
import { useCurrentUser, usePossibleAttendees } from './userFacade';

const mockGetDocs = jest.fn<() => Promise<{ docs: { id: string; data: () => { startsAt: { toDate: () => Date } } }[] }>>();
const mockGetDoc = jest.fn<() => Promise<unknown>>();

jest.mock('@firebase/firestore', () => ({
	getFirestore: jest.fn(), collection: jest.fn(), query: jest.fn(),
	where: jest.fn(), orderBy: jest.fn(), limit: jest.fn(), startAfter: jest.fn(),
	doc: jest.fn(), getDocs: () => mockGetDocs(), getDoc: () => mockGetDoc(),
}));
jest.mock('./psmfFacade', () => ({}));
jest.mock('./mailFacade', () => ({}));
jest.mock('../Context/SettleUpContext', () => ({ AuthProviderName: {} }));

const firebaseApp = initializeApp({ projectId: 'auth-regression' }, 'auth-regression');
const user: User = {
	uid: 'signed-in', email: null, displayName: null, phoneNumber: null, photoURL: null,
	emailVerified: false, isAnonymous: false, providerId: 'firebase', providerData: [],
	metadata: {}, refreshToken: '', tenantId: null,
	delete: async () => {}, getIdToken: async () => '',
	getIdTokenResult: async () => { throw new Error('Not used'); },
	reload: async () => {}, toJSON: () => ({}),
};

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });

describe('authenticated match reads', () => {
	let root: Root;
	let container: HTMLDivElement;
	let errorSpy: ReturnType<typeof jest.spyOn>;
	const getDocs = mockGetDocs;

	const Screen = ({ currentUser }: { currentUser: User | null }) => {
		const [error, setError] = useState<string>();
		const upcoming = useUpcomingMatches({ firebaseApp, user: currentUser, setErrorMessage: setError });
		usePastMatches(firebaseApp, currentUser, setError);
		useMatch('match', firebaseApp, currentUser, setError);
		usePossibleAttendees(firebaseApp, currentUser, setError);
		useCurrentUser(firebaseApp, currentUser, setError);
		return <div>{error || (upcoming ? 'loaded' : 'waiting')}</div>;
	};

	beforeEach(() => {
		container = document.createElement('div');
		root = createRoot(container);
		errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(async () => {
		await act(async () => root.unmount());
		errorSpy.mockRestore();
	});

	it('does not read protected collections before auth restores', async () => {
		await act(async () => root.render(<Screen currentUser={null} />));
		expect(getDocs).not.toHaveBeenCalled();
		expect(mockGetDoc).not.toHaveBeenCalled();
		expect(container.textContent).toBe('waiting');
	});

	it('reads after auth restoration and reports permission denial', async () => {
		getDocs.mockRejectedValue(new Error('Missing or insufficient permissions.'));
		mockGetDoc.mockRejectedValue(new Error('Missing or insufficient permissions.'));
		await act(async () => root.render(<Screen currentUser={null} />));
		await act(async () => root.render(<Screen currentUser={user} />));
		expect(getDocs).toHaveBeenCalledTimes(4);
		expect(mockGetDoc).toHaveBeenCalledTimes(1);
		expect(container.textContent).toBe('Missing or insufficient permissions.');
	});

	it('ignores failures that finish after logout', async () => {
		const rejectors: ((error: Error) => void)[] = [];
		getDocs.mockImplementation(() => new Promise((_resolve, reject) => rejectors.push(reject)));
		mockGetDoc.mockImplementation(() => new Promise((_resolve, reject) => rejectors.push(reject)));
		await act(async () => root.render(<Screen currentUser={user} />));
		await act(async () => root.render(<Screen currentUser={null} />));
		await act(async () => rejectors.forEach(reject => reject(new Error('Stale denial'))));
		expect(container.textContent).toBe('waiting');
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it('ignores upcoming results after logout and refetches on sign-in', async () => {
		let finish: (() => void) | undefined;
		getDocs.mockImplementation(() => new Promise(resolve => { finish = () => resolve({ docs: [] }); }));
		const Upcoming = ({ currentUser }: { currentUser: User | null }) => {
			const [error, setError] = useState<string>();
			const matches = useUpcomingMatches({ firebaseApp, user: currentUser, setErrorMessage: setError });
			return <div>{error || (matches ? 'loaded' : 'waiting')}</div>;
		};
		await act(async () => root.render(<Upcoming currentUser={user} />));
		await act(async () => root.render(<Upcoming currentUser={null} />));
		await act(async () => finish?.());
		expect(container.textContent).toBe('waiting');
		await act(async () => root.render(<Upcoming currentUser={user} />));
		await act(async () => finish?.());
		expect(container.textContent).toBe('loaded');
		expect(getDocs).toHaveBeenCalledTimes(2);
	});
	it('preserves a denied-read error when another read succeeds later', async () => {
		let finish: (() => void) | undefined;
		getDocs.mockRejectedValueOnce(new Error('Denied'));
		getDocs.mockImplementation(() => new Promise(resolve => { finish = () => resolve({ docs: [] }); }));
		mockGetDoc.mockRejectedValue(new Error('Denied'));
		await act(async () => root.render(<Screen currentUser={user} />));
		expect(container.textContent).toBe('Denied');
		await act(async () => finish?.());
		expect(container.textContent).toBe('Denied');
	});

	it('resets pagination and cursors when switching directly between users', async () => {
		const docs = ['first', 'second'].map(id => ({ id, data: () => ({ startsAt: { toDate: () => new Date(0) } }) }));
		getDocs.mockResolvedValue({ docs });
		const Past = ({ currentUser }: { currentUser: User }) => {
			const [, setError] = useState<string>();
			const page = usePastMatches(firebaseApp, currentUser, setError, 1);
			return <button onClick={page.goToNextPage}>{page.pageIndex}</button>;
		};
		await act(async () => root.render(<Past currentUser={user} />));
		await act(async () => container.querySelector('button')?.click());
		expect(container.textContent).toBe('1');
		expect(startAfter).toHaveBeenCalledTimes(1);
		await act(async () => root.render(<Past currentUser={{ ...user, uid: 'another-user' }} />));
		expect(container.textContent).toBe('0');
		expect(startAfter).toHaveBeenCalledTimes(1);
		expect(getDocs).toHaveBeenCalledTimes(3);
	});

});
