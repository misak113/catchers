import React from 'react';
import Loading from '../Components/Loading';
import { IAuthValue, withAuth } from '../Context/AuthContext';
import { IFirebaseValue, withFirebase } from '../Context/FirebaseContext';
import { useLinkPlayer } from '../Model/userFacade';
import './LinkPlayer.css';

interface IProps {
	requestHash: string;
}

const LinkPlayer: React.FC<IProps & IFirebaseValue & IAuthValue> = (props: IProps & IFirebaseValue & IAuthValue) => {
	const [linking, errorMessage] = useLinkPlayer(props.firebaseApp, props.auth.user, props.requestHash);
	return <>
		<h1>Spojení hráče s uživatelem</h1>
		{
			linking ? <Loading/>
			: errorMessage
				? <div className="alert alert-danger">{errorMessage}</div>
				: <div className='alert alert-primary'>Hráč byl úspěšně spojen s uživatelem.</div>
		}
	</>;
};
export default withFirebase(withAuth(LinkPlayer));
