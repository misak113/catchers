import React, { useMemo, useState } from 'react';
import classNames from 'classnames';
import { IAuthValue, withAuth } from '../Context/AuthContext';
import { IFirebaseValue, withFirebase } from '../Context/FirebaseContext';
import { IRouterValue, withRouter } from '../Context/RouterContext';
import Loading from '../Components/Loading';
import { Modal } from '../Components/Modal/Modal';
import FormattedDateTime from '../Components/Util/FormattedDateTime';
import { formatDate } from '../Util/datetime';
import { IUser, Privilege } from '../Model/collections';
import { getUserName, hasPrivilege, useAllUsers, useCurrentUser } from '../Model/userFacade';
import {
	ShotEventType,
	IShotEvent,
	IShotType,
	addShotDebtEvent,
	addShotSettlementEvent,
	addShotType,
	calculateShotBalances,
	importShotDebtEvents,
	updateShotType,
	useShotEvents,
	useShotTypes,
} from '../Model/shotsFacade';
import './Shots.css';

type IProps = IAuthValue & IFirebaseValue & IRouterValue;

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

	const canManageShots = hasPrivilege(currentUser, Privilege.ManageShots);
	const isAdmin = hasPrivilege(currentUser, Privilege.ManageUsers);

	return <div className='Shots'>
		<h1>Panáky</h1>

		{errorMessage && <div className='alert alert-danger'>{errorMessage}</div>}

		<ShotBalancesTable
			players={players}
			shotBalances={shotBalances}
			currentUser={currentUser}
		/>
		<ShotEventsTable
			shotEvents={shotEvents}
			users={users}
		/>

		{canManageShots && <ShotMaintainerSection
			players={players}
			shotTypes={shotTypes}
			currentUser={currentUser}
			firebaseApp={props.firebaseApp}
			router={props.router}
			setErrorMessage={setErrorMessage}
		/>}
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

type ShotBalancesTableProps = {
	players: IUser[];
	currentUser: IUser | undefined;
	shotBalances: ReturnType<typeof calculateShotBalances>;
};

function ShotBalancesTable({ players, shotBalances, currentUser }: ShotBalancesTableProps) {
	return <div className='Shots-balances'>
		<h2>Přehled Panáků</h2>
		<table className='table table-light table-bordered table-hover table-striped table-responsive-md'>
			<thead>
				<tr>
					<th>Hráč</th>
					<th>Dluh</th>
					<th>Uhrazeno</th>
					<th>Zůstatek</th>
				</tr>
			</thead>
			<tbody>
				{players.length === 0
					? <tr><td colSpan={4}><Loading size='40px'/></td></tr>
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
						</tr>;
					})
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
	const [eventForDescription, setEventForDescription] = useState<IShotEvent | null>(null);

	const getPlayerName = (userId: string) => {
		const user = users?.find((possibleUser) => possibleUser.id === userId);
		return user ? getUserName(user) : userId;
	};

	return <div className='Shots-events'>
		<h2>Historie Panáků</h2>
		<table className='table table-light table-bordered table-hover table-striped table-responsive-md'>
			<thead>
				<tr>
					<th>Datum</th>
					<th>Hráč</th>
					<th>Druh</th>
					<th>Typ</th>
					<th>Změna</th>
					<th>Detail</th>
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
						<td>{event.type === ShotEventType.Debt ? (event.shotTypeName ?? 'Bez typu') : 'Uhrazení Panáků'}</td>
						<td className='font-weight-bold'>
							{event.type === ShotEventType.Debt ? '+' : '-'}{event.amount} rund
						</td>
						<td>
							{event.description
								? <button className='btn btn-sm btn-outline-dark' onClick={() => setEventForDescription(event)}>Zobrazit</button>
								: <small>Bez popisu</small>}
						</td>
					</tr>)
				}
			</tbody>
		</table>
		<Modal title='Detail události Panáků' open={Boolean(eventForDescription)} setOpen={() => setEventForDescription(null)}>
			{eventForDescription && <>
				<div><strong>Typ:</strong> {eventForDescription.shotTypeName ?? 'Uhrazení Panáků'}</div>
				<div className='Shots-description'>{eventForDescription.description}</div>
			</>}
		</Modal>
	</div>;
}

type ShotMaintainerSectionProps = {
	players: IUser[];
	shotTypes: IShotType[];
	currentUser: IUser | undefined;
	setErrorMessage: (errorMessage: string | undefined) => void;
} & IFirebaseValue & IRouterValue;

function ShotMaintainerSection({ players, shotTypes, currentUser, firebaseApp, router, setErrorMessage }: ShotMaintainerSectionProps) {
	const [selectedDebtUserId, setSelectedDebtUserId] = useState<string>('');
	const [selectedDebtTypeId, setSelectedDebtTypeId] = useState<string>('');
	const [debtAmount, setDebtAmount] = useState<number>(1);
	const [debtDate, setDebtDate] = useState<string>(formatDate(new Date()));
	const [debtDescription, setDebtDescription] = useState<string>('');
	const [selectedSettlementUserId, setSelectedSettlementUserId] = useState<string>('');
	const [settlementAmount, setSettlementAmount] = useState<number>(1);
	const [settlementDate, setSettlementDate] = useState<string>(formatDate(new Date()));
	const [settlementDescription, setSettlementDescription] = useState<string>('');

	const activeShotTypes = shotTypes.filter((shotType) => shotType.active);

	const onDebtTypeChange = (newTypeId: string) => {
		setSelectedDebtTypeId(newTypeId);
		const selectedType = activeShotTypes.find((shotType) => shotType.id === newTypeId);
		if (selectedType) {
			setDebtAmount(selectedType.defaultAmount);
		}
	};

	const createDate = (dateValue: string) => {
		const parsedDate = new Date(`${dateValue}T12:00:00`);
		if (Number.isNaN(parsedDate.valueOf())) {
			return null;
		}
		return parsedDate;
	};

	const onAddDebt = async () => {
		try {
			const shotType = activeShotTypes.find((possibleType) => possibleType.id === selectedDebtTypeId);
			if (!selectedDebtUserId || !shotType || debtAmount <= 0) {
				setErrorMessage('Vyplň prosím hráče, typ a kladný počet rund.');
				return;
			}
			const eventAt = createDate(debtDate);
			if (!eventAt) {
				setErrorMessage('Neplatné datum dluhu.');
				return;
			}
			await addShotDebtEvent(firebaseApp, {
				userId: selectedDebtUserId,
				amount: debtAmount,
				shotTypeId: shotType.id,
				shotTypeName: shotType.name,
				description: debtDescription.trim() || undefined,
				eventAt,
				createdByUserId: currentUser?.id,
			});
			setErrorMessage(undefined);
			router.refresh();
		} catch (error) {
			console.error(error);
			setErrorMessage(`${error}`);
		}
	};

	const onAddSettlement = async () => {
		try {
			if (!selectedSettlementUserId || settlementAmount <= 0) {
				setErrorMessage('Vyplň prosím hráče a kladný počet rund.');
				return;
			}
			const eventAt = createDate(settlementDate);
			if (!eventAt) {
				setErrorMessage('Neplatné datum uhrazení.');
				return;
			}
			await addShotSettlementEvent(firebaseApp, {
				userId: selectedSettlementUserId,
				amount: settlementAmount,
				description: settlementDescription.trim() || undefined,
				eventAt,
				createdByUserId: currentUser?.id,
			});
			setErrorMessage(undefined);
			router.refresh();
		} catch (error) {
			console.error(error);
			setErrorMessage(`${error}`);
		}
	};

	return <div className='Shots-maintainer'>
		<h2>Správa Panáků (maintainer)</h2>
		<div className='Shots-formGrid'>
			<div className='card'>
				<div className='card-header'>Přidat dluh</div>
				<div className='card-body'>
					<label>Hráč</label>
					<select className='form-control' value={selectedDebtUserId} onChange={(event) => setSelectedDebtUserId(event.target.value)}>
						<option value=''>--- vyber hráče ---</option>
						{players.map((player) => <option key={player.id} value={player.id}>{getUserName(player)}</option>)}
					</select>
					<label>Typ Panáku</label>
					<select className='form-control' value={selectedDebtTypeId} onChange={(event) => onDebtTypeChange(event.target.value)}>
						<option value=''>--- vyber typ ---</option>
						{activeShotTypes.map((shotType) => <option key={shotType.id} value={shotType.id}>{shotType.name}</option>)}
					</select>
					<label>Počet rund</label>
					<input type='number' min={1} className='form-control' value={debtAmount} onChange={(event) => setDebtAmount(parseInt(event.target.value))}/>
					<label>Datum</label>
					<input type='date' className='form-control' value={debtDate} onChange={(event) => setDebtDate(event.target.value)}/>
					<label>Popis</label>
					<textarea className='form-control' value={debtDescription} onChange={(event) => setDebtDescription(event.target.value)} rows={3}/>
					<button className='btn btn-danger mt-3' onClick={onAddDebt}>Přidat dluh Panáků</button>
				</div>
			</div>
			<div className='card'>
				<div className='card-header'>Označit uhrazení</div>
				<div className='card-body'>
					<label>Hráč</label>
					<select className='form-control' value={selectedSettlementUserId} onChange={(event) => setSelectedSettlementUserId(event.target.value)}>
						<option value=''>--- vyber hráče ---</option>
						{players.map((player) => <option key={player.id} value={player.id}>{getUserName(player)}</option>)}
					</select>
					<label>Počet rund</label>
					<input type='number' min={1} className='form-control' value={settlementAmount} onChange={(event) => setSettlementAmount(parseInt(event.target.value))}/>
					<label>Datum</label>
					<input type='date' className='form-control' value={settlementDate} onChange={(event) => setSettlementDate(event.target.value)}/>
					<label>Popis</label>
					<textarea className='form-control' value={settlementDescription} onChange={(event) => setSettlementDescription(event.target.value)} rows={3}/>
					<button className='btn btn-success mt-3' onClick={onAddSettlement}>Označit uhrazení Panáků</button>
				</div>
			</div>
		</div>
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
			if (!shotType) {
				throw new Error(`Řádek ${index + 1}: neznámý typ "${typeRaw}"`);
			}
			const amount = parseInt(amountRaw);
			if (Number.isNaN(amount) || amount <= 0) {
				throw new Error(`Řádek ${index + 1}: neplatný počet "${amountRaw}"`);
			}
			const eventAt = createDate(dateRaw);
			if (!eventAt) {
				throw new Error(`Řádek ${index + 1}: neplatné datum "${dateRaw}"`);
			}
			return {
				userId: user.id,
				amount,
				eventAt,
				shotTypeId: shotType.id,
				shotTypeName: shotType.name,
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
			await importShotDebtEvents(firebaseApp, events);
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
			<div className='card-header'>Import historických dluhů Panáků</div>
			<div className='card-body'>
				<p>Formát řádku: <code>YYYY-MM-DD;hráč;typ;počet;popis</code></p>
				<p>Hráč může být ID, jméno nebo e-mail. Typ může být ID nebo název.</p>
				<textarea
					className='form-control'
					rows={8}
					value={importRows}
					onChange={(event) => setImportRows(event.target.value)}
					placeholder='2026-08-01;Jan Novák;3 góly v zápase;1;Krásný hattrick'
				/>
				<button className='btn btn-warning mt-2' onClick={onImport}>Importovat historické dluhy</button>
			</div>
		</div>
	</div>;
}

export default withFirebase(withAuth(withRouter(Shots)));
