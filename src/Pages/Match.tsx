import React, { useState } from 'react';
import './Match.css';
import { withFirebase, IFirebaseValue } from '../Context/FirebaseContext';
import { usePossibleAttendees, useCurrentUser, getUserName, createMapPersonResultToUser, getUnrespondedUsers } from '../Model/userFacade';
import {
	useMatch,
} from '../Model/matchFacade';
import Attendees from '../Components/Match/Attendees';
import Loading from '../Components/Loading';
import { IAuthValue, withAuth } from '../Context/AuthContext';
import TeamCard from '../Components/Match/TeamCard';
import FieldCard from '../Components/Match/FieldCard';
import MatchTimeCard from '../Components/Match/MatchTimeCard';
import AttendanceResponseForm from '../Components/Match/AttendenceResponseForm';

interface IProps {
	matchId: string;
}

const Match: React.FC<IProps & IFirebaseValue & IAuthValue> = (props: IProps & IFirebaseValue & IAuthValue) => {
	const [errorMessage, setErrorMessage] = useState<string>();
	const [possibleAttendees] = usePossibleAttendees(props.firebaseApp, props.auth.user, setErrorMessage);
	const [currentUser] = useCurrentUser(props.firebaseApp, props.auth.user, setErrorMessage);
	const { match, reloadMatch } = useMatch(props.matchId, props.firebaseApp, props.auth.user, setErrorMessage);
	const mapPersonResultToUser = createMapPersonResultToUser(possibleAttendees);

	const attendees = match?.attendees || [];
	const maybeAttendees = match?.maybeAttendees || [];
	const nonAttendees = match?.nonAttendees || [];
	const currentUserResponded = match?.attendees?.some((person) => person.userId === currentUser?.id)
		|| match?.nonAttendees?.some((person) => person.userId === currentUser?.id)
		|| match?.maybeAttendees?.some((person) => person.userId === currentUser?.id);

	const unrespondedUsers = getUnrespondedUsers({ attendees, maybeAttendees, nonAttendees, possibleAttendees});

	return <>
		<h1>Zápas</h1>
		{errorMessage ? errorMessage : <>
			{currentUser?.player && !currentUserResponded && <div className="Match-unresponded jumbotron alert alert-warning">
				<AttendanceResponseForm
					title="K tomuto zápasu ses ještě nevyjádřil"
					match={match}
					reloadMatch={reloadMatch}
					setErrorMessage={setErrorMessage}
				/>
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
									{getUserName(mapPersonResultToUser(attendee))}<br/>
									{attendee.note && <footer className="blockquote-footer">{attendee.note}</footer>}
								</td></tr>
							)) : <tr><td><Loading size='40px'/></td></tr>}
							{match ? maybeAttendees.map((maybeAttendee) => (
								<tr className="table-warning" key={maybeAttendee.userId}><td>
									{getUserName(mapPersonResultToUser(maybeAttendee))}<br/>
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
									{getUserName(mapPersonResultToUser(nonAttendee))}<br/>
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
							{unrespondedUsers ? unrespondedUsers.map((possibleAttendee) => (
								<tr key={possibleAttendee.id}><td>{getUserName(possibleAttendee)}</td></tr>
							)) : <tr><td><Loading size='40px'/></td></tr>}
						</tbody>
					</table>
				</div>
			</div>
			{currentUser?.player && currentUserResponded && <div className="Match-changeResponse alert alert-info">
				<AttendanceResponseForm
					title="Změn své vyjádření k zápasu"
					match={match}
					reloadMatch={reloadMatch}
					setErrorMessage={setErrorMessage}
				/>
			</div>}
		</>}
	</>;
};
export default withFirebase(withAuth(Match));
