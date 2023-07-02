import React, { useCallback, useEffect, useState } from 'react';
import { Modal } from '../Modal/Modal';
import './SyncMatches.css';
import { IPSMFLeague, areMatchesSame, useLeagues, useTeamMatches } from '../../Model/psmfFacade';
import Loading from '../Loading';
import FormattedDateTime from '../Util/FormattedDateTime';
import { IFirebaseValue, withFirebase } from '../../Context/FirebaseContext';
import { addMatch, updateMatch, useUpcomingMatches } from '../../Model/matchFacade';
import classNames from 'classnames';
import { IRouterValue, withRouter } from '../../Context/RouterContext';
import { TeamName } from '../Team/TeamName';

export const SyncMatches = () => {
	const [errorMessage, setErrorMessage] = useState<string>();
	const [open, setOpen] = useState(false);
	const [league, setLeague] = useState<IPSMFLeague | null>(null);
	useEffect(() => {
		setLeague(null);
	}, [open]);

	return (
		<div className="col-md-12 SyncMatches">
			<button
				className="btn btn-block btn-lg btn-success"
				onClick={() => setOpen(true)}
			>Synchronizovat zápasy z PSMF</button>
			<Modal title={'Synchronizace zápasů z PSMF'} open={open} setOpen={setOpen}>
				{errorMessage && <div className='alert alert-danger'>{errorMessage}</div>}
				<h1>{!league ? 'Vyber ligu' : 'Synchronizuj zápasy'}</h1>
				{open && !league && <SelectLeague setLeague={setLeague} setErrorMessage={setErrorMessage} />}
				{open && league && <SyncLeagueMatches league={league} setErrorMessage={setErrorMessage}/>}
			</Modal>
		</div>
	);
};

interface SelectLeagueProps {
	setLeague: (league: IPSMFLeague) => void;
	setErrorMessage: (message: string | undefined) => void;
}

const SelectLeague = ({ setLeague, setErrorMessage }: SelectLeagueProps) => {
	const leagues = useLeagues(setErrorMessage);
	if (!leagues) {
		return <Loading/>;
	}

	return (
		<div>
			<table className='table table-light table-bordered table-hover table-striped table-responsive-md'>
				<tbody>
					{leagues.map((league) => {
						return (
							<tr key={league.name}>
								<td>{league.name}</td>
								<td><button className='btn btn-primary' onClick={() => setLeague(league)}>Vybrat</button></td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
};

interface SyncLeagueMatchesProps {
	league: IPSMFLeague;
	setErrorMessage: (message: string | undefined) => void;
}

const SyncLeagueMatches = withFirebase(withRouter(({ league, setErrorMessage, firebaseApp, router }: SyncLeagueMatchesProps & IFirebaseValue & IRouterValue) => {
	const newMatches = useTeamMatches(league, setErrorMessage);
	const existingMatches = useUpcomingMatches(firebaseApp);

	const [synchronizing, setSynchronizing] = useState(false);

	const synchronize = useCallback(async () => {
		if (!newMatches || !existingMatches) {
			return;
		}
		setSynchronizing(true);
		for (const newMatch of newMatches) {
			const existingMatch = existingMatches.find((match) => match.opponent === newMatch.opponent);
			if (existingMatch) {
				console.log('Match already exists', newMatch);
				if (!areMatchesSame(existingMatch, newMatch)) {
					console.log('Updating match', newMatch);
					await updateMatch(firebaseApp, existingMatch, newMatch);
				}
			} else {
				console.log('Creating match', newMatch);
				await addMatch(firebaseApp, newMatch);
			}
		}
		router.refresh();
	}, [newMatches, existingMatches, firebaseApp, router]);

	if (!newMatches || !existingMatches) {
		return <Loading/>;
	}

	const matchesToAdd = newMatches.filter((newMatch) => !existingMatches.find((match) => match.opponent === newMatch.opponent));
	const matchesToUpdate = newMatches.filter((newMatch) => {
		const existingMatch = existingMatches.find((match) => match.opponent === newMatch.opponent);
		return existingMatch && !areMatchesSame(existingMatch, newMatch);
	});

	return (
		<div>
			<table className='table table-light table-bordered table-hover table-striped table-responsive-md'>
				<thead>
					<tr>
						<th>Soupeř</th>
						<th>Hřiště</th>
						<th>Začátek</th>
						<th>Stav</th>
					</tr>
				</thead>
				<tbody>
					{newMatches.map((newMatch) => {
						const existingMatch = existingMatches.find((match) => match.opponent === newMatch.opponent);
						return (
							<tr key={newMatch.opponent} className={classNames({
								'table-info': existingMatch && !areMatchesSame(existingMatch, newMatch),
								'table-success': !existingMatch,
							})}>
								<td><TeamName tournament={newMatch.tournament} group={newMatch.group} code={newMatch.opponent}/></td>
								<td>
									{newMatch.field}
									{existingMatch && existingMatch.field !== newMatch.field && <><br/><del>{existingMatch.field}</del></>}
								</td>
								<td>
									<FormattedDateTime startsAt={newMatch.startsAt}/>
									{existingMatch && existingMatch.startsAt.valueOf() !== newMatch.startsAt.valueOf() && <><br/><del>{<FormattedDateTime startsAt={existingMatch.startsAt}/>}</del></>}
								</td>
								<td>
									{existingMatch && !areMatchesSame(existingMatch, newMatch) && <span className='badge badge-info'>Aktualizovaný</span>}
									{!existingMatch && <span className='badge badge-success'>Nový</span>}
									{existingMatch && areMatchesSame(existingMatch, newMatch) && <span className='badge badge-secondary'>Beze změny</span>}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>

			{(matchesToAdd.length > 0 || matchesToUpdate.length > 0)
				&& <button type="button" className="btn btn-success" onClick={synchronize} disabled={synchronizing}>Synchronizovat</button>}
		</div>
	);
}));
