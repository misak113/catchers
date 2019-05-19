import React from 'react';
import firebase from 'firebase';
import { withFirebase, IFirebaseValue } from './FirebaseContext';

interface IOwnProps {}
type IProps = IOwnProps & IFirebaseValue;

interface IState {
	signingIn: boolean;
	userCredentials: firebase.auth.UserCredential | null;
}

const AUTH_CREDENTIALS = 'Auth.AUTH_CREDENTIALS';

export interface IAuthValue {
	auth: {
		loginFacebook(): Promise<void>;
		logout(): Promise<void>;
		userCredentials: firebase.auth.UserCredential | null;
		signingIn: boolean;
	};
}

export const AuthContext = React.createContext<IAuthValue>({} as IAuthValue);

class AuthProviderLOC extends React.Component<IProps, IState> {

	private facebookAuthProvider = new firebase.auth.FacebookAuthProvider();
	public state: IState = {
		signingIn: false,
		userCredentials: null,
	};

	constructor(props: IProps) {
		super(props);
		firebase.auth().languageCode = 'cs_CZ';
		this.facebookAuthProvider.addScope('email');
	}

	public async componentDidMount() {
		this.props.firebaseApp.auth().onAuthStateChanged((user) => {
			if (!user) {
				this.setState({ userCredentials: null });
			}
		});
		const authCredentialsString = localStorage.getItem(AUTH_CREDENTIALS);
		if (authCredentialsString) {
			this.setState({ signingIn: true });
			const authCredentials = firebase.auth.AuthCredential.fromJSON(JSON.parse(authCredentialsString))!;
			const userCredentials = await this.props.firebaseApp.auth().signInWithCredential(authCredentials);
			this.setState({ userCredentials, signingIn: false });
		}
	}

	public render() {
		return (
			<AuthContext.Provider value={{
				auth: {
					loginFacebook: () => this.loginFacebook(),
					logout: () => this.logout(),
					userCredentials: this.state.userCredentials,
					signingIn: this.state.signingIn,
				},
			}}>
				{this.props.children}
			</AuthContext.Provider>
		);
	}

	private async loginFacebook() {
		this.setState({ signingIn: true });
		const userCredentials = await this.props.firebaseApp.auth().signInWithPopup(this.facebookAuthProvider);
		console.log(userCredentials);
		localStorage.setItem(AUTH_CREDENTIALS, JSON.stringify(userCredentials.credential!.toJSON()));
		this.setState({ userCredentials, signingIn: false });
	}

	private async logout() {
		this.setState({ signingIn: true });
		await this.props.firebaseApp.auth().signOut();
		localStorage.removeItem(AUTH_CREDENTIALS);
		this.setState({ userCredentials: null, signingIn: false });
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
