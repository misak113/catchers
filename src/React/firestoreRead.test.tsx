import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { initializeApp } from '@firebase/app';
import { disableNetwork, enableNetwork } from '@firebase/firestore';
import { FIRESTORE_READ_TIMEOUT_MS, useFirestoreRead } from './firestoreRead';

jest.mock('@firebase/firestore', () => ({
	getFirestore: jest.fn(),
	disableNetwork: jest.fn<() => Promise<void>>(),
	enableNetwork: jest.fn<() => Promise<void>>(),
}));

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
const firebaseApp = initializeApp({ projectId: 'resume-regression' }, 'resume-regression');
const load = jest.fn<() => Promise<string>>();

const Screen = ({ identity = 'first', enabled = true }: { identity?: string; enabled?: boolean }) => {
	const [error, setError] = useState<string>();
	const { data, loading, retry } = useFirestoreRead(firebaseApp, enabled, load, [identity], setError);
	return <button onClick={retry}>{error || data || (loading ? 'waiting' : 'idle')}</button>;
};

function visibility(state: 'hidden' | 'visible') {
	Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
	document.dispatchEvent(new Event('visibilitychange'));
}

describe('resumable Firestore reads', () => {
	let root: Root;
	let container: HTMLDivElement;

	beforeEach(() => {
		jest.useFakeTimers();
		jest.mocked(disableNetwork).mockResolvedValue(undefined);
		jest.mocked(enableNetwork).mockResolvedValue(undefined);
		Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
		container = document.createElement('div');
		root = createRoot(container);
	});

	afterEach(async () => {
		await act(async () => root.unmount());
		jest.useRealTimers();
	});

	it('ends stalled loading with an actionable timeout and allows retry', async () => {
		load.mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue('recovered');
		await act(async () => root.render(<Screen />));
		expect(container.textContent).toBe('waiting');
		await act(async () => jest.advanceTimersByTime(FIRESTORE_READ_TIMEOUT_MS));
		expect(container.textContent).toContain('Zkontroluj připojení');
		await act(async () => container.querySelector('button')?.click());
		expect(container.textContent).toBe('recovered');
		expect(disableNetwork).toHaveBeenCalledTimes(1);
		expect(enableNetwork).toHaveBeenCalledTimes(1);
	});

	it('refetches on foreground return and ignores an older suspended result', async () => {
		let finish: ((result: string) => void) | undefined;
		load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue('fresh');
		await act(async () => root.render(<Screen />));
		await act(async () => visibility('hidden'));
		expect(load).toHaveBeenCalledTimes(1);
		await act(async () => visibility('visible'));
		expect(container.textContent).toBe('fresh');
		await act(async () => finish?.('stale'));
		expect(container.textContent).toBe('fresh');
	});

	it('keeps loaded data visible during foreground refresh', async () => {
		load.mockResolvedValueOnce('loaded').mockImplementation(() => new Promise(() => {}));
		await act(async () => root.render(<Screen />));
		await act(async () => visibility('visible'));
		expect(container.textContent).toBe('loaded');
	});

	it('recovers on network return and persisted page restoration only', async () => {
		load.mockResolvedValue('loaded');
		await act(async () => root.render(<Screen />));
		await act(async () => window.dispatchEvent(new PageTransitionEvent('pageshow')));
		expect(load).toHaveBeenCalledTimes(1);
		await act(async () => window.dispatchEvent(new Event('online')));
		await act(async () => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
		expect(load).toHaveBeenCalledTimes(3);
	});

	it('shares a single connection recovery across simultaneous readers', async () => {
		load.mockResolvedValue('loaded');
		await act(async () => root.render(<><Screen /><Screen /></>));
		await act(async () => visibility('visible'));
		expect(disableNetwork).toHaveBeenCalledTimes(1);
		expect(enableNetwork).toHaveBeenCalledTimes(1);
		expect(load).toHaveBeenCalledTimes(4);
	});

	it('ignores late failures and does not retry after logout', async () => {
		let fail: ((error: Error) => void) | undefined;
		load.mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; }));
		await act(async () => root.render(<Screen />));
		await act(async () => root.render(<Screen enabled={false} />));
		await act(async () => fail?.(new Error('stale')));
		await act(async () => visibility('visible'));
		await act(async () => jest.advanceTimersByTime(FIRESTORE_READ_TIMEOUT_MS));
		expect(container.textContent).toBe('idle');
		expect(load).toHaveBeenCalledTimes(1);
	});

	it('clears data and ignores old reads when switching identities', async () => {
		load.mockResolvedValueOnce('first').mockImplementation(() => new Promise(() => {}));
		await act(async () => root.render(<Screen />));
		await act(async () => root.render(<Screen identity="second" />));
		expect(container.textContent).toBe('waiting');
	});

	it('reports reconnect failure and can retry again', async () => {
		load.mockResolvedValue('loaded');
		jest.mocked(enableNetwork).mockRejectedValueOnce(new Error('Reconnect failed'));
		await act(async () => root.render(<Screen />));
		await act(async () => visibility('visible'));
		expect(container.textContent).toBe('Reconnect failed');
		await act(async () => window.dispatchEvent(new Event('online')));
		expect(container.textContent).toBe('loaded');
	});

	it('cleans up listeners and timers on unmount', async () => {
		load.mockImplementation(() => new Promise(() => {}));
		await act(async () => root.render(<Screen />));
		await act(async () => root.unmount());
		root = createRoot(container);
		await act(async () => visibility('visible'));
		await act(async () => jest.advanceTimersByTime(FIRESTORE_READ_TIMEOUT_MS));
		expect(load).toHaveBeenCalledTimes(1);
		expect(container.textContent).toBe('');
	});
});
