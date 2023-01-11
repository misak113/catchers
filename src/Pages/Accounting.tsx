import React from 'react';
import classNames from 'classnames';
import FormattedDateTime from '../Components/Util/FormattedDateTime';
import { IAuthValue, withAuth } from '../Context/AuthContext';
import { ISettleUpValue, withSettleUp } from '../Context/SettleUpContext';
import { useSettleUpTransactions, useSettleUpAuth, getSettleUpGroupUrl, calculateTotalAmount, transactionDescDateSorter, useSettleUpMembers, SettleUpMembers, SettleUpTransactionParticipant, CurrencyMap } from '../Model/settleUpFacade';
import { safeObjectKeys } from '../Util/object';
import './Accounting.css';

const Accounting: React.FC<IAuthValue & ISettleUpValue> = (props: IAuthValue & ISettleUpValue) => {
	const { loading, user, login, loggingIn, logout, loggingOut, errorMessage: authErrorMessage } = useSettleUpAuth(props.settleUp);
	const { transactions, errorMessage: transactionsErrorMessage } = useSettleUpTransactions(props.settleUp, user);
	const { members, errorMessage: membersErrorMessage } = useSettleUpMembers(props.settleUp, user);

	return <div className='Accounting'>
		<h1>Účetnictví</h1>

		{authErrorMessage && <div className='alert alert-danger'>{authErrorMessage}</div>}
		{transactionsErrorMessage && <div className='alert alert-danger'>{transactionsErrorMessage}</div>}
		{membersErrorMessage && <div className='alert alert-danger'>{membersErrorMessage}</div>}

		{!loading && !user && safeObjectKeys(props.settleUp.firebaseAuthProviders).map((providerName) => (
			<button key={providerName} className='btn btn-primary' disabled={loggingIn} onClick={() => login(providerName)}>
				Login Settle Up with {providerName}
			</button>
		))}

		{user && <>
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
					{Object.entries(transactions).sort(transactionDescDateSorter).map(([transactionId, transaction]) => {
						const humanizedCurrency = CurrencyMap[transaction.currencyCode] ?? transaction.currencyCode;
						return (
							<tr key={transactionId} className={transaction.type === 'expense' ? 'table-primary' : 'table-success'}>
								<td className='font-weight-bold'>{calculateTotalAmount(transaction)} {humanizedCurrency}</td>
								<td><FormattedDateTime startsAt={new Date(transaction.dateTime)}/></td>
								<td>
									{transaction.whoPaid.map((participant) => members[participant.memberId]?.name).join(', ')}
									&nbsp;
									<ParticipantPopover
										title='Komu'
										participants={transaction.items.flatMap((item) => item.forWhom)}
										members={members}
									/>
								</td>
								<td>{transaction.purpose}</td>
							</tr>
						);
					})}
				</tbody>
			</table>

			<div className='settle-up-link'>
				<a className="external" target="_blank" rel="noopener noreferrer" href={getSettleUpGroupUrl()}>
					Přejít na Settle Up (Dlužebníček) <i className="fa fa-external-link"/>
				</a>
			</div>

			<button className='btn btn-danger logout-settleUp' disabled={loggingOut} onClick={() => logout()}>
				Logout Settle Up
			</button>
		</>}
	</div>
};
export default withAuth(withSettleUp(Accounting));

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
