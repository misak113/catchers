import React, { useState } from 'react';
import moment from 'moment-timezone';
import classNames from 'classnames';
import { AddToCalendarButton } from 'add-to-calendar-button-react';
import Anchor from '../Components/Anchor';
import { withFirebase, IFirebaseValue } from '../Context/FirebaseContext';
import Loading from '../Components/Loading';
import Attendees from '../Components/Match/Attendees';
import { didUserRespondMatch, getMatchEventName, useMatches } from '../Model/matchFacade';
import { hasPrivilege, useCurrentUser, usePossibleAttendees } from '../Model/userFacade';
import { withAuth, IAuthValue } from '../Context/AuthContext';
import MatchDate from '../Components/Match/MatchDate';
import MatchTime from '../Components/Match/MatchTime';
import { SyncMatches } from '../Components/Match/SyncMatches';
import { IMatch, IUser, Privilege } from '../Model/collections';
import './Matches.css';
import { formatDate, formatTime } from '../Util/datetime';
import config from '../config.json';
import { getPSMFFieldUrl, getPSMFGroupUrl, getPSMFTeamUrl, getPSMFTournamentUrl, useTeamName } from '../Model/psmfFacade';
import { TeamName } from '../Components/Team/TeamName';

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

		{hasPrivilege(currentUser, Privilege.SyncMatches) && <SyncMatches/>}

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
				? matches.map((match) => <MatchRow
					key={match.id}
					match={match}
					currentUser={currentUser}
					now={now}
					possibleAttendees={possibleAttendees}
				/>)
				: <tr><td colSpan={6}><Loading size='50px'/></td></tr>}
		</tbody>
	</table>;
}

interface MatchRowProps {
	match: IMatch;
	currentUser: IUser | undefined;
	now: Date;
	possibleAttendees: IUser[] | undefined;
}

const MatchRow = ({ match, currentUser, now, possibleAttendees }: MatchRowProps) => {
	const teamName = useTeamName({
		tournament: match.tournament,
		group: match.group,
		code: match.opponent,
	});
	const currentUserResponded = didUserRespondMatch(match, currentUser);
	const endsAt = moment(match.startsAt).add(90, 'minutes').toDate();
	return <tr className={classNames({
		'table-dark': match.startsAt.valueOf() < now.valueOf(),
		'table-success': match.startsAt.valueOf() > now.valueOf() && moment(match.startsAt).diff(now, 'days') < 7,
		'table-secondary': Boolean(match.referees),
	})}>
		<td>
			<Anchor href={`/zapas/${match.id}`}>
				<MatchDate startsAt={match.startsAt}/>
				<br/>
				<small className='font-weight-lighter'><i>přejít na detail</i></small>
			</Anchor>
		</td>
		<td><MatchTime startsAt={match.startsAt}/></td>
		<td>
			{match.tournament && match.group
				? <a href={getPSMFTeamUrl(match.tournament, match.group, match.opponent)} target='_blank' rel="noreferrer">
					<span className="fa fa-external-link icon-external"/> <TeamName tournament={match.tournament} group={match.group} code={match.opponent}/>
				</a>
				: <TeamName tournament={match.tournament} group={match.group} code={match.opponent}/>
			}
			<br/>
			<small className='font-weight-lighter'>
				{match.tournament && <a href={getPSMFTournamentUrl(match.tournament)} target='_blank' rel="noreferrer">
					<span className="fa fa-external-link icon-external"/> {match.tournament}
				</a>}
				&nbsp;
				{match.tournament && match.group && <a href={getPSMFGroupUrl(match.tournament, match.group)} target='_blank' rel="noreferrer">
					<span className="fa fa-external-link icon-external"/> {match.group}
				</a>}
			</small>
			{match.referees && match.referees.map((referee) => referee.replace(' ', ' ')).join(', ')}
		</td>
		<td>
			{match.field ? <a href={getPSMFFieldUrl(match.field)} target='_blank' rel="noreferrer">
				<span className="fa fa-external-link icon-external"/> {match.field.replace(' ', ' ')}
			</a> : 'Neuvedeno'}
		</td>
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
			{!currentUserResponded && <Anchor href={`/zapas/${match.id}`}>
				<small className='font-weight-lighter'><i>vyjádřit se</i></small>
			</Anchor>}
		</td>
		<td>
		<AddToCalendarButton
			name={getMatchEventName(match, teamName ?? match.opponent)}
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
};
