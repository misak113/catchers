import React, { useCallback, useState } from 'react';
import classNames from 'classnames';
import FormattedDateTime from '../Components/Util/FormattedDateTime';
import { IAuthValue, withAuth } from '../Context/AuthContext';
import { AuthProviderName, ISettleUpValue, withSettleUp } from '../Context/SettleUpContext';
import {
	SettleUpType,
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
import { formatCurrencyAmount, generateQrCode } from '../Util/currency';
import QRCode from 'react-qr-code';
import qrcode from 'qrcode';
import qrIcon from './qr.png';

const Accounting: React.FC<IAuthValue & ISettleUpValue & IFirebaseValue> = (props: IAuthValue & ISettleUpValue & IFirebaseValue) => {
	const { loading, user, login, loggingIn, logout, loggingOut, errorMessage: authErrorMessage } = useSettleUpAuth(props.settleUp);
	const { transactions, errorMessage: transactionsErrorMessage } = useSettleUpTransactions(props.settleUp, SettleUpType.Accounting, user);
	const { members, errorMessage: membersErrorMessage } = useSettleUpMembers(props.settleUp, SettleUpType.Accounting, user);
	const { debts, errorMessage: debtsErrorMessage } = useSettleUpDebts(props.settleUp, SettleUpType.Accounting, user);

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
						const targetMember = members[debt.to];
						const sepaQrCode = targetMember?.bankAccount ? generateQrCode({
							bankAccount: targetMember.bankAccount,
							amount: parseInt(debt.amount),
							name: targetMember.name,
						}) : null;
						const humanizedCurrency = CurrencyMap[DEFAULT_CURRENCY_CODE] ?? DEFAULT_CURRENCY_CODE;
						const key = debt.from + '-' + debt.to;
						const bankAcount = members[debt.to]?.bankAccount ?? '';
						return (
							<tr key={key} className={'table-danger'}>
								<td className='font-weight-bold'>{members[debt.from]?.name}</td>
								<td>
									{members[debt.to]?.name}
									 
									<small>{bankAcount}</small>
									 
									{sepaQrCode && <QRModal sepaQrCode={sepaQrCode} amount={debt.amount} bankAccount={bankAcount} humanizedCurrency={humanizedCurrency}/>}
								</td>
								<td className='font-weight-bold'>{formatCurrencyAmount(debt.amount)} {humanizedCurrency}</td>
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
								<td className='font-weight-bold'>{formatCurrencyAmount(calculateTotalAmount(transaction))} {humanizedCurrency}</td>
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
				<a className="external" target="_blank" rel="noopener noreferrer" href={getSettleUpGroupUrl(SettleUpType.Accounting)}>
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

interface IQRModalProps {
	sepaQrCode: string;
	amount: string;
	bankAccount: string;
	humanizedCurrency: string;
}

const QRModal = ({ sepaQrCode, amount, bankAccount, humanizedCurrency }: IQRModalProps) => {
	const [open, setOpen] = useState(false);

	const downloadQRCode = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		const link = document.createElement("a");
		const qrCodeDataUrl = await qrcode.toDataURL(sepaQrCode);
		link.href = qrCodeDataUrl;
		link.download = `qr-${formatCurrencyAmount(amount)}-${DEFAULT_CURRENCY_CODE}-${bankAccount}.png`;
		link.click();
	}, [amount, bankAccount, sepaQrCode]);

	return (
		<span className="QR">
			<button type="button" className="btn btn-light" onClick={() => setOpen(!open)}>
				<img className="qr-icon" src={qrIcon} alt='QR kód'/>
			</button>

			<div className={classNames("QRModal modal fade", { show: open })} tabIndex={-1}>
				<div className="modal-dialog">
					<div className="modal-content">
						<div className="modal-header">
							<h5 className="modal-title">QR platba</h5>
							<button type="button" className="close" onClick={() => setOpen(false)}>
								<span>&times;</span>
							</button>
						</div>
						<div className="modal-body">
							<button className="qr-code btn btn-link" onClick={downloadQRCode}>
								<QRCode value={sepaQrCode} size={256} />
							</button>
							<h4><small>Částka:</small> {formatCurrencyAmount(amount, 2)} {humanizedCurrency}</h4>
							<h4><small>Číslo účtu:</small> {bankAccount}</h4>
						</div>
						<div className="modal-footer">
							<button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Close</button>
						</div>
					</div>
				</div>
			</div>

			<div className={classNames("QRModal modal-backdrop fade", { show: open })}></div>
		</span>
	);
};
