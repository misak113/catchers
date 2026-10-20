import { expect, it, jest } from '@jest/globals';
import { initializeApp } from '@firebase/app';
import { getAuth } from '@firebase/auth';
import * as database from '@firebase/database';
import { prepareTransaction, SettleUpType, SettleUpTransaction } from './settleUpFacade';

jest.mock('@firebase/database', () => ({ getDatabase: jest.fn(), ref: jest.fn(), push: jest.fn(), set: jest.fn() }));

it('retries the identical transaction reference and payload without allocating another ledger entry', async () => {
	const app = initializeApp({ apiKey: 'isolated-key', projectId: 'isolated-ledger-test' }, 'isolated-ledger-test');
	const actual = jest.requireActual<typeof database>('@firebase/database');
	// push without a value only allocates a local key; all writes remain mocked.
	const reference = actual.push(actual.ref(actual.getDatabase(app), 'isolated'));
	jest.mocked(database.push).mockReturnValue(reference);
	jest.mocked(database.set).mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce(undefined);
	const payload: SettleUpTransaction = { currencyCode: 'CZK', purpose: 'Isolated fixture', dateTime: 1, fixedExchangeRate: true, type: 'expense', whoPaid: [], items: [] };
	const write = prepareTransaction({ firebaseApp: app, firebaseAuth: getAuth(app), firebaseAuthProviders: {} }, SettleUpType.Fines, payload);
	expect(database.set).not.toHaveBeenCalled();
	await expect(write()).rejects.toThrow('Connection lost');
	await write();
	expect(database.push).toHaveBeenCalledTimes(1);
	expect(database.set).toHaveBeenNthCalledWith(1, reference, payload);
	expect(database.set).toHaveBeenNthCalledWith(2, reference, payload);
});
