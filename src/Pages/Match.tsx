import React, { useState } from 'react';
import './Match.css';
import { withFirebase, IFirebaseValue } from '../Context/FirebaseContext';
import { usePossibleAttendees } from '../Model/userFacade';
import { useMatch } from '../Model/matchFacade';
import Attendees from '../Components/Match/Attendees';
import Loading from '../Components/Loading';

interface IProps {
	matchId: string;
}

const Match: React.FC<IProps & IFirebaseValue> = (props: IProps & IFirebaseValue) => {
	const [errorMessage, setErrorMessage] = useState<string>();
	const [possibleAttendees] = usePossibleAttendees(props.firebaseApp, setErrorMessage);
	const [match] = useMatch(props.matchId, props.firebaseApp, setErrorMessage);

	const attendees = match?.attendees || [];
	const nonAttendees = match?.nonAttendees || [];

	return <>
		<h1>Zápas</h1>
		{errorMessage ? errorMessage : <>
			<Attendees
				possibleAttendees={possibleAttendees}
				attendees={attendees}
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
								<tr key={attendee.userId}><td>{attendee.userId}</td></tr>
							)) : <tr><td><Loading size='40px'/></td></tr>}
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
								<tr key={nonAttendee.userId}><td>{nonAttendee.userId}</td></tr>
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
export default withFirebase(Match);
