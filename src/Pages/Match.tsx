import React, { useState } from 'react';
import './Match.css';
import { withFirebase, IFirebaseValue } from '../Context/FirebaseContext';
import { usePossibleAttendees, useCurrentUser } from '../Model/userFacade';
import {
	useMatch,
	addAttendee,
	addMaybeAttendee,
	addNonAttendee,
} from '../Model/matchFacade';
import Attendees from '../Components/Match/Attendees';
import Loading from '../Components/Loading';
import { IAuthValue, withAuth } from '../Context/AuthContext';
import TeamCard from '../Components/Match/TeamCard';
import FieldCard from '../Components/Match/FieldCard';
import MatchTimeCard from '../Components/Match/MatchTimeCard';
import { getErrorMessage } from '../Util/error';

interface IProps {
	matchId: string;
}

const Match: React.FC<IProps & IFirebaseValue & IAuthValue> = (props: IProps & IFirebaseValue & IAuthValue) => {
	const [errorMessage, setErrorMessage] = useState<string>();
	const [attendeeErrorMessage, setAttendeeErrorMessage] = useState<string>();
	const [possibleAttendees] = usePossibleAttendees(props.firebaseApp, props.auth.user, setErrorMessage);
	const [currentUser] = useCurrentUser(props.firebaseApp, props.auth.user, setErrorMessage);
	const { match, reloadMatch } = useMatch(props.matchId, props.firebaseApp, props.auth.user, setErrorMessage);

	const attendees = match?.attendees || [];
	const maybeAttendees = match?.maybeAttendees || [];
	const nonAttendees = match?.nonAttendees || [];
	const currentUserResponded = match?.attendees?.some((person) => person.userId === currentUser?.id)
		|| match?.nonAttendees?.some((person) => person.userId === currentUser?.id)
		|| match?.maybeAttendees?.some((person) => person.userId === currentUser?.id);

	const [note, setNote] = useState<string>();

	const onClickRespond = (doResult: typeof addAttendee) => async (
		event: React.MouseEvent<HTMLButtonElement, MouseEvent>
	): Promise<void> => {
		try {
			event.preventDefault();
			if (!match || !currentUser) {
				throw new Error(`Not loaded all data`);
			}
			await doResult(props.firebaseApp, match, currentUser, note);
			reloadMatch();
			setAttendeeErrorMessage(undefined);
		} catch (error) {
			console.error(error);
			setAttendeeErrorMessage(getErrorMessage(error));
		}
	};

	return <>
		<h1>Zápas</h1>
		{errorMessage ? errorMessage : <>
			{currentUser?.player && !currentUserResponded && <div className="Match-unresponded jumbotron alert alert-warning">
				<form onSubmit={(event) => event.preventDefault()}>
					<h3>K tomuto zápasu ses ještě nevyjádřil</h3>
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
						<div className="col-md-5">
							<button
								className="btn btn-block btn-lg btn-success"
								onClick={onClickRespond(addAttendee)}
							>Přijdu</button>
						</div>
						<div className="col-md-2">
							<button
								className="btn btn-block btn-lg btn-warning"
								disabled={!note}
								onClick={onClickRespond(addMaybeAttendee)}
							>Možná</button>
						</div>
						<div className="col-md-5">
							<button
								className="btn btn-block btn-lg btn-danger"
								onClick={onClickRespond(addNonAttendee)}
							>Nedorazím</button>
						</div>
						{attendeeErrorMessage && <div className="col-md-12"><div className="alert alert-danger">{attendeeErrorMessage}</div></div>}
					</div>
				</form>
			</div>}
			<div className="row Match-cards">
				<div className="col-md-4">
					<MatchTimeCard startsAt={match?.startsAt}/>
				</div>
				<div className="col-md-4">
					<TeamCard opponent={match?.opponent}/>
				</div>
				<div className="col-md-4">
					<FieldCard field={match?.field}/>
				</div>
			</div>
			<Attendees
				possibleAttendees={possibleAttendees}
				attendees={attendees}
				maybeAttendees={maybeAttendees}
				nonAttendees={nonAttendees}
			/>
			<div className="row Match-attendees">
				<div className="col-md-4">
					<table className="table table-light table-bordered table-hover table-striped">
						<thead>
							<tr><td className="table-success">Potvrzení</td></tr>
						</thead>
						<tbody>
							{match ? attendees.map((attendee) => (
								<tr key={attendee.userId}><td>
									{attendee.userId}
									{attendee.note && <footer className="blockquote-footer">{attendee.note}</footer>}
								</td></tr>
							)) : <tr><td><Loading size='40px'/></td></tr>}
							{match ? maybeAttendees.map((maybeAttendee) => (
								<tr className="table-warning" key={maybeAttendee.userId}><td>
									{maybeAttendee.userId}<br/>
									{maybeAttendee.note && <footer className="blockquote-footer">{maybeAttendee.note}</footer>}
								</td></tr>
							)) : <tr className="table-warning"><td><Loading size='40px'/></td></tr>}
						</tbody>
					</table>
				</div>
				<div className="col-md-4">
					<table className="table table-light table-bordered table-hover table-striped">
						<thead>
							<tr><td className="table-danger">Odmítnutí</td></tr>
						</thead>
						<tbody>
							{match ? nonAttendees.map((nonAttendee) => (
								<tr key={nonAttendee.userId}><td>
									{nonAttendee.userId}<br/>
									{nonAttendee.note && <footer className="blockquote-footer">{nonAttendee.note}</footer>}
								</td></tr>
							)) : <tr><td><Loading size='40px'/></td></tr>}
						</tbody>
					</table>
				</div>
				<div className="col-md-4">
					<table className="table table-light table-bordered table-hover table-striped">
						<thead>
							<tr><td>Nevyjádření</td></tr>
						</thead>
						<tbody>
							{possibleAttendees ? possibleAttendees.map((possibleAttendee) => (
								<tr key={possibleAttendee}><td>{possibleAttendee}</td></tr>
							)) : <tr><td><Loading size='40px'/></td></tr>}
						</tbody>
					</table>
				</div>
			</div>
		</>}
	</>;
};
export default withFirebase(withAuth(Match));
