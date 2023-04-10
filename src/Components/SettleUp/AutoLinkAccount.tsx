import React, { useCallback, useState } from 'react';
import { useSettleUpAuth } from '../../Model/settleUpFacade';
import { withFirebase, IFirebaseValue } from '../../Context/FirebaseContext';
import { AuthProviderName, ISettleUpValue, withSettleUp } from '../../Context/SettleUpContext';
import { setUserSettleUpProviderName } from '../../Model/userFacade';
import { IUser } from '../../Model/collections';
import { useAsyncEffect } from '../../React/async';
import { safeObjectKeys } from '../../Util/object';
import './AutoLinkAccount.css';

interface IAutoLinkAccountProps {
	currentUser: IUser | undefined;
}

export const AutoLinkAccount = (props: IAutoLinkAccountProps & IFirebaseValue & ISettleUpValue) => {
	const { loading, user, login, loggingIn, logout, loggingOut, errorMessage: authErrorMessage } = useSettleUpAuth(props.settleUp);

	const [isUnlinked, setIsUnlinked] = useState<boolean>(false);

	useAsyncEffect(async () => {
		if (!isUnlinked && !user && props.currentUser?.settleUpProviderName) {
			await login(props.currentUser.settleUpProviderName);
		}
	}, [user, props.currentUser]);

	const loginAndUpdateProviderName = useCallback(async (providerName: AuthProviderName) => {
		await login(providerName);
		if (props.currentUser) {
			await setUserSettleUpProviderName(props.firebaseApp, props.currentUser, providerName);
		}
	}, [props.firebaseApp, props.currentUser, login]);

	const logoutAndUnsetProviderName = useCallback(async () => {
		setIsUnlinked(true);
		if (props.currentUser) {
			await setUserSettleUpProviderName(props.firebaseApp, props.currentUser, null);
		}
		await logout();
	}, [props.firebaseApp, props.currentUser, logout]);

	if (authErrorMessage) {
		return <div className='alert alert-danger'>{authErrorMessage}</div>
	}
	
	if (!loading && !user) {
		return <>
			{safeObjectKeys(props.settleUp.firebaseAuthProviders).map((providerName) => (
				<button key={providerName} className='btn btn-primary' disabled={loggingIn} onClick={() => loginAndUpdateProviderName(providerName)}>
					Login Settle Up with {providerName}
				</button>
			))}
		</>;
	}


	return <button className='btn btn-danger AutoLinkAccount-logout-settleUp' disabled={loggingOut} onClick={() => logoutAndUnsetProviderName()}>
		Unlink Settle Up account
	</button>;
};

export default withFirebase(withSettleUp(AutoLinkAccount));
