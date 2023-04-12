import React, { useState } from 'react';
import { IAuthValue, withAuth } from '../Context/AuthContext';
import { ISettleUpValue, withSettleUp } from '../Context/SettleUpContext';
import { IFirebaseValue, withFirebase } from '../Context/FirebaseContext';
import { SettleUpType, useSettleUpAuth, useSettleUpDebts, useSettleUpMembers, useSettleUpTransactions } from '../Model/settleUpFacade';
import { JoinGroupLink } from '../Components/SettleUp/JoinGroupLink';
import AutoLinkAccount from '../Components/SettleUp/AutoLinkAccount';
import { useCurrentUser } from '../Model/userFacade';
import Debts from '../Components/SettleUp/Debts';
import Transactions from '../Components/SettleUp/Transactions';
import FinesTable from '../Components/Fine/FinesTable';

const Fines: React.FC<IAuthValue & ISettleUpValue & IFirebaseValue> = (props: IAuthValue & ISettleUpValue & IFirebaseValue) => {
	const { user, errorMessage: authErrorMessage } = useSettleUpAuth(props.settleUp);
	const { transactions, errorMessage: transactionsErrorMessage } = useSettleUpTransactions(props.settleUp, SettleUpType.Fines, user);
	const { members, errorMessage: membersErrorMessage } = useSettleUpMembers(props.settleUp, SettleUpType.Fines, user);
	const { debts, errorMessage: debtsErrorMessage } = useSettleUpDebts(props.settleUp, SettleUpType.Fines, user);

	const [errorMessage, setErrorMessage] = useState<string>();
	const [currentUser] = useCurrentUser(props.firebaseApp, props.auth.user, setErrorMessage)

	return <div className='Fines'>
		<h1>Pokuty</h1>

		{errorMessage && <div className='alert alert-danger'>{errorMessage}</div>}
		{authErrorMessage && <div className='alert alert-danger'>{authErrorMessage}</div>}
		{transactionsErrorMessage && <div className='alert alert-danger'>{transactionsErrorMessage}</div>}
		{membersErrorMessage && <div className='alert alert-danger'>{membersErrorMessage}</div>}
		{debtsErrorMessage && <div className='alert alert-danger'>{debtsErrorMessage}</div>}

		<FinesTable/>

		{user && <>
			<Debts debts={debts} members={members} hideWho={true}/>
			<Transactions transactions={transactions} members={members} paidLabel='Hříšník'/>
		</>}
		<JoinGroupLink type={SettleUpType.Fines} title='Pokuty'/>
		<AutoLinkAccount currentUser={currentUser}/>
	</div>;
};
export default withAuth(withSettleUp(withFirebase(Fines)));
