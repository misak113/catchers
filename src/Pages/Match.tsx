import React, { useState } from 'react';
import './Match.css';
import { withFirebase, IFirebaseValue } from '../Context/FirebaseContext';
import { usePossibleAttendees, useCurrentUser, getUserName, createMapPersonResultToUser, getUnrespondedUsers } from '../Model/userFacade';
import {
	didUserRespondMatch,
	getDeadlineResponseDate,
	useMatch,
} from '../Model/matchFacade';
import Attendees from '../Components/Match/Attendees';
import Loading from '../Components/Loading';
import { IAuthValue, withAuth } from '../Context/AuthContext';
import TeamCard from '../Components/Match/TeamCard';
import FieldCard from '../Components/Match/FieldCard';
import TournamentCard from '../Components/Match/TournamentCard';
import MatchTimeCard from '../Components/Match/MatchTimeCard';
import AttendanceResponseForm from '../Components/Match/AttendenceResponseForm';
import FormattedDateTime from '../Components/Util/FormattedDateTime';
import SetFine from '../Components/Fine/SetFine';
import { formatDateTimeHumanized } from '../Util/datetime';

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
	const currentUserResponded = didUserRespondMatch(match, currentUser);

	const unrespondedUsers = getUnrespondedUsers({ attendees, maybeAttendees, nonAttendees, possibleAttendees});

	function getFirstAttendeeResultLog(userId: string) {
		if (!match) {
			return undefined;
		}
		return match.attendeesResultLog
			?.sort((a, b) => a.resultAt.getTime() - b.resultAt.getTime())
			?.find((log) => log.userId === userId);
	}

	function getClassNameByUserId(userId: string) {
		if (!match) {
			return undefined;
		}
		const firstPlayerResultLog = getFirstAttendeeResultLog(userId);
		const deadlineDate = getDeadlineResponseDate(match);
		const resultAt = firstPlayerResultLog?.resultAt ?? new Date();
		const isTooLate = resultAt.getTime() > deadlineDate.valueOf();
		console.log('resultAt', userId, resultAt, 'deadlineDate', deadlineDate, 'isTooLate', isTooLate);
		return isTooLate ? 'table-danger' : undefined;
	}

	function getFirstResultLogTitle(date: Date | undefined) {
		if (!date) {
			return undefined;
		}
		return `První vyjádření k zápasu bylo provedeno ${formatDateTimeHumanized(date)}`;
	}

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
				<div className="col-md-3">
					<TeamCard tournament={match?.tournament} group={match?.group} opponent={match?.opponent}/>
				</div>
				<div className="col-md-2">
					<FieldCard field={match?.field}/>
				</div>
				<div className="col-md-3">
					<TournamentCard tournament={match?.tournament} group={match?.group}/>
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
									<SetFine userId={attendee.userId} users={possibleAttendees} currentUser={currentUser} match={match}/>
									{getUserName(mapPersonResultToUser(attendee))}<br/>
									<footer className="blockquote-footer"><FormattedDateTime startsAt={attendee.resultAt} className={getClassNameByUserId(attendee.userId)} title={getFirstResultLogTitle(getFirstAttendeeResultLog(attendee.userId)?.resultAt)}/></footer>
									{attendee.note && <footer className="blockquote-footer">{attendee.note}</footer>}
								</td></tr>
							)) : <tr><td><Loading size='40px'/></td></tr>}
							{match ? maybeAttendees.map((maybeAttendee) => (
								<tr className="table-warning" key={maybeAttendee.userId}><td>
									<SetFine userId={maybeAttendee.userId} users={possibleAttendees} currentUser={currentUser} match={match}/>
									{getUserName(mapPersonResultToUser(maybeAttendee))}<br/>
									<footer className="blockquote-footer"><FormattedDateTime startsAt={maybeAttendee.resultAt} className={getClassNameByUserId(maybeAttendee.userId)} title={getFirstResultLogTitle(getFirstAttendeeResultLog(maybeAttendee.userId)?.resultAt)}/></footer>
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
									<SetFine userId={nonAttendee.userId} users={possibleAttendees} currentUser={currentUser} match={match}/>
									{getUserName(mapPersonResultToUser(nonAttendee))}<br/>
									<footer className="blockquote-footer"><FormattedDateTime startsAt={nonAttendee.resultAt} className={getClassNameByUserId(nonAttendee.userId)} title={getFirstResultLogTitle(getFirstAttendeeResultLog(nonAttendee.userId)?.resultAt)}/></footer>
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
								<tr key={possibleAttendee.id}><td>
									<SetFine userId={possibleAttendee.id} users={possibleAttendees} currentUser={currentUser} match={match}/>
									<span className={getClassNameByUserId(possibleAttendee.id)}>{getUserName(possibleAttendee)}</span>
								</td></tr>
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
