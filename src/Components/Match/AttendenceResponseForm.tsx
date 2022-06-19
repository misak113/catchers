import React, { useState } from 'react';
import { getErrorMessage } from '../../Util/error';
import {
	addAttendee,
	addNonAttendee,
} from '../../Model/matchFacade';
import { IMatch } from '../../Model/collections';
import { useCurrentUser } from '../../Model/userFacade';
import { IFirebaseValue, withFirebase } from '../../Context/FirebaseContext';
import { IAuthValue, withAuth } from '../../Context/AuthContext';

interface IProps {
	title: string;
	match: IMatch | null;
	reloadMatch: () => void;
	setErrorMessage: (error: string | undefined) => void;
}

export function AttendanceResponseForm(props: IProps & IFirebaseValue & IAuthValue) {
	const [currentUser] = useCurrentUser(props.firebaseApp, props.auth.user, props.setErrorMessage);
	const [attendeeErrorMessage, setAttendeeErrorMessage] = useState<string>();
	const [note, setNote] = useState<string>();

	const onClickRespond = (doResult: typeof addAttendee) => async (
		event: React.MouseEvent<HTMLButtonElement, MouseEvent>
	): Promise<void> => {
		try {
			event.preventDefault();
			if (!props.match || !currentUser) {
				throw new Error(`Not loaded all data`);
			}
			await doResult(props.firebaseApp, props.match, currentUser, note);
			props.reloadMatch();
			setAttendeeErrorMessage(undefined);
		} catch (error) {
			console.error(error);
			setAttendeeErrorMessage(getErrorMessage(error));
		}
	};

	return <form onSubmit={(event) => event.preventDefault()}>
		<h3>{props.title}</h3>
		<div className="row">
			<div className="col-md-12">
				<div className="form-group">
					<label htmlFor="note">Poznámka</label>
					<input
						type="text"
						id="note"
						placeholder="Napiš poznámku..."
						className="form-control"
						value={note || ''}
						onChange={(event) => setNote(event.target.value)}
					/>
				</div>
			</div>
		<div className="row">
		</div>
			<div className="col-md-6">
				<button
					className="btn btn-block btn-lg btn-success"
					onClick={onClickRespond(addAttendee)}
				>Přijdu</button>
			</div>
			{/*<div className="col-md-2">
				<button
					className="btn btn-block btn-lg btn-warning"
					disabled={!note}
					onClick={onClickRespond(addMaybeAttendee)}
				>Možná</button>
			</div>*/}
			<div className="col-md-6">
				<button
					className="btn btn-block btn-lg btn-danger"
					onClick={onClickRespond(addNonAttendee)}
				>Nedorazím</button>
			</div>
			{attendeeErrorMessage && <div className="col-md-12"><div className="alert alert-danger">{attendeeErrorMessage}</div></div>}
		</div>
	</form>;
}
export default withFirebase(withAuth(AttendanceResponseForm));
