import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { initializeApp } from '@firebase/app';
import { getAuth, User } from '@firebase/auth';
import { SetFine, ISetFineProps } from './SetFine';
import { ISettleUpValue } from '../../Context/SettleUpContext';
import { Privilege } from '../../Model/collections';
import { getSettleUpMembers, prepareTransaction, useSettleUpAuth } from '../../Model/settleUpFacade';

jest.mock('../../Model/settleUpFacade', () => ({
	DEFAULT_CURRENCY_CODE: 'CZK', SettleUpType: { Fines: 'fines' },
	useSettleUpAuth: jest.fn(), getSettleUpMembers: jest.fn(), prepareTransaction: jest.fn(),
}));
jest.mock('./SetFine.css', () => ({}));
jest.mock('../Modal/Modal.css', () => ({}));
jest.mock('../../Model/userFacade', () => ({ hasPrivilege: (user: { privileges?: Privilege[] } | undefined, privilege: Privilege) => user?.privileges?.includes(privilege), getUserName: () => 'Test Player' }));
jest.mock('./FineTransactionTable', () => () => <div>Fine history</div>);

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
const app = initializeApp({ apiKey: 'test-key', projectId: 'isolated-test' }, 'fine-test');
const auth = getAuth(app);
const props: ISetFineProps & ISettleUpValue = {
	userId: 'player', users: [{ id: 'player', name: 'Test Player', email: '', player: true }],
	currentUser: { id: 'admin', email: '', player: false, privileges: [Privilege.WriteFines] },
	match: { id: 'match', opponent: 'Test Opponent', startsAt: new Date('2026-10-01T12:00:00Z') },
	settleUp: { firebaseApp: app, firebaseAuth: auth, firebaseAuthProviders: { google: { providerId: 'google.com' } } },
};
const mockAuth = jest.mocked(useSettleUpAuth);
const read = jest.mocked(getSettleUpMembers);
const prepare = jest.mocked(prepareTransaction);
const signedIn = { uid: 'settle-user' } as User;
let authState: ReturnType<typeof useSettleUpAuth>;
let write: ReturnType<typeof jest.fn<() => Promise<void>>>;
let root: Root;
let container: HTMLDivElement;

function button(text: string) {
	const found = Array.from(container.querySelectorAll('button')).find(button => button.textContent === text);
	if (!found) throw new Error(`Missing button ${text}`);
	return found;
}
async function render(overrides: Partial<ISetFineProps> = {}) {
	await act(async () => root.render(<SetFine {...props} {...overrides} />));
}
async function click(text: string) { await act(async () => button(text).click()); }
async function open() { await act(async () => container.querySelector<HTMLButtonElement>('.SetFine > button')?.click()); }

beforeEach(() => {
	container = document.createElement('div');
	root = createRoot(container);
	authState = { loading: false, user: signedIn, login: jest.fn<ReturnType<typeof useSettleUpAuth>['login']>().mockResolvedValue(undefined), loggingIn: false, logout: jest.fn<ReturnType<typeof useSettleUpAuth>['logout']>().mockResolvedValue(undefined), loggingOut: false, errorMessage: undefined };
	mockAuth.mockImplementation(() => authState);
	read.mockResolvedValue({ team: { name: 'SC Catchers', active: true, defaultWeight: '1', photoUrl: '' }, player: { name: 'Test Player', active: true, defaultWeight: '1', photoUrl: '' } });
	write = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
	prepare.mockReturnValue(write);
});
afterEach(async () => { await act(async () => root.unmount()); });

it('waits for separate auth and offers login without a group read', async () => {
	authState = { ...authState, loading: true, user: null };
	await render(); await open();
	expect(container.textContent).toContain('Waiting for Settle Up');
	expect(read).not.toHaveBeenCalled(); expect(button('Přidat').disabled).toBe(true);
	authState = { ...authState, loading: false };
	await render(); await click('Login Settle Up with google');
	expect(authState.login).toHaveBeenCalledWith('google');
	expect(read).not.toHaveBeenCalled();
});

it('requires Catchers privilege independently', async () => {
	await render({ currentUser: undefined });
	expect(container.textContent).toBe(''); expect(read).not.toHaveBeenCalled();
});

it('enables submission only after a successful group read', async () => {
	let finish: ((value: Awaited<ReturnType<typeof getSettleUpMembers>>) => void) | undefined;
	read.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
	await render(); await open();
	expect(button('Přidat').disabled).toBe(true);
	await act(async () => finish?.({ team: { name: 'SC Catchers', active: true, defaultWeight: '1', photoUrl: '' }, player: { name: 'Test Player', active: true, defaultWeight: '1', photoUrl: '' } }));
	expect(button('Přidat').disabled).toBe(false);
	await click('Přidat');
	expect(write).toHaveBeenCalledTimes(1);
	expect(prepare.mock.calls[0][2]).toMatchObject({ whoPaid: [{ memberId: 'team', weight: '1' }], items: [{ amount: '50', forWhom: [{ memberId: 'player', weight: '1' }] }] });
});

it('handles access denial with no write and explicit read retry', async () => {
	read.mockRejectedValueOnce(new Error('Permission denied'));
	await render(); await open();
	expect(container.querySelector('[role="alert"]')?.textContent).toContain('group access');
	await click('Přidat'); expect(prepare).not.toHaveBeenCalled();
	await click('Retry group access');
	expect(read).toHaveBeenCalledTimes(2); expect(button('Přidat').disabled).toBe(false);
});

it('locks same-render duplicate clicks while saving', async () => {
	let finish: (() => void) | undefined;
	write.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
	await render(); await open();
	await act(async () => { button('Přidat').click(); button('Přidat').click(); });
	expect(write).toHaveBeenCalledTimes(1); expect(button('Přidat').disabled).toBe(true);
	await act(async () => finish?.());
	expect(button('Přidat').disabled).toBe(false);
});

it('retries an uncertain write using exactly the same prepared operation, even after closing', async () => {
	write.mockRejectedValueOnce(new Error('Permission denied'));
	await render(); await open(); await click('Přidat');
	expect(container.textContent).toContain('could not be confirmed');
	expect(button('Přidat').disabled).toBe(true);
	await click('Close'); await open();
	await click('Retry same fine');
	expect(prepare).toHaveBeenCalledTimes(1); expect(write).toHaveBeenCalledTimes(2);
	expect(container.textContent).not.toContain('could not be confirmed');
});

it('rejects stale group access after switching accounts', async () => {
	let finish: ((value: Awaited<ReturnType<typeof getSettleUpMembers>>) => void) | undefined;
	read.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
	await render(); await open();
	authState = { ...authState, user: null }; await render();
	await act(async () => finish?.({ team: { name: 'SC Catchers', active: true, defaultWeight: '1', photoUrl: '' } }));
	expect(button('Přidat').disabled).toBe(true); expect(prepare).not.toHaveBeenCalled();
});

it('does not retry a failed write under a different account', async () => {
	write.mockRejectedValueOnce(new Error('Denied'));
	await render(); await open(); await click('Přidat');
	authState = { ...authState, user: { ...signedIn, uid: 'other' } }; await render();
	expect(button('Retry same fine').disabled).toBe(true);
	await click('Retry same fine'); expect(write).toHaveBeenCalledTimes(1);
});

it('reports missing group members without writing', async () => {
	read.mockResolvedValue({ team: { name: 'SC Catchers', active: true, defaultWeight: '1', photoUrl: '' } });
	await render(); await open(); await click('Přidat');
	expect(container.textContent).toContain('Cannot find the team or player'); expect(prepare).not.toHaveBeenCalled();
});
