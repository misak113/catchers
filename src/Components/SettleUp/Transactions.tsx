import React from 'react';
import { CurrencyMap, SettleUpMembers, SettleUpTransactionParticipant, SettleUpTransactions, calculateTotalAmount, transactionDescDateSorter } from '../../Model/settleUpFacade';
import FormattedDateTime from '../Util/FormattedDateTime';
import { formatCurrencyAmount } from '../../Util/currency';
import classNames from 'classnames';
import './Transactions.css';

export enum Column {
	Amount = 'amount',
	Date = 'date',
	Paid = 'paid',
	Description = 'description',
}

interface ITransactionProps {
	transactions: SettleUpTransactions;
	members: SettleUpMembers;
	paidLabel?: string;
	onlyColumns?: Column[];
	title?: string;
}

const Transactions = (props: ITransactionProps) => {

	const showColumn = (column: Column) => {
		return !props.onlyColumns || props.onlyColumns.includes(column);
	}

	return <div className='Transactions'>
		<h2>{props.title ?? 'Transakce'}</h2>
		<table className="table table-light table-bordered table-hover table-striped table-responsive-md">
			<thead>
				<tr>
					{showColumn(Column.Amount) && <th>Částka</th>}
					{showColumn(Column.Date) && <th>Datum</th>}
					{showColumn(Column.Paid) && <th>{props.paidLabel || 'Platil'}</th>}
					{showColumn(Column.Description) && <th>Popis</th>}
				</tr>
			</thead>
			<tbody>
				{Object.entries(props.transactions).sort(transactionDescDateSorter).map(([transactionId, transaction]) => {
					const humanizedCurrency = CurrencyMap[transaction.currencyCode] ?? transaction.currencyCode;
					return (
						<tr key={transactionId} className={transaction.type === 'expense' ? 'table-primary' : 'table-success'}>
							{showColumn(Column.Amount) && <td className='font-weight-bold'>{formatCurrencyAmount(calculateTotalAmount(transaction))} {humanizedCurrency}</td>}
							{showColumn(Column.Date) && <td><FormattedDateTime startsAt={new Date(transaction.dateTime)}/></td>}
							{showColumn(Column.Paid) && (props.paidLabel ? <td>
								{transaction.items.flatMap((item) => item.forWhom).map((participant) => props.members[participant.memberId]?.name).join(', ')}
							</td> : <td>
								{transaction.whoPaid.map((participant) => props.members[participant.memberId]?.name).join(', ')}
								&nbsp;
								<ParticipantPopover
									title='Komu'
									participants={transaction.items.flatMap((item) => item.forWhom)}
									members={props.members}
								/>
							</td>)}
							{showColumn(Column.Description) && <td>{transaction.purpose}</td>}
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
