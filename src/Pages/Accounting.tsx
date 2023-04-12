import React, { useState } from 'react';
import { IAuthValue, withAuth } from '../Context/AuthContext';
import { ISettleUpValue, withSettleUp } from '../Context/SettleUpContext';
import {
	SettleUpType,
	useSettleUpTransactions,
	useSettleUpAuth,
	useSettleUpMembers,
	useSettleUpDebts,
} from '../Model/settleUpFacade';
import './Accounting.css';
import { useCurrentUser } from '../Model/userFacade';
import { IFirebaseValue, withFirebase } from '../Context/FirebaseContext';
import { JoinGroupLink } from '../Components/SettleUp/JoinGroupLink';
import AutoLinkAccount from '../Components/SettleUp/AutoLinkAccount';
import Debts from '../Components/SettleUp/Debts';
import Transactions from '../Components/SettleUp/Transactions';

const Accounting: React.FC<IAuthValue & ISettleUpValue & IFirebaseValue> = (props: IAuthValue & ISettleUpValue & IFirebaseValue) => {
	const { user, errorMessage: authErrorMessage } = useSettleUpAuth(props.settleUp);
	const { transactions, errorMessage: transactionsErrorMessage } = useSettleUpTransactions(props.settleUp, SettleUpType.Accounting, user);
	const { members, errorMessage: membersErrorMessage } = useSettleUpMembers(props.settleUp, SettleUpType.Accounting, user);
	const { debts, errorMessage: debtsErrorMessage } = useSettleUpDebts(props.settleUp, SettleUpType.Accounting, user);

	const [errorMessage, setErrorMessage] = useState<string>();
	const [currentUser] = useCurrentUser(props.firebaseApp, props.auth.user, setErrorMessage)

	return <div className='Accounting'>
		<h1>Účetnictví</h1>

		{errorMessage && <div className='alert alert-danger'>{errorMessage}</div>}
		{authErrorMessage && <div className='alert alert-danger'>{authErrorMessage}</div>}
		{transactionsErrorMessage && <div className='alert alert-danger'>{transactionsErrorMessage}</div>}
		{membersErrorMessage && <div className='alert alert-danger'>{membersErrorMessage}</div>}
		{debtsErrorMessage && <div className='alert alert-danger'>{debtsErrorMessage}</div>}

		{user && <>
			<Debts debts={debts} members={members}/>
			<Transactions transactions={transactions} members={members}/>
		</>}
		<JoinGroupLink type={SettleUpType.Accounting} title="Účetnictví"/>
		<AutoLinkAccount currentUser={currentUser}/>
	</div>
};
export default withAuth(withSettleUp(withFirebase(Accounting)));
