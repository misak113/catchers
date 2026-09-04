import React, { useMemo, useState } from 'react';
import classNames from 'classnames';
import {
	CategoryScale,
	Chart as ChartJS,
	Filler,
	Legend as ChartLegend,
	LineElement,
	LinearScale,
	PointElement,
	type ChartData,
	type ChartOptions,
	Tooltip as ChartTooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { IAuthValue, withAuth } from '../Context/AuthContext';
import { IFirebaseValue, withFirebase } from '../Context/FirebaseContext';
import { IRouterValue, withRouter } from '../Context/RouterContext';
import Loading from '../Components/Loading';
import { Modal } from '../Components/Modal/Modal';
import FormattedDateTime from '../Components/Util/FormattedDateTime';
import { IUser, Privilege, TeamRole } from '../Model/collections';
import { getUserName, hasPrivilege, useAllUsers, useCurrentUser } from '../Model/userFacade';
import {
	ShotEventType,
	IShotEvent,
	IShotType,
	addShotDebtEvent,
	addShotSettlementEvent,
	addShotType,
	calculateShotBalances,
	importShotEvents,
	updateShotType,
	useShotEvents,
	useShotTypes,
} from '../Model/shotsFacade';
import './Shots.css';

type IProps = IAuthValue & IFirebaseValue & IRouterValue;
const LONG_DESCRIPTION_LENGTH = 120;

type ShotAction = 'debt' | 'settlement';
type OpenDebt = {
	event: IShotEvent;
	remaining: number;
};
type ShotTrendPoint = {
	label: string;
	balancesByUserId: { [userId: string]: number };
};

const SHOT_CHART_COLORS = [
	'#2563eb',
	'#dc2626',
	'#16a34a',
	'#9333ea',
	'#ea580c',
	'#0891b2',
	'#e11d48',
	'#65a30d',
	'#7c3aed',
	'#0f766e',
];

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, ChartLegend, Filler);

function hasTeamManagerRole(user: IUser | undefined) {
	const teamRoles = user?.teamRoles?.map((role) => role.name) ?? [];
	return teamRoles.includes(TeamRole.TeamManager) || teamRoles.includes(TeamRole.DeputyTeamManager);
}

function getSortedEventsAsc(events: IShotEvent[]) {
	return [...events].sort((event1, event2) => {
		const eventTimeDiff = event1.eventAt.getTime() - event2.eventAt.getTime();
		if (eventTimeDiff !== 0) {
			return eventTimeDiff;
		}
		return event1.createdAt.getTime() - event2.createdAt.getTime();
	});
}

function calculateDebtRemainders(events: IShotEvent[]) {
	const sortedEvents = getSortedEventsAsc(events);
	const openDebts: OpenDebt[] = [];
	const remainingByDebtId: { [eventId: string]: number } = {};

	for (const event of sortedEvents) {
		if (event.type === ShotEventType.Debt) {
			const openDebt: OpenDebt = {
				event,
				remaining: event.amount,
			};
			openDebts.push(openDebt);
			remainingByDebtId[event.id] = event.amount;
			continue;
		}

		let remainingSettlement = event.amount;
		const settleDebts = (allowDebt: (openDebt: OpenDebt) => boolean) => {
			for (const openDebt of openDebts) {
				if (remainingSettlement <= 0) {
					return;
				}
				if (openDebt.remaining <= 0 || !allowDebt(openDebt)) {
					continue;
				}
				const settledAmount = Math.min(openDebt.remaining, remainingSettlement);
				openDebt.remaining -= settledAmount;
				remainingSettlement -= settledAmount;
				remainingByDebtId[openDebt.event.id] = openDebt.remaining;
			}
		};

		if (event.shotTypeName) {
			settleDebts((openDebt) => openDebt.event.shotTypeName === event.shotTypeName);
		}
		if (remainingSettlement > 0) {
			settleDebts(() => true);
		}
	}

	return remainingByDebtId;
}

function getShotChartColor(index: number) {
	return SHOT_CHART_COLORS[index % SHOT_CHART_COLORS.length];
}

function getShotChartDateKey(date: Date) {
	const month = `${date.getMonth() + 1}`.padStart(2, '0');
	const day = `${date.getDate()}`.padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
}

function formatShotChartDate(date: Date) {
	return new Intl.DateTimeFormat('cs-CZ', {
		day: 'numeric',
		month: 'numeric',
		year: 'numeric',
	}).format(date);
}

function buildShotTrendPoints(shotEvents: IShotEvent[], players: IUser[]) {
	const playersById = new Map(players.map((player) => [player.id, player]));
	const playerIds = Array.from(new Set(shotEvents.map((event) => event.userId)))
		.filter((userId) => playersById.has(userId))
		.sort((userId1, userId2) => {
			return getUserName(playersById.get(userId1)!).localeCompare(getUserName(playersById.get(userId2)!));
		});

	if (playerIds.length < 1) {
		return {
			playerIds: [],
			playerNamesByUserId: {} as { [userId: string]: string },
			points: [] as ShotTrendPoint[],
		};
	}

	const playerNamesByUserId = playerIds.reduce<{ [userId: string]: string }>((result, userId) => {
		result[userId] = getUserName(playersById.get(userId)!);
		return result;
	}, {});
	const balancesByUserId = playerIds.reduce<{ [userId: string]: number }>((result, userId) => {
		result[userId] = 0;
		return result;
	}, {});
	const points: ShotTrendPoint[] = [];
	let currentDateKey: string | null = null;
	let currentDateLabel = '';

	for (const event of getSortedEventsAsc(shotEvents)) {
		if (!(event.userId in playerNamesByUserId)) {
			continue;
		}
		const dateKey = getShotChartDateKey(event.eventAt);
		if (currentDateKey !== null && currentDateKey !== dateKey) {
			points.push({
				label: currentDateLabel,
				balancesByUserId: { ...balancesByUserId },
			});
		}
		currentDateKey = dateKey;
		currentDateLabel = formatShotChartDate(event.eventAt);
		balancesByUserId[event.userId] += event.type === ShotEventType.Debt ? event.amount : -event.amount;
	}

	if (currentDateKey !== null) {
		points.push({
			label: currentDateLabel,
			balancesByUserId: { ...balancesByUserId },
		});
	}

	return {
		playerIds,
		playerNamesByUserId,
		points,
	};
}

const Shots: React.FC<IProps> = (props: IProps) => {
	const [errorMessage, setErrorMessage] = useState<string>();
	const [currentUser] = useCurrentUser(props.firebaseApp, props.auth.user, setErrorMessage);
	const [users] = useAllUsers(props.firebaseApp, setErrorMessage);
	const [shotTypes] = useShotTypes(props.firebaseApp, props.auth.user, setErrorMessage);
	const [shotEvents] = useShotEvents(props.firebaseApp, props.auth.user, setErrorMessage);

	const players = useMemo(() => {
		return (users ?? []).filter((user) => user.player).sort((a, b) => getUserName(a).localeCompare(getUserName(b)));
	}, [users]);
	const shotBalances = useMemo(() => calculateShotBalances(shotEvents), [shotEvents]);

	const isAdmin = hasPrivilege(currentUser, Privilege.ManageUsers);
	const canManageSingleShots = isAdmin || hasTeamManagerRole(currentUser) || hasPrivilege(currentUser, Privilege.ManageShots);

	return <div className='Shots'>
		<h1>Panáky</h1>

		{errorMessage && <div className='alert alert-danger'>{errorMessage}</div>}

		<ShotBalancesTable
			players={players}
			shotBalances={shotBalances}
			shotEvents={shotEvents}
			currentUser={currentUser}
			shotTypes={shotTypes}
			canManageSingleShots={canManageSingleShots}
			firebaseApp={props.firebaseApp}
			router={props.router}
			setErrorMessage={setErrorMessage}
		/>
		<ShotTrendChart shotEvents={shotEvents} players={players}/>
		<ShotTypesTable shotTypes={shotTypes}/>
		<ShotEventsTable
			shotEvents={shotEvents}
			users={users}
		/>

		{isAdmin && <ShotAdminSection
			players={players}
			shotTypes={shotTypes}
			currentUser={currentUser}
			firebaseApp={props.firebaseApp}
			router={props.router}
			setErrorMessage={setErrorMessage}
		/>}
	</div>;
};

type ShotTrendChartProps = {
	shotEvents: IShotEvent[];
	players: IUser[];
};

function ShotTrendChart({ shotEvents, players }: ShotTrendChartProps) {
	const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
	const trendChart = useMemo(() => buildShotTrendPoints(shotEvents, players), [shotEvents, players]);
	const selectedPoint = selectedPointIndex !== null
		? trendChart.points[selectedPointIndex] ?? null
		: trendChart.points[trendChart.points.length - 1] ?? null;
	const selectedPlayers = useMemo(() => {
		if (!selectedPoint) {
			return [];
		}
		return [...trendChart.playerIds].sort((userId1, userId2) => {
			const amountDiff = selectedPoint.balancesByUserId[userId2] - selectedPoint.balancesByUserId[userId1];
			if (amountDiff !== 0) {
				return amountDiff;
			}
			return trendChart.playerNamesByUserId[userId1].localeCompare(trendChart.playerNamesByUserId[userId2]);
		});
	}, [selectedPoint, trendChart.playerIds, trendChart.playerNamesByUserId]);
	const chartData = useMemo<ChartData<'line'>>(() => ({
		labels: trendChart.points.map((point) => point.label),
		datasets: trendChart.playerIds.map((userId, index) => ({
			label: trendChart.playerNamesByUserId[userId],
			data: trendChart.points.map((point) => point.balancesByUserId[userId] ?? 0),
			borderColor: getShotChartColor(index),
			backgroundColor: `${getShotChartColor(index)}33`,
			borderWidth: 2,
			fill: false,
			pointRadius: 3,
			pointHoverRadius: 5,
			stepped: 'after' as const,
			tension: 0,
		})),
	}), [trendChart.playerIds, trendChart.playerNamesByUserId, trendChart.points]);
	const chartOptions = useMemo<ChartOptions<'line'>>(() => ({
		responsive: true,
		maintainAspectRatio: false,
		interaction: {
			mode: 'index',
			intersect: false,
		},
		plugins: {
			legend: {
				position: 'bottom',
			},
			tooltip: {
				callbacks: {
					label: (context) => `${context.dataset.label}: ${context.parsed.y} rund`,
				},
			},
		},
		scales: {
			x: {
				title: {
					display: true,
					text: 'Datum',
				},
			},
			y: {
				beginAtZero: true,
				ticks: {
					precision: 0,
				},
				title: {
					display: true,
					text: 'Počet Panáků',
				},
			},
		},
	}), []);

	return <div className='card'>
		<div className='card-header'>Trend Panáků v čase</div>
		<div className='card-body'>
			{trendChart.points.length < 1
				? <p className='mb-0'>Zatím bez dat pro graf.</p>
				: <>
					<p className='text-muted'>
						Každá čára ukazuje průběžný stav Panáků za jednotlivé dny. Najetím zobrazíš detail, kliknutím připneš vybraný den.
					</p>
					<div className='Shots-trendChartWrapper'>
						<Line
							data={chartData}
							options={chartOptions}
							onClick={(_, elements) => setSelectedPointIndex(elements[0]?.index ?? null)}
						/>
					</div>
					{selectedPoint && <div className='Shots-trendSelection'>
						<div className='font-weight-bold mb-2'>Vybraný den: {selectedPoint.label}</div>
						<div className='Shots-trendSelectionGrid'>
							{selectedPlayers.map((userId) => {
								const playerIndex = trendChart.playerIds.indexOf(userId);
								return <div key={userId} className='Shots-trendSelectionItem'>
									<span
										className='Shots-trendSelectionColor'
										style={{ backgroundColor: getShotChartColor(playerIndex) }}
									/>
									<span className='font-weight-bold mr-2'>{trendChart.playerNamesByUserId[userId]}</span>
									<span>{selectedPoint.balancesByUserId[userId] ?? 0} rund</span>
								</div>;
							})}
						</div>
					</div>}
				</>}
		</div>
	</div>;
}

type ShotBalancesTableProps = {
	players: IUser[];
	currentUser: IUser | undefined;
	shotBalances: ReturnType<typeof calculateShotBalances>;
	shotEvents: IShotEvent[];
	shotTypes: IShotType[];
	canManageSingleShots: boolean;
	setErrorMessage: (errorMessage: string | undefined) => void;
} & IFirebaseValue & IRouterValue;

function ShotBalancesTable({
	players,
	shotBalances,
	shotEvents,
	currentUser,
	shotTypes,
	canManageSingleShots,
	firebaseApp,
	router,
	setErrorMessage,
}: ShotBalancesTableProps) {
	const [actionContext, setActionContext] = useState<{ action: ShotAction; player: IUser } | null>(null);
	const [historyPlayer, setHistoryPlayer] = useState<IUser | null>(null);
	const [confirmSettlementDebt, setConfirmSettlementDebt] = useState<IShotEvent | null>(null);
	const [selectedTypeId, setSelectedTypeId] = useState<string>('');
	const [description, setDescription] = useState<string>('');
	const activeShotTypes = shotTypes.filter((shotType) => shotType.active);

	const openAction = (action: ShotAction, player: IUser) => {
		setActionContext({ action, player });
		setSelectedTypeId(activeShotTypes[0]?.id ?? '');
		setDescription('');
	};

	const onSubmitAction = async () => {
		if (!actionContext) {
			return;
		}
		const shotType = activeShotTypes.find((possibleType) => possibleType.id === selectedTypeId);
		if (!shotType) {
			setErrorMessage('Vyber prosím typ Panáku.');
			return;
		}
		try {
			if (actionContext.action === 'debt') {
				await addShotDebtEvent(firebaseApp, {
					userId: actionContext.player.id,
					amount: 1,
					eventAt: new Date(),
					shotTypeId: shotType.id,
					shotTypeName: shotType.name,
					description: description.trim() || undefined,
					createdByUserId: currentUser?.id,
				});
			} else {
				await addShotSettlementEvent(firebaseApp, {
					userId: actionContext.player.id,
					amount: 1,
					eventAt: new Date(),
					shotTypeId: shotType.id,
					shotTypeName: shotType.name,
					description: description.trim() || undefined,
					createdByUserId: currentUser?.id,
				});
			}
			setErrorMessage(undefined);
			setActionContext(null);
			router.refresh();
		} catch (error) {
			console.error(error);
			setErrorMessage(`${error}`);
		}
	};

	const onConfirmSettleDebtRound = async () => {
		if (!confirmSettlementDebt) {
			return;
		}
		if (!confirmSettlementDebt.shotTypeId || !confirmSettlementDebt.shotTypeName) {
			setErrorMessage('Nelze splatit položku bez typu Panáku.');
			return;
		}
		try {
			await addShotSettlementEvent(firebaseApp, {
				userId: confirmSettlementDebt.userId,
				amount: 1,
				eventAt: new Date(),
				shotTypeId: confirmSettlementDebt.shotTypeId,
				shotTypeName: confirmSettlementDebt.shotTypeName,
				createdByUserId: currentUser?.id,
			});
			setConfirmSettlementDebt(null);
			setErrorMessage(undefined);
			router.refresh();
		} catch (error) {
			console.error(error);
			setErrorMessage(`${error}`);
		}
	};

	return <div className='Shots-balances'>
		<h2>Přehled Panáků</h2>
		<table className='table table-light table-bordered table-hover table-striped table-responsive-md'>
			<thead>
				<tr>
					<th>Hráč</th>
					<th>Dluh</th>
					<th>Uhrazeno</th>
					<th>Zůstatek</th>
					<th>Akce</th>
				</tr>
			</thead>
			<tbody>
				{players.length === 0 ? <tr><td colSpan={5}><Loading size='40px'/></td></tr>
					: players.map((player) => {
						const balance = shotBalances[player.id] ?? { debt: 0, settled: 0, balance: 0 };
						return <tr key={player.id} className={classNames({
							'table-warning': currentUser?.id === player.id,
							'table-danger': balance.balance > 0,
							'table-success': balance.balance <= 0 && currentUser?.id !== player.id,
						})}>
							<td>{getUserName(player)}</td>
							<td>{balance.debt} rund</td>
							<td>{balance.settled} rund</td>
							<td className='font-weight-bold'>{balance.balance} rund</td>
							<td className='Shots-actionsCell'>
								{canManageSingleShots && <>
									<button className='btn btn-sm btn-danger mr-2 mb-1' onClick={() => openAction('debt', player)}>Přidat Panák</button>
									<button
										className='btn btn-sm btn-success mr-2 mb-1'
										onClick={() => openAction('settlement', player)}
										disabled={balance.balance <= 0}
									>
										Splatit Panák
									</button>
								</>}
								<button className='btn btn-sm btn-info mb-1 text-white' onClick={() => setHistoryPlayer(player)}>Historie hráče</button>
							</td>
						</tr>;
					})
				}
			</tbody>
		</table>
		<Modal
			title={actionContext?.action === 'debt' ? `Přidat Panák: ${actionContext.player.name}` : `Splatit Panák: ${actionContext?.player.name}`}
			open={Boolean(actionContext)}
			setOpen={(open) => {
				if (!open) {
					setActionContext(null);
				}
			}}
		>
			{actionContext && <div className='Shots-actionModal'>
				<label>Typ Panáku</label>
				<select className='form-control' value={selectedTypeId} onChange={(event) => setSelectedTypeId(event.target.value)}>
					<option value=''>--- vyber typ ---</option>
					{activeShotTypes.map((shotType) => <option key={shotType.id} value={shotType.id}>{shotType.name}</option>)}
				</select>
				<label>Popis</label>
				<textarea className='form-control' rows={4} value={description} onChange={(event) => setDescription(event.target.value)}/>
				<button
					className={classNames('btn mt-3', {
						'btn-danger': actionContext.action === 'debt',
						'btn-success': actionContext.action === 'settlement',
					})}
					onClick={onSubmitAction}
				>
					{actionContext.action === 'debt' ? 'Přidat' : 'Splatit'}
				</button>
			</div>}
		</Modal>
		<PlayerHistoryModal
			player={historyPlayer}
			shotEvents={shotEvents}
			canManageSingleShots={canManageSingleShots}
			setConfirmSettlementDebt={setConfirmSettlementDebt}
			setOpen={(open) => {
				if (!open) {
					setHistoryPlayer(null);
				}
			}}
		/>
		<Modal
			title='Potvrdit splacení 1 rundy'
			open={Boolean(confirmSettlementDebt)}
			setOpen={(open) => {
				if (!open) {
					setConfirmSettlementDebt(null);
				}
			}}
		>
			{confirmSettlementDebt && <div>
				<p>Opravdu chceš splatit 1 rundu?</p>
				<p><strong>Typ:</strong> {confirmSettlementDebt.shotTypeName ?? 'Bez typu'}</p>
				<p><strong>Popis dluhu:</strong> {confirmSettlementDebt.description ?? 'Bez popisu'}</p>
				<button className='btn btn-success' onClick={onConfirmSettleDebtRound}>Ano, splatit 1 rundu</button>
			</div>}
		</Modal>
	</div>;
}

type PlayerHistoryModalProps = {
	player: IUser | null;
	shotEvents: IShotEvent[];
	canManageSingleShots: boolean;
	setConfirmSettlementDebt: (event: IShotEvent | null) => void;
	setOpen: (open: boolean) => void;
};

function PlayerHistoryModal({ player, shotEvents, canManageSingleShots, setConfirmSettlementDebt, setOpen }: PlayerHistoryModalProps) {
	const playerEvents = useMemo(() => {
		if (!player) {
			return [];
		}
		return shotEvents
			.filter((event) => event.userId === player.id)
			.sort((event1, event2) => event2.eventAt.getTime() - event1.eventAt.getTime());
	}, [player, shotEvents]);
	const debtRemainders = useMemo(() => calculateDebtRemainders(playerEvents), [playerEvents]);
	const playerOutstandingDebt = useMemo(() => {
		return playerEvents
			.filter((event) => event.type === ShotEventType.Debt)
			.reduce((sum, event) => sum + (debtRemainders[event.id] ?? event.amount), 0);
	}, [playerEvents, debtRemainders]);
	const canSettleAnyDebt = canManageSingleShots && playerOutstandingDebt > 0;

	return <Modal
		title={player ? `Historie hráče: ${getUserName(player)}` : 'Historie hráče'}
		open={Boolean(player)}
		setOpen={setOpen}
	>
		<div className='table-responsive'>
			<table className='table table-light table-bordered table-hover table-striped table-responsive-md'>
				<thead>
					<tr>
						<th>Datum</th>
						<th>Druh</th>
						<th>Typ</th>
						<th>Změna</th>
						<th>Stav</th>
						<th>Popis</th>
						{canSettleAnyDebt && <th>Akce</th>}
					</tr>
				</thead>
				<tbody>
					{playerEvents.length < 1
						? <tr><td colSpan={canSettleAnyDebt ? 7 : 6}>Zatím bez záznamu.</td></tr>
						: playerEvents.map((event) => {
							const remainingDebt = event.type === ShotEventType.Debt ? (debtRemainders[event.id] ?? event.amount) : 0;
							const isUnpaidDebt = event.type === ShotEventType.Debt && remainingDebt > 0;
							return <tr key={event.id} className={classNames({
								'table-danger': isUnpaidDebt,
								'Shots-playerHistoryRowTransparent': !isUnpaidDebt,
							})}>
								<td><FormattedDateTime startsAt={event.eventAt}/></td>
								<td>{event.type === ShotEventType.Debt ? 'Dluh' : 'Uhrazení'}</td>
								<td>{event.shotTypeName ?? 'Bez typu'}</td>
								<td className='font-weight-bold'>{event.type === ShotEventType.Debt ? '+' : '-'}{event.amount} rund</td>
								<td>
									{event.type === ShotEventType.Debt
										? remainingDebt > 0 ? `Nezaplaceno (${remainingDebt})` : 'Splaceno'
										: 'Uhrazeno'}
								</td>
								<td>{event.description ?? <small>Bez popisu</small>}</td>
								{canSettleAnyDebt && <td>
									{isUnpaidDebt
										? <button className='btn btn-sm btn-success' onClick={() => setConfirmSettlementDebt(event)}>Splatit 1 rundu</button>
										: null}
								</td>}
							</tr>;
						})
					}
				</tbody>
			</table>
		</div>
	</Modal>;
}

type ShotTypesTableProps = {
	shotTypes: IShotType[];
};

function ShotTypesTable({ shotTypes }: ShotTypesTableProps) {
	return <div className='Shots-types'>
		<h2>Typy Panáků</h2>
		<table className='table table-light table-bordered table-hover table-striped table-responsive-md'>
			<thead>
				<tr>
					<th>Název</th>
					<th>Výchozí počet rund</th>
					<th>Popis</th>
					<th>Stav</th>
				</tr>
			</thead>
			<tbody>
				{shotTypes.length < 1
					? <tr><td colSpan={4}>Zatím bez typů.</td></tr>
					: shotTypes.map((shotType) => <tr key={shotType.id}>
						<td>{shotType.name}</td>
						<td>{shotType.defaultAmount}</td>
						<td>{shotType.description ?? <small>Bez popisu</small>}</td>
						<td>{shotType.active ? 'Aktivní' : 'Neaktivní'}</td>
					</tr>)
				}
			</tbody>
		</table>
	</div>;
}

type ShotEventsTableProps = {
	shotEvents: IShotEvent[];
	users: IUser[] | undefined;
};

function ShotEventsTable({ shotEvents, users }: ShotEventsTableProps) {
	const [expandedDescriptions, setExpandedDescriptions] = useState<{ [eventId: string]: boolean }>({});
	const [historyExpanded, setHistoryExpanded] = useState(false);

	const getPlayerName = (userId: string) => {
		const user = users?.find((possibleUser) => possibleUser.id === userId);
		return user ? getUserName(user) : userId;
	};

	return <div className='Shots-events'>
		<div className='d-flex align-items-center justify-content-between mb-2'>
			<h2 className='mb-0'>Historie Panáků</h2>
			<button className='btn btn-sm btn-outline-primary' onClick={() => setHistoryExpanded((value) => !value)}>
				{historyExpanded ? 'Skrýt historii' : 'Zobrazit historii'}
			</button>
		</div>
		{historyExpanded && <table className='table table-light table-bordered table-hover table-striped table-responsive-md'>
			<thead>
				<tr>
					<th>Datum</th>
					<th>Hráč</th>
					<th>Druh</th>
					<th>Typ</th>
					<th>Změna</th>
					<th>Popis</th>
				</tr>
			</thead>
			<tbody>
				{shotEvents.length < 1
					? <tr><td colSpan={6}>Zatím bez záznamu.</td></tr>
					: shotEvents.map((event) => <tr key={event.id} className={classNames({
						'table-danger': event.type === ShotEventType.Debt,
						'table-success': event.type === ShotEventType.Settlement,
					})}>
						<td><FormattedDateTime startsAt={event.eventAt}/></td>
						<td>{getPlayerName(event.userId)}</td>
						<td>{event.type === ShotEventType.Debt ? 'Dluh' : 'Uhrazení'}</td>
						<td>{event.type === ShotEventType.Debt ? (event.shotTypeName ?? 'Bez typu') : (event.shotTypeName ?? 'Uhrazení Panáků')}</td>
						<td className='font-weight-bold'>
							{event.type === ShotEventType.Debt ? '+' : '-'}{event.amount} rund
						</td>
						<td>
							{event.description ? (
								event.description.length <= LONG_DESCRIPTION_LENGTH || expandedDescriptions[event.id]
									? <>
										{event.description}
										{event.description.length > LONG_DESCRIPTION_LENGTH && <button
											className='btn btn-link btn-sm ml-2 p-0 align-baseline'
											onClick={() => setExpandedDescriptions((currentState) => ({ ...currentState, [event.id]: false }))}
										>
											skrýt
										</button>}
									</>
									: <>
										{event.description.slice(0, LONG_DESCRIPTION_LENGTH)}...
										<button
											className='btn btn-link btn-sm ml-2 p-0 align-baseline'
											onClick={() => setExpandedDescriptions((currentState) => ({ ...currentState, [event.id]: true }))}
										>
											zobrazit celý popis
										</button>
									</>
							) : <small>Bez popisu</small>}
						</td>
					</tr>)
				}
			</tbody>
		</table>}
	</div>;
}

type ShotAdminSectionProps = {
	players: IUser[];
	shotTypes: IShotType[];
	currentUser: IUser | undefined;
	setErrorMessage: (errorMessage: string | undefined) => void;
} & IFirebaseValue & IRouterValue;

function ShotAdminSection({ players, shotTypes, currentUser, firebaseApp, router, setErrorMessage }: ShotAdminSectionProps) {
	const [newTypeName, setNewTypeName] = useState('');
	const [newTypeDescription, setNewTypeDescription] = useState('');
	const [newTypeAmount, setNewTypeAmount] = useState(1);
	const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
	const [editingTypeName, setEditingTypeName] = useState('');
	const [editingTypeDescription, setEditingTypeDescription] = useState('');
	const [editingTypeAmount, setEditingTypeAmount] = useState(1);
	const [importRows, setImportRows] = useState('');

	const onAddType = async () => {
		try {
			if (!newTypeName.trim() || newTypeAmount <= 0) {
				setErrorMessage('Vyplň prosím název typu a kladný počet rund.');
				return;
			}
			await addShotType(firebaseApp, {
				name: newTypeName.trim(),
				description: newTypeDescription.trim() || undefined,
				defaultAmount: newTypeAmount,
			});
			setErrorMessage(undefined);
			router.refresh();
		} catch (error) {
			console.error(error);
			setErrorMessage(`${error}`);
		}
	};

	const onPrepareTypeEdit = (shotType: IShotType) => {
		setEditingTypeId(shotType.id);
		setEditingTypeName(shotType.name);
		setEditingTypeDescription(shotType.description ?? '');
		setEditingTypeAmount(shotType.defaultAmount);
	};

	const onSaveTypeEdit = async () => {
		try {
			if (!editingTypeId || !editingTypeName.trim() || editingTypeAmount <= 0) {
				setErrorMessage('Vyplň prosím validní data typu.');
				return;
			}
			await updateShotType(firebaseApp, editingTypeId, {
				name: editingTypeName.trim(),
				description: editingTypeDescription.trim() || undefined,
				defaultAmount: editingTypeAmount,
			});
			setErrorMessage(undefined);
			router.refresh();
		} catch (error) {
			console.error(error);
			setErrorMessage(`${error}`);
		}
	};

	const onToggleTypeState = async (shotType: IShotType) => {
		try {
			await updateShotType(firebaseApp, shotType.id, { active: !shotType.active });
			setErrorMessage(undefined);
			router.refresh();
		} catch (error) {
			console.error(error);
			setErrorMessage(`${error}`);
		}
	};

	const createDate = (dateValue: string) => {
		const parsedDate = new Date(`${dateValue}T12:00:00`);
		if (Number.isNaN(parsedDate.valueOf())) {
			return null;
		}
		return parsedDate;
	};

	const parseImportRows = () => {
		const lines = importRows.split('\n').map((line) => line.trim()).filter(Boolean);
		const usersByKey: { [key: string]: IUser } = {};
		for (const user of players) {
			usersByKey[user.id.toLowerCase()] = user;
			usersByKey[getUserName(user).toLowerCase()] = user;
			usersByKey[user.email.toLowerCase()] = user;
		}

		const typeByKey: { [key: string]: IShotType } = {};
		for (const shotType of shotTypes) {
			typeByKey[shotType.id.toLowerCase()] = shotType;
			typeByKey[shotType.name.toLowerCase()] = shotType;
		}

		return lines.map((line, index) => {
			const [dateRaw, playerRaw, typeRaw, amountRaw, ...descriptionParts] = line.split(';').map((value) => value.trim());
			if (!dateRaw || !playerRaw || !typeRaw || !amountRaw) {
				throw new Error(`Řádek ${index + 1}: očekávám formát datum;hráč;typ;počet;popis`);
			}
			const user = usersByKey[playerRaw.toLowerCase()];
			if (!user) {
				throw new Error(`Řádek ${index + 1}: neznámý hráč "${playerRaw}"`);
			}
			const shotType = typeByKey[typeRaw.toLowerCase()];
			const amount = parseInt(amountRaw);
			if (Number.isNaN(amount) || amount === 0) {
				throw new Error(`Řádek ${index + 1}: neplatný počet "${amountRaw}"`);
			}
			const eventAt = createDate(dateRaw);
			if (!eventAt) {
				throw new Error(`Řádek ${index + 1}: neplatné datum "${dateRaw}"`);
			}
			if (amount > 0 && !shotType) {
				throw new Error(`Řádek ${index + 1}: neznámý typ "${typeRaw}"`);
			}
			return {
				userId: user.id,
				amount,
				eventAt,
				shotTypeId: shotType?.id ?? '',
				shotTypeName: shotType?.name ?? '',
				description: descriptionParts.join(';').trim() || undefined,
				createdByUserId: currentUser?.id,
			};
		});
	};

	const onImport = async () => {
		try {
			const events = parseImportRows();
			if (events.length < 1) {
				setErrorMessage('Není co importovat.');
				return;
			}
			await importShotEvents(firebaseApp, events);
			setErrorMessage(undefined);
			router.refresh();
		} catch (error) {
			console.error(error);
			setErrorMessage(`${error}`);
		}
	};

	return <div className='Shots-admin'>
		<h2>Administrace Panáků</h2>
		<div className='card mb-3'>
			<div className='card-header'>Typy Panáků</div>
			<div className='card-body'>
				<div className='table-responsive'>
					<table className='table table-light table-bordered table-striped'>
						<thead>
							<tr>
								<th>Název</th>
								<th>Výchozí počet rund</th>
								<th>Popis</th>
								<th>Stav</th>
								<th>Akce</th>
							</tr>
						</thead>
						<tbody>
							{shotTypes.map((shotType) => <tr key={shotType.id}>
								<td>{shotType.name}</td>
								<td>{shotType.defaultAmount}</td>
								<td>{shotType.description}</td>
								<td>{shotType.active ? 'Aktivní' : 'Neaktivní'}</td>
								<td>
									<button className='btn btn-sm btn-outline-primary mr-2' onClick={() => onPrepareTypeEdit(shotType)}>Upravit</button>
									<button className='btn btn-sm btn-outline-secondary' onClick={() => onToggleTypeState(shotType)}>
										{shotType.active ? 'Deaktivovat' : 'Aktivovat'}
									</button>
								</td>
							</tr>)}
						</tbody>
					</table>
				</div>
				<div className='Shots-formGrid'>
					<div>
						<h5>Přidat typ</h5>
						<label>Název</label>
						<input className='form-control' value={newTypeName} onChange={(event) => setNewTypeName(event.target.value)}/>
						<label>Výchozí počet rund</label>
						<input type='number' min={1} className='form-control' value={newTypeAmount} onChange={(event) => setNewTypeAmount(parseInt(event.target.value))}/>
						<label>Popis</label>
						<textarea className='form-control' value={newTypeDescription} onChange={(event) => setNewTypeDescription(event.target.value)} rows={2}/>
						<button className='btn btn-primary mt-2' onClick={onAddType}>Přidat typ</button>
					</div>
					<div>
						<h5>Upravit typ</h5>
						<label>Název</label>
						<input className='form-control' value={editingTypeName} onChange={(event) => setEditingTypeName(event.target.value)} disabled={!editingTypeId}/>
						<label>Výchozí počet rund</label>
						<input type='number' min={1} className='form-control' value={editingTypeAmount} onChange={(event) => setEditingTypeAmount(parseInt(event.target.value))} disabled={!editingTypeId}/>
						<label>Popis</label>
						<textarea className='form-control' value={editingTypeDescription} onChange={(event) => setEditingTypeDescription(event.target.value)} rows={2} disabled={!editingTypeId}/>
						<button className='btn btn-primary mt-2' onClick={onSaveTypeEdit} disabled={!editingTypeId}>Uložit změny typu</button>
					</div>
				</div>
			</div>
		</div>
		<div className='card'>
			<div className='card-header'>Import historických dluhů/uhrazení Panáků</div>
			<div className='card-body'>
				<p>Formát řádku: <code>YYYY-MM-DD;hráč;typ;počet;popis</code></p>
				<p>Hráč může být ID, jméno nebo e-mail. Typ může být ID nebo název.</p>
				<p>Kladný počet = dluh, záporný počet (např. <code>-1</code>) = uhrazení.</p>
				<textarea
					className='form-control'
					rows={8}
					value={importRows}
					onChange={(event) => setImportRows(event.target.value)}
					placeholder='2026-08-01;Jan Novák;Hatrik;1;Krásný hattrick'
				/>
				<button className='btn btn-warning mt-2' onClick={onImport}>Importovat historické záznamy</button>
			</div>
		</div>
	</div>;
}

export default withFirebase(withAuth(withRouter(Shots)));
