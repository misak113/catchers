import React from 'react';
import * as firebase from '@firebase/app';
import * as firebaseAuth from '@firebase/auth';
import { firebase as firebaseConfig } from '../Model/settleUpFacade';

interface IProps {
	children: React.ReactNode;
}

export interface SettleUp {
	firebaseApp: firebase.FirebaseApp;
	firebaseAuth: firebaseAuth.Auth;
	firebaseAuthProviders: {
		[providerName: string]: firebaseAuth.AuthProvider;
	};
}

export type AuthProviderName = keyof SettleUp['firebaseAuthProviders'];

export interface ISettleUpValue {
	settleUp: SettleUp;
}

export const SettleUpContext = React.createContext<ISettleUpValue>({} as ISettleUpValue);

export class SettleUpProvider extends React.Component<IProps> {

	private settleUp: SettleUp;

	constructor(props: IProps) {
		super(props);
		const firebaseApp = firebase.initializeApp(firebaseConfig, 'settleUp');

		const auth = firebaseAuth.getAuth(firebaseApp);
		auth.languageCode = 'cs_CZ';
		const googleAuthProvider = new firebaseAuth.GoogleAuthProvider();
		googleAuthProvider.addScope('email');

		this.settleUp = {
			firebaseApp,
			firebaseAuth: auth,
			firebaseAuthProviders: {
				google: googleAuthProvider,
			},
		};
	}

	public render() {
		return (
			<SettleUpContext.Provider value={{ settleUp: this.settleUp }}>
				{this.props.children}
			</SettleUpContext.Provider>
		);
	}
}

export const withSettleUp = <TOwnProps extends {}>(WrappedComponent: React.ComponentType<TOwnProps & ISettleUpValue>) => (
	(props: TOwnProps) => (
		<SettleUpContext.Consumer>
			{(value: ISettleUpValue) => <WrappedComponent {...props} {...value} />}
		</SettleUpContext.Consumer>
	)
);
