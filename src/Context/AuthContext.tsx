import React from 'react';
import * as firebaseAuth from '@firebase/auth';
import { withFirebase, IFirebaseValue } from './FirebaseContext';
import { reportLoadingFailure } from '../monitoring';

export const AUTH_RESTORE_TIMEOUT_MS = 15000;
type AuthStatus = 'restoring' | 'error' | 'signed-out' | 'signed-in';

interface IOwnProps {
	children: React.ReactNode;
}
type IProps = IOwnProps & IFirebaseValue;

interface IState {
	status: AuthStatus;
	signingIn: boolean;
	user: firebaseAuth.User | null;
}

export interface ICredentials {
	email: string;
	password: string;
}

export interface IAuthValue {
	auth: {
		status: AuthStatus;
		retryRestore(): void;
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
	private retryRestore: (() => void) | undefined;
	private stopRestore: (() => void) | undefined;
	private readonly facebookAuthProvider = new firebaseAuth.FacebookAuthProvider();
	public state: IState = {
		signingIn: false,
		status: 'restoring',
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
		this.observeAuth();
	}

	public componentWillUnmount() {
		this.stopRestore?.();
	}

	private observeAuth() {
		this.stopRestore?.();
		this.setState({ status: 'restoring', user: null });
		let active = true;
		let waiting = true;
		const deadline = Date.now() + AUTH_RESTORE_TIMEOUT_MS;
		const fail = (reason: 'timeout' | 'request') => {
			if (!active || !waiting) {
				return;
			}
			stopWaiting();
			this.setState({ status: 'error' });
			this.retryRestore = () => {
				this.retryRestore = undefined;
				this.observeAuth();
			};
			if (window.location.pathname.replace(/\/$/, '') === '/zapasy') {
				reportLoadingFailure('auth', reason);
			}
		};
		const checkDeadline = () => {
			if (Date.now() >= deadline) {
				fail('timeout');
			}
		};
		const timer = setTimeout(() => fail('timeout'), AUTH_RESTORE_TIMEOUT_MS);
		const stopWaiting = () => {
			waiting = false;
			clearTimeout(timer);
			document.removeEventListener('visibilitychange', checkDeadline);
			window.removeEventListener('pageshow', checkDeadline);
		};
		document.addEventListener('visibilitychange', checkDeadline);
		window.addEventListener('pageshow', checkDeadline);
		const unsubscribe = this.firebaseAuth.onAuthStateChanged((user) => {
			if (active) {
				stopWaiting();
				this.retryRestore = undefined;
				this.setState({ status: user ? 'signed-in' : 'signed-out', user });
			}
		}, () => fail('request'));
		this.stopRestore = () => {
			active = false;
			stopWaiting();
			unsubscribe();
		};
	}

	public render() {
		return (
			<AuthContext.Provider value={{
				auth: {
					status: this.state.status,
					retryRestore: () => this.retryRestore?.(),
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
