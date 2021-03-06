import React from 'react';
import firebase from 'firebase';
import firebaseConfig from '../firebase.json';

interface IProps {

}

export interface IFirebaseValue {
	firebaseApp: firebase.app.App;
}

export const FirebaseContext = React.createContext<IFirebaseValue>({} as IFirebaseValue);

export class FirebaseProvider extends React.Component<IProps> {

	private firebaseApp: firebase.app.App;

	constructor(props: IProps) {
		super(props);
		this.firebaseApp = firebase.initializeApp(firebaseConfig);
	}

	public render() {
		return (
			<FirebaseContext.Provider value={{ firebaseApp: this.firebaseApp }}>
				{this.props.children}
			</FirebaseContext.Provider>
		);
	}
}

export const withFirebase = <TOwnProps extends {}>(WrappedComponent: React.ComponentType<TOwnProps & IFirebaseValue>) => (
	(props: TOwnProps) => (
		<FirebaseContext.Consumer>
			{(value: IFirebaseValue) => <WrappedComponent {...props} {...value} />}
		</FirebaseContext.Consumer>
	)
);
