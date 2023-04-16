import React, { useState } from 'react';
import moment from 'moment-timezone';
import classNames from 'classnames';
import { AddToCalendarButton } from 'add-to-calendar-button-react';
import Anchor from '../Components/Anchor';
import { withFirebase, IFirebaseValue } from '../Context/FirebaseContext';
import Loading from '../Components/Loading';
import Attendees from '../Components/Match/Attendees';
import { didUserRespondMatch, getMatchEventName, useMatches } from '../Model/matchFacade';
import { useCurrentUser, usePossibleAttendees } from '../Model/userFacade';
import { withAuth, IAuthValue } from '../Context/AuthContext';
import MatchDate from '../Components/Match/MatchDate';
import MatchTime from '../Components/Match/MatchTime';
import { IMatch, IUser } from '../Model/collections';
import './Matches.css';
import { formatDate, formatTime } from '../Util/datetime';
import config from '../config.json';

interface IProps {}

const Matches: React.FC<IProps & IFirebaseValue & IAuthValue> = (props: IProps & IFirebaseValue & IAuthValue) => {
	const [errorMessage, setErrorMessage] = useState<string>();
	const [possibleAttendees] = usePossibleAttendees(props.firebaseApp, props.auth.user, setErrorMessage);
	const [currentUser] = useCurrentUser(props.firebaseApp, props.auth.user, setErrorMessage);
	const [matches] = useMatches(props.firebaseApp, props.auth.user, setErrorMessage);

	const upcomingMatches = matches?.filter((match) => match.startsAt.valueOf() > new Date().valueOf());
	const pastMatches = matches?.filter((match) => match.startsAt.valueOf() < new Date().valueOf()).reverse();

	return <>
		<h1>Zápasy</h1>

		<h2>Nadcházející</h2>
		<MatchesTable matches={upcomingMatches} possibleAttendees={possibleAttendees} errorMessage={errorMessage} currentUser={currentUser}/>

		<h2 className="Matches-pastHeader">Minulé</h2>
		<MatchesTable matches={pastMatches} possibleAttendees={possibleAttendees} errorMessage={errorMessage} currentUser={currentUser}/>
	</>;
};
export default withFirebase(withAuth(Matches));

interface IMatchesTableProps {
	matches: IMatch[] | undefined;
	possibleAttendees: IUser[] | undefined;
	errorMessage?: string;
	currentUser: IUser | undefined;
}

function MatchesTable({ matches, possibleAttendees, errorMessage, currentUser }: IMatchesTableProps) {
	const now = new Date();
	return <table className="table table-light table-bordered table-hover table-striped table-responsive-md">
		<thead>
			<tr>
				<th>Datum</th>
				<th>Čas</th>
				<th>Soupeř</th>
				<th>Hřiště</th>
				<th>Účastníci</th>
				<th>Přidat do kalendáře</th>
			</tr>
		</thead>
		<tbody>
			{errorMessage
			? <tr><td colSpan={6}>{errorMessage}</td></tr>
			: matches
				? matches.map((match) => {
					const currentUserResponded = didUserRespondMatch(match, currentUser);
					const endsAt = moment(match.startsAt).add(90, 'minutes').toDate();
					return <tr key={match.id} className={classNames({
						'table-dark': match.startsAt.valueOf() < now.valueOf(),
						'table-success': match.startsAt.valueOf() > now.valueOf() && moment(match.startsAt).diff(now, 'days') < 7,
						'table-secondary': Boolean(match.referees),
					})}>
						<td>
							<Anchor href={`/zapas/${match.id}`}>
								<MatchDate startsAt={match.startsAt}/>
							</Anchor>
						</td>
						<td><MatchTime startsAt={match.startsAt}/></td>
						<td>
							{match.opponent && match.opponent.replace(' ', ' ')}
							{match.referees && match.referees.map((referee) => referee.replace(' ', ' ')).join(', ')}
						</td>
						<td>{match.field.replace(' ', ' ')}</td>
						<td>
							<Attendees
								attendees={match.attendees || []}
								maybeAttendees={match.maybeAttendees || []}
								nonAttendees={match.nonAttendees || []}
								possibleAttendees={possibleAttendees}
							>
								{
									!currentUserResponded
									? <span className="Attendees unresponded">
										<span className="badge badge-warning">Ještě ses nevyjádřil</span>
									</span>
									: null
								}
							</Attendees>
						</td>
						<td>
						<AddToCalendarButton
							name={getMatchEventName(match)}
							startDate={formatDate(match.startsAt)}
							startTime={formatTime(match.startsAt)}
							endDate={formatDate(endsAt)}
							endTime={formatTime(endsAt)}
							timeZone={config.timezone}
							size='1'
							trigger='click'
							label='Přidat do kalendáře'
							options={['Apple','Google','Yahoo','iCal','Outlook.com','MicrosoftTeams','Microsoft365']}
						/>
						</td>
					</tr>;
				})
				: <tr><td colSpan={6}><Loading size='50px'/></td></tr>}
		</tbody>
	</table>;
}
