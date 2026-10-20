import { SettleUp } from '../../Context/SettleUpContext';
import { IMatch } from '../../Model/collections';
import { createFineTransactionPurpose, FINE_MEMBER_NAME, IFineDefinition } from '../../Model/fineFacade';
import { DEFAULT_CURRENCY_CODE, prepareTransaction, SettleUpMembers, SettleUpType } from '../../Model/settleUpFacade';

export function prepareFine(settleUp: SettleUp, members: SettleUpMembers, playerName: string | undefined, fine: IFineDefinition, match: IMatch | null) {
	const teamId = Object.keys(members).find(id => members[id].name === FINE_MEMBER_NAME);
	const playerId = playerName && Object.keys(members).find(id => members[id].name === playerName);
	if (!teamId || !playerId) {
		throw new Error('Cannot find the team or player in the Settle Up fines group. Check the group’s member names.');
	}
	return prepareTransaction(settleUp, SettleUpType.Fines, {
		currencyCode: DEFAULT_CURRENCY_CODE,
		purpose: createFineTransactionPurpose(fine, match),
		dateTime: new Date().valueOf(),
		fixedExchangeRate: true,
		type: 'expense',
		whoPaid: [{ memberId: teamId, weight: '1' }],
		items: [{ amount: fine.amount.toString(), forWhom: [{ memberId: playerId, weight: '1' }] }],
	});
}
