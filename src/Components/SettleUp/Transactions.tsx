import React from 'react';
import { CurrencyMap, SettleUpMembers, SettleUpTransactionParticipant, SettleUpTransactions, calculateTotalAmount, transactionDescDateSorter } from '../../Model/settleUpFacade';
import FormattedDateTime from '../Util/FormattedDateTime';
import { formatCurrencyAmount } from '../../Util/currency';
import classNames from 'classnames';
import './Transactions.css';

interface ITransactionProps {
	transactions: SettleUpTransactions;
	members: SettleUpMembers;
}

const Transactions = (props: ITransactionProps) => {
	return <div className='Transactions'>
		<h2>Transakce</h2>
		<table className="table table-light table-bordered table-hover table-striped table-responsive-md">
			<thead>
				<tr>
					<th>Částka</th>
					<th>Datum</th>
					<th>Platil</th>
					<th>Popis</th>
				</tr>
			</thead>
			<tbody>
				{Object.entries(props.transactions).sort(transactionDescDateSorter).map(([transactionId, transaction]) => {
					const humanizedCurrency = CurrencyMap[transaction.currencyCode] ?? transaction.currencyCode;
					return (
						<tr key={transactionId} className={transaction.type === 'expense' ? 'table-primary' : 'table-success'}>
							<td className='font-weight-bold'>{formatCurrencyAmount(calculateTotalAmount(transaction))} {humanizedCurrency}</td>
							<td><FormattedDateTime startsAt={new Date(transaction.dateTime)}/></td>
							<td>
								{transaction.whoPaid.map((participant) => props.members[participant.memberId]?.name).join(', ')}
								&nbsp;
								<ParticipantPopover
									title='Komu'
									participants={transaction.items.flatMap((item) => item.forWhom)}
									members={props.members}
								/>
							</td>
							<td>{transaction.purpose}</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	</div>;
};
export default Transactions;

interface IPopoverProps {
	title: string;
	participants: SettleUpTransactionParticipant[];
	members: SettleUpMembers;
}

const ParticipantPopover = (props: IPopoverProps) => {
	return (
		<span className="Participants confirmed">
			<span className="badge badge-info">{props.participants.length}</span>
			<div className="ParticipantsPopover popover fade show bs-popover-bottom">
				<div className="arrow"></div>
				<h3 className={classNames("popover-header", 'bg-info text-white')}>{props.title}</h3>
				<div className="popover-body">
					{props.participants.map((participant) => (
						<div key={participant.memberId}>{props.members[participant.memberId]?.name}</div>
					))}
				</div>
			</div>
		</span>
	);
};
