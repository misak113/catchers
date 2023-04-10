import React from 'react';
import { SettleUpMembers, SettleUpTransaction, SettleUpTransactions, SettleUpType, useSettleUpMembers, useSettleUpTransactions } from '../../Model/settleUpFacade';
import { useSettleUpAuth } from '../../Model/settleUpFacade';
import { ISettleUpValue, withSettleUp } from '../../Context/SettleUpContext';
import Transactions, { Column } from '../SettleUp/Transactions';

interface IFineTransactionTableProps {
	showTransactionCallback: (transaction: SettleUpTransaction, members: SettleUpMembers) => boolean;
}

export const FineTransactionTable = (props: IFineTransactionTableProps & ISettleUpValue) => {
	const { user, errorMessage: authErrorMessage } = useSettleUpAuth(props.settleUp);
	const { transactions, errorMessage: transactionsErrorMessage } = useSettleUpTransactions(props.settleUp, SettleUpType.Fines, user);
	const { members, errorMessage: membersErrorMessage } = useSettleUpMembers(props.settleUp, SettleUpType.Fines, user);

	const filteredTransactions: SettleUpTransactions = {};
	for (const transactionId in transactions) {
		const transaction = transactions[transactionId];
		if (props.showTransactionCallback(transaction, members)) {
			filteredTransactions[transactionId] = transaction;
		}
	}

	return <div>
		{authErrorMessage && <div className='alert alert-danger'>{authErrorMessage}</div>}
		{membersErrorMessage && <div className='alert alert-danger'>{membersErrorMessage}</div>}
		{transactionsErrorMessage && <div className='alert alert-danger'>{transactionsErrorMessage}</div>}

		<Transactions transactions={filteredTransactions} members={members} onlyColumns={[Column.Amount, Column.Date]} title={'Současné pokuty'}/>
	</div>;
};
export default withSettleUp(FineTransactionTable);
