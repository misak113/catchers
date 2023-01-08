import React from 'react';
import FormattedDateTime from '../Components/Util/FormattedDateTime';
import { IAuthValue, withAuth } from '../Context/AuthContext';
import { ISettleUpValue, withSettleUp } from '../Context/SettleUpContext';
import { useSettleUpTransactions, useSettleUpAuth, getSettleUpGroupUrl } from '../Model/settleUpFacade';
import { safeObjectKeys } from '../Util/object';
import './Accounting.css';

const Accounting: React.FC<IAuthValue & ISettleUpValue> = (props: IAuthValue & ISettleUpValue) => {
	const { loading, user, login, loggingIn, logout, loggingOut, errorMessage: authErrorMessage } = useSettleUpAuth(props.settleUp);
	const { transactions, errorMessage: transactionsErrorMessage } = useSettleUpTransactions(props.settleUp, user);

	return <div className='Accounting'>
		<h1>Účetnictví</h1>

		{authErrorMessage && <div className='alert alert-danger'>{authErrorMessage}</div>}
		{transactionsErrorMessage && <div className='alert alert-danger'>{transactionsErrorMessage}</div>}

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
						<th>Měna</th>
						<th>Datum</th>
						<th>Popis</th>
					</tr>
				</thead>
				<tbody>
					{Object.entries(transactions).map(([transactionId, transaction]) => (
						<tr key={transactionId} className={transaction.type === 'expense' ? 'table-warning' : 'table-success'}>
							<td>{transaction.items.reduce((sum, item) => sum + parseFloat(item.amount), 0)}</td>
							<td>{transaction.currencyCode}</td>
							<td><FormattedDateTime startsAt={new Date(transaction.dateTime)}/></td>
							<td>{transaction.purpose}</td>
						</tr>
					))}
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
