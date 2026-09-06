import React, { useMemo, useState } from 'react';
import moment from 'moment-timezone';
import classNames from 'classnames';
import { AddToCalendarButton } from 'add-to-calendar-button-react';
import {
	BarElement,
	CategoryScale,
	Chart as ChartJS,
	Legend as ChartLegend,
	LinearScale,
	type ChartData,
	type ChartOptions,
	Tooltip as ChartTooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import Anchor from '../Components/Anchor';
import { withFirebase, IFirebaseValue } from '../Context/FirebaseContext';
import Loading from '../Components/Loading';
import Attendees from '../Components/Match/Attendees';
import { didUserRespondMatch, getMatchEventName, PAST_MATCHES_PAGE_SIZE, usePastMatches, useUpcomingMatches } from '../Model/matchFacade';
import { hasPrivilege, useCurrentUser, usePossibleAttendees } from '../Model/userFacade';
import { withAuth, IAuthValue } from '../Context/AuthContext';
import MatchDate from '../Components/Match/MatchDate';
import MatchTime from '../Components/Match/MatchTime';
import { SyncMatches } from '../Components/Match/SyncMatches';
import { IMatch, IUser, Privilege } from '../Model/collections';
import './Matches.css';
import { formatDate, formatTime } from '../Util/datetime';
import config from '../config.json';
import { getPSMFFieldUrl, getPSMFGroupUrl, getPSMFTournamentUrl, useTeamName } from '../Model/psmfFacade';
import { TeamName } from '../Components/Team/TeamName';
import { getPSMFTeamUrl } from '../Model/psmfIndependentFacade';
import {
	formatPSMFSeasonLabel,
	getCurrentPSMFSeason,
	getNextPSMFSeason,
	getPreviousPSMFSeason,
	isSamePSMFSeason,
	IPSMFHistoricalMatch,
	IPSMFSeason,
	useSeasonMatchHistory,
} from '../Model/psmfMatchHistoryFacade';

interface IProps {}

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, ChartLegend);

const Matches: React.FC<IProps & IFirebaseValue & IAuthValue> = (props: IProps & IFirebaseValue & IAuthValue) => {
	const [errorMessage, setErrorMessage] = useState<string>();
	const [selectedSeason, setSelectedSeason] = useState<IPSMFSeason>(() => getCurrentPSMFSeason());
	const [possibleAttendees] = usePossibleAttendees(props.firebaseApp, props.auth.user, setErrorMessage);
	const [currentUser] = useCurrentUser(props.firebaseApp, props.auth.user, setErrorMessage);
	const upcomingMatches = useUpcomingMatches(props.firebaseApp);
	const pastMatchesPagination = usePastMatches(props.firebaseApp, props.auth.user, setErrorMessage);
	const seasonHistory = useSeasonMatchHistory(selectedSeason);
	const currentSeason = getCurrentPSMFSeason();

	return <>
		<h1>Zápasy</h1>

		<h2>Nadcházející</h2>
		<MatchesTable matches={upcomingMatches} possibleAttendees={possibleAttendees} errorMessage={errorMessage} currentUser={currentUser}/>

		{hasPrivilege(currentUser, Privilege.SyncMatches) && <SyncMatches/>}

		<SeasonHistoryChart
			season={selectedSeason}
			currentSeason={currentSeason}
			onPreviousSeason={() => setSelectedSeason((season) => getPreviousPSMFSeason(season))}
			onNextSeason={() => setSelectedSeason((season) => getNextPSMFSeason(season))}
			seasonHistory={seasonHistory}
		/>

		<h2 className="Matches-pastHeader">Minulé</h2>
		<MatchesTable matches={pastMatchesPagination.matches} possibleAttendees={possibleAttendees} errorMessage={errorMessage} currentUser={currentUser}/>
		<PastMatchesPagination
			pageIndex={pastMatchesPagination.pageIndex}
			hasPreviousPage={pastMatchesPagination.hasPreviousPage}
			hasNextPage={pastMatchesPagination.hasNextPage}
			onPreviousPage={pastMatchesPagination.goToPreviousPage}
			onNextPage={pastMatchesPagination.goToNextPage}
			matches={pastMatchesPagination.matches}
		/>
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
	return <div className="table-responsive-md">
		<table className="Matches-table table table-light table-bordered table-hover table-striped">
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
		</table>
	</div>;
}

interface IPastMatchesPaginationProps {
	pageIndex: number;
	hasPreviousPage: boolean;
	hasNextPage: boolean;
	onPreviousPage: () => void;
	onNextPage: () => void;
	matches: IMatch[] | undefined;
}

function PastMatchesPagination({
	pageIndex,
	hasPreviousPage,
	hasNextPage,
	onPreviousPage,
	onNextPage,
	matches,
}: IPastMatchesPaginationProps) {
	return <div className="Matches-pagination">
		<button
			type="button"
			className="btn btn-secondary"
			onClick={onPreviousPage}
			disabled={!hasPreviousPage || !matches}
		>
			Novější
		</button>
		<span className="Matches-paginationStatus">
			Strana {pageIndex + 1}, {matches ? matches.length : 0} záznamů na stránce
		</span>
		<button
			type="button"
			className="btn btn-secondary"
			onClick={onNextPage}
			disabled={!hasNextPage || !matches}
		>
			Starší
		</button>
		<span className="Matches-paginationLimit">
			Zobrazuje se nejvýše {PAST_MATCHES_PAGE_SIZE} minulých zápasů.
		</span>
	</div>;
}

interface ISeasonHistoryChartProps {
	season: IPSMFSeason;
	currentSeason: IPSMFSeason;
	onPreviousSeason: () => void;
	onNextSeason: () => void;
	seasonHistory: ReturnType<typeof useSeasonMatchHistory>;
}

function SeasonHistoryChart({
	season,
	currentSeason,
	onPreviousSeason,
	onNextSeason,
	seasonHistory,
}: ISeasonHistoryChartProps) {
	const finishedMatches = useMemo(() => {
		return [...(seasonHistory.data?.matches ?? [])]
			.filter((match) => Boolean(match.score))
			.sort((match1, match2) => Date.parse(match1.startsAtIso) - Date.parse(match2.startsAtIso));
	}, [seasonHistory.data?.matches]);
	const chartData = useMemo<ChartData<'bar'>>(() => ({
		labels: finishedMatches.map((match) => formatSeasonMatchLabel(match)),
		datasets: [
			{
				label: 'Vstřelené góly',
				data: finishedMatches.map((match) => getCatchersGoals(match).scored),
				backgroundColor: '#16a34a',
				borderColor: '#15803d',
				borderWidth: 1,
			},
			{
				label: 'Inkasované góly',
				data: finishedMatches.map((match) => -getCatchersGoals(match).received),
				backgroundColor: '#dc2626',
				borderColor: '#b91c1c',
				borderWidth: 1,
			},
		],
	}), [finishedMatches]);
	const chartOptions = useMemo<ChartOptions<'bar'>>(() => ({
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				position: 'bottom',
			},
			tooltip: {
				callbacks: {
					label: (context) => `${context.dataset.label}: ${Math.abs(context.parsed.y)}`,
				},
			},
		},
		scales: {
			x: {
				title: {
					display: true,
					text: 'Zápasy',
				},
			},
			y: {
				ticks: {
					precision: 0,
					callback: (value) => `${Math.abs(Number(value))}`,
				},
				title: {
					display: true,
					text: 'Góly',
				},
			},
		},
	}), []);

	return <section className="Matches-seasonHistory card">
		<div className="card-header Matches-seasonHistoryHeader">
			<h2 className="Matches-seasonHistoryTitle">Historie výsledků</h2>
			<div className="Matches-seasonHistoryControls">
				<button
					type="button"
					className="btn btn-outline-secondary"
					onClick={onPreviousSeason}
					aria-label="Předchozí sezóna"
				>
					<span aria-hidden="true">←</span>
				</button>
				<span className="Matches-seasonHistoryLabel">{formatPSMFSeasonLabel(season)}</span>
				<button
					type="button"
					className="btn btn-outline-secondary"
					onClick={onNextSeason}
					disabled={isSamePSMFSeason(season, currentSeason)}
					aria-label="Další sezóna"
				>
					<span aria-hidden="true">→</span>
				</button>
			</div>
		</div>
		<div className="card-body">
			<p className="Matches-seasonHistoryLegend text-muted">
				Zeleně vstřelené góly, červeně inkasované góly.
			</p>
			{seasonHistory.errorMessage && <div className="alert alert-danger mb-3">{seasonHistory.errorMessage}</div>}
			{seasonHistory.loading && !seasonHistory.data
				? <Loading size='50px'/>
				: finishedMatches.length < 1
					? <p className="mb-0">Pro tuto sezónu zatím nejsou k dispozici žádné odehrané zápasy.</p>
					: <div className="Matches-seasonHistoryChartWrapper">
						<Bar data={chartData} options={chartOptions}/>
					</div>}
		</div>
	</section>;
}

function formatSeasonMatchLabel(match: IPSMFHistoricalMatch) {
	const date = new Date(match.startsAtIso);
	const formattedDate = new Intl.DateTimeFormat('cs-CZ', {
		day: 'numeric',
		month: 'numeric',
	}).format(date);
	return `${formattedDate} ${match.opponentName}`;
}

function getCatchersGoals(match: IPSMFHistoricalMatch) {
	if (!match.score) {
		return {
			scored: 0,
			received: 0,
		};
	}
	const catchersHome = match.homeTeamCode === 'catchers-sc';
	return catchersHome
		? { scored: match.score.home, received: match.score.guest }
		: { scored: match.score.guest, received: match.score.home };
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
