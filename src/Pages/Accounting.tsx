import React, { useCallback, useState } from 'react';
import classNames from 'classnames';
import FormattedDateTime from '../Components/Util/FormattedDateTime';
import { IAuthValue, withAuth } from '../Context/AuthContext';
import { AuthProviderName, ISettleUpValue, withSettleUp } from '../Context/SettleUpContext';
import {
	useSettleUpTransactions,
	useSettleUpAuth,
	getSettleUpGroupUrl,
	calculateTotalAmount,
	transactionDescDateSorter,
	useSettleUpMembers,
	SettleUpMembers,
	SettleUpTransactionParticipant,
	CurrencyMap,
	useSettleUpDebts,
	debtsDescAmountSorter,
	DEFAULT_CURRENCY_CODE,
} from '../Model/settleUpFacade';
import { safeObjectKeys } from '../Util/object';
import './Accounting.css';
import { setUserSettleUpProviderName, useCurrentUser } from '../Model/userFacade';
import { IFirebaseValue, withFirebase } from '../Context/FirebaseContext';
import { useAsyncEffect } from '../React/async';

const Accounting: React.FC<IAuthValue & ISettleUpValue & IFirebaseValue> = (props: IAuthValue & ISettleUpValue & IFirebaseValue) => {
	const { loading, user, login, loggingIn, logout, loggingOut, errorMessage: authErrorMessage } = useSettleUpAuth(props.settleUp);
	const { transactions, errorMessage: transactionsErrorMessage } = useSettleUpTransactions(props.settleUp, user);
	const { members, errorMessage: membersErrorMessage } = useSettleUpMembers(props.settleUp, user);
	const { debts, errorMessage: debtsErrorMessage } = useSettleUpDebts(props.settleUp, user);

	const [errorMessage, setErrorMessage] = useState<string>();
	const [currentUser] = useCurrentUser(props.firebaseApp, props.auth.user, setErrorMessage)

	const [isUnlinked, setIsUnlinked] = useState<boolean>(false);

	useAsyncEffect(async () => {
		if (!isUnlinked &&!user && currentUser?.settleUpProviderName) {
			await login(currentUser.settleUpProviderName);
		}
	}, [user, currentUser]);

	const loginAndUpdateProviderName = useCallback(async (providerName: AuthProviderName) => {
		await login(providerName);
		if (currentUser) {
			await setUserSettleUpProviderName(props.firebaseApp, currentUser, providerName);
		}
	}, [props.firebaseApp, currentUser, login]);

	const logoutAndUnsetProviderName = useCallback(async () => {
		setIsUnlinked(true);
		if (currentUser) {
			await setUserSettleUpProviderName(props.firebaseApp, currentUser, null);
		}
		await logout();
	}, [props.firebaseApp, currentUser, logout]);

	return <div className='Accounting'>
		<h1>Účetnictví</h1>

		{errorMessage && <div className='alert alert-danger'>{errorMessage}</div>}
		{authErrorMessage && <div className='alert alert-danger'>{authErrorMessage}</div>}
		{transactionsErrorMessage && <div className='alert alert-danger'>{transactionsErrorMessage}</div>}
		{membersErrorMessage && <div className='alert alert-danger'>{membersErrorMessage}</div>}
		{debtsErrorMessage && <div className='alert alert-danger'>{debtsErrorMessage}</div>}

		{!loading && !user && safeObjectKeys(props.settleUp.firebaseAuthProviders).map((providerName) => (
			<button key={providerName} className='btn btn-primary' disabled={loggingIn} onClick={() => loginAndUpdateProviderName(providerName)}>
				Login Settle Up with {providerName}
			</button>
		))}

		{user && <>
			<h2>Dluhy</h2>
			<table className="table table-light table-bordered table-hover table-striped table-responsive-md">
				<thead>
					<tr>
						<th>Kdo</th>
						<th>Komu</th>
						<th>Kolik</th>
					</tr>
				</thead>
				<tbody>
					{debts.sort(debtsDescAmountSorter).map((debt) => {
						const humanizedCurrency = CurrencyMap[DEFAULT_CURRENCY_CODE] ?? DEFAULT_CURRENCY_CODE;
						return (
							<tr key={debt.from + '-' + debt.to} className={'table-danger'}>
								<td className='font-weight-bold'>{members[debt.from]?.name}</td>
								<td>{members[debt.to]?.name} <small>{members[debt.to]?.bankAccount ?? ''}</small></td>
								<td className='font-weight-bold'>{parseFloat(debt.amount).toFixed(0)} {humanizedCurrency}</td>
							</tr>
						);
					})}
				</tbody>
			</table>

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

			<button className='btn btn-danger logout-settleUp' disabled={loggingOut} onClick={() => logoutAndUnsetProviderName()}>
				Unlink Settle Up account
			</button>
		</>}
	</div>
};
export default withAuth(withSettleUp(withFirebase(Accounting)));

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
