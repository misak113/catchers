import React from 'react';
import * as firebaseAuth from '@firebase/auth';
import { withFirebase, IFirebaseValue } from './FirebaseContext';

interface IOwnProps {}
type IProps = IOwnProps & IFirebaseValue;

interface IState {
	signingIn: boolean;
	user: firebaseAuth.User | null;
}

export interface ICredentials {
	email: string;
	password: string;
}

export interface IAuthValue {
	auth: {
		loginFacebook(): Promise<void>;
		loginEmail(credentials: ICredentials): Promise<void>;
		registerEmail(credentials: ICredentials): Promise<void>;
		logout(): Promise<void>;
		user: firebaseAuth.User | null;
		signingIn: boolean;
	};
}

export const AuthContext = React.createContext<IAuthValue>({} as IAuthValue);

class AuthProviderLOC extends React.Component<IProps, IState> {

	private readonly firebaseAuth: firebaseAuth.Auth;
	private unsubscribeAuthStateChanged: (() => void) | undefined;
	private readonly facebookAuthProvider = new firebaseAuth.FacebookAuthProvider();
	public state: IState = {
		signingIn: false,
		user: null,
	};

	constructor(props: IProps) {
		super(props);
		this.firebaseAuth = firebaseAuth.getAuth(this.props.firebaseApp);
		this.firebaseAuth.languageCode = 'cs_CZ';
		this.facebookAuthProvider.addScope('email');
		this.facebookAuthProvider.addScope('public_profile');
	}

	public componentDidMount() {
		this.unsubscribeAuthStateChanged = this.firebaseAuth.onAuthStateChanged((user) => {
			console.log('auth state changed', user);
			this.setState({ user });
		});
	}

	public componentWillUnmount() {
		if (this.unsubscribeAuthStateChanged) {
			this.unsubscribeAuthStateChanged();
			this.unsubscribeAuthStateChanged = undefined;
		}
	}

	public render() {
		return (
			<AuthContext.Provider value={{
				auth: {
					loginFacebook: () => this.loginFacebook(),
					loginEmail: (credentials: ICredentials) => this.loginEmail(credentials),
					registerEmail: (credentials: ICredentials) => this.registerEmail(credentials),
					logout: () => this.logout(),
					user: this.state.user,
					signingIn: this.state.signingIn,
				},
			}}>
				{this.props.children}
			</AuthContext.Provider>
		);
	}

	private async loginFacebook() {
		try {
			this.setState({ signingIn: true });
			await firebaseAuth.signInWithPopup(this.firebaseAuth, this.facebookAuthProvider);
		} finally {
			this.setState({ signingIn: false });
		}
	}

	private async loginEmail(credentials: ICredentials) {
		try {
			this.setState({ signingIn: true });
			const userCredentials = await firebaseAuth.signInWithEmailAndPassword(this.firebaseAuth, credentials.email, credentials.password);
			await this.finalizeEmailAuthentication(userCredentials, credentials);
		} finally {
			this.setState({ signingIn: false });
		}
	}

	private async registerEmail(credentials: ICredentials) {
		try {
			this.setState({ signingIn: true });
			const userCredentials = await firebaseAuth.createUserWithEmailAndPassword(this.firebaseAuth, credentials.email, credentials.password);
			await this.finalizeEmailAuthentication(userCredentials, credentials);
		} finally {
			this.setState({ signingIn: false });
		}
	}

	private async finalizeEmailAuthentication(userCredentials: firebaseAuth.UserCredential, credentials: ICredentials) {
		if (!userCredentials.user) {
			throw new Error(`User not found`);
		}
		if (!userCredentials.user.emailVerified) {
			await firebaseAuth.sendEmailVerification(userCredentials.user);
		}
	}

	private async logout() {
		try {
			this.setState({ signingIn: true });
			await this.firebaseAuth.signOut();
		} finally {
			this.setState({ signingIn: false });
		}
	}
}

export const AuthProvider = withFirebase<IOwnProps>(AuthProviderLOC);

export const withAuth = <TOwnProps extends {}>(WrappedComponent: React.ComponentType<TOwnProps & IAuthValue>) => (
	(props: TOwnProps) => (
		<AuthContext.Consumer>
			{(value: IAuthValue) => <WrappedComponent {...props} {...value} />}
		</AuthContext.Consumer>
	)
);
