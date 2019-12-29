import React, { useState } from 'react';
import moment from 'moment';
import classNames from 'classnames';
import Anchor from '../Components/Anchor';
import { withFirebase, IFirebaseValue } from '../Context/FirebaseContext';
import Loading from '../Components/Loading';
import Attendees from '../Components/Match/Attendees';
import { useMatches } from '../Model/matchFacade';
import { usePossibleAttendees } from '../Model/userFacade';

interface IProps {}

const Matches: React.FC<IProps & IFirebaseValue> = (props: IProps & IFirebaseValue) => {
	const [errorMessage, setErrorMessage] = useState<string>();
	const [possibleAttendees] = usePossibleAttendees(props.firebaseApp, setErrorMessage);
	const [matches] = useMatches(props.firebaseApp, setErrorMessage);

	const now = new Date();

	return <>
		<h1>Zápasy</h1>
		
		<table className="table table-light table-bordered table-hover table-striped table-responsive-md">
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
				{matches
				? matches.map((match) => (
					<tr key={match.id} className={classNames({
						'table-success': moment(match.startsAt).diff(now, 'days') < 6,
						'table-dark': !!match.referees,
					})}>
						<td>
							<Anchor href={`/zapas/${match.id}`}>
								{moment(match.startsAt).format('LL')} <small>{moment(match.startsAt).format('ddd')}</small>
							</Anchor>
						</td>
						<td>{moment(match.startsAt).format('LT')}</td>
						<td>
							{match.opponent && match.opponent.replace(' ', ' ')}
							{match.referees && match.referees.map((referee) => referee.replace(' ', ' ')).join(', ')}
						</td>
						<td>{match.field.replace(' ', ' ')}</td>
						<td>
							<Attendees
								attendees={match.attendees || []}
								nonAttendees={match.nonAttendees || []}
								possibleAttendees={possibleAttendees}
							/>
						</td>
					</tr>
				))
				: errorMessage
					? <tr><td colSpan={5}>{errorMessage}</td></tr>
					: <tr><td colSpan={5}><Loading size='50px'/></td></tr>}
			</tbody>
		</table>
	</>;
};
export default withFirebase(Matches);
