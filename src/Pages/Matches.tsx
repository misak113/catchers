import React, { useState } from 'react';
import moment from 'moment';
import classNames from 'classnames';
import Anchor from '../Components/Anchor';
import { withFirebase, IFirebaseValue } from '../Context/FirebaseContext';
import Loading from '../Components/Loading';
import Attendees from '../Components/Match/Attendees';
import { useMatches } from '../Model/matchFacade';
import { usePossibleAttendees } from '../Model/userFacade';
import { withAuth, IAuthValue } from '../Context/AuthContext';
import MatchDate from '../Components/Match/MatchDate';
import MatchTime from '../Components/Match/MatchTime';
import { IMatch, IUser } from '../Model/collections';
import './Matches.css';

interface IProps {}

const Matches: React.FC<IProps & IFirebaseValue & IAuthValue> = (props: IProps & IFirebaseValue & IAuthValue) => {
	const [errorMessage, setErrorMessage] = useState<string>();
	const [possibleAttendees] = usePossibleAttendees(props.firebaseApp, props.auth.user, setErrorMessage);
	const [matches] = useMatches(props.firebaseApp, props.auth.user, setErrorMessage);

	const upcomingMatches = matches?.filter((match) => match.startsAt.valueOf() > new Date().valueOf());
	const pastMatches = matches?.filter((match) => match.startsAt.valueOf() < new Date().valueOf()).reverse();

	return <>
		<h1>Zápasy</h1>

		<h2>Nadcházející</h2>
		<MatchesTable matches={upcomingMatches} possibleAttendees={possibleAttendees} errorMessage={errorMessage}/>

		<h2 className="Matches-pastHeader">Minulé</h2>
		<MatchesTable matches={pastMatches} possibleAttendees={possibleAttendees} errorMessage={errorMessage}/>
	</>;
};
export default withFirebase(withAuth(Matches));

interface IMatchesTableProps {
	matches: IMatch[] | undefined;
	possibleAttendees: IUser[] | undefined;
	errorMessage?: string;
}

function MatchesTable({ matches, possibleAttendees, errorMessage }: IMatchesTableProps) {
	const now = new Date();
	return <table className="table table-light table-bordered table-hover table-striped table-responsive-md">
		<thead>
			<tr>
				<th>Datum</th>
				<th>Čas</th>
				<th>Soupeř</th>
				<th>Hřiště</th>
				<th>Účastníci</th>
			</tr>
		</thead>
		<tbody>
			{errorMessage
			? <tr><td colSpan={5}>{errorMessage}</td></tr>
			: matches
				? matches.map((match) => (
					<tr key={match.id} className={classNames({
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
							/>
						</td>
					</tr>
				))
				: <tr><td colSpan={5}><Loading size='50px'/></td></tr>}
		</tbody>
	</table>;
}
