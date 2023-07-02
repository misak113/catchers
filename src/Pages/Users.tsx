import React, { useState } from 'react';
import classNames from 'classnames';
import { IFirebaseValue, withFirebase } from '../Context/FirebaseContext';
import { IAuthValue, withAuth } from '../Context/AuthContext';
import { IUser, Ordered, PlayerPosition, Privilege, TeamRole } from '../Model/collections';
import { PlayerPositionMap, TeamRoleMap, addUserPlayerPosition, addUserTeamRole, hasPrivilege, removeUserPlayerPosition, removeUserTeamRole, setUserDressNumber, setUserPSMFNumber, useAllUsers, useCurrentUser } from '../Model/userFacade';
import Loading from '../Components/Loading';
import './Users.css';
import { IRouterValue, withRouter } from '../Context/RouterContext';

interface IProps {}

export const Users: React.FC<IProps & IFirebaseValue & IAuthValue & IRouterValue> = (props: IProps & IFirebaseValue & IAuthValue & IRouterValue) => {
	const [errorMessage, setErrorMessage] = useState<string>();
	const [currentUser] = useCurrentUser(props.firebaseApp, props.auth.user, setErrorMessage);
	const [users] = useAllUsers(props.firebaseApp, setErrorMessage);
	const [editEnabled, setEditEnabled] = useState<boolean>(false);

	const sortedUsers = users && [...users].sort((a, b) => (Number(b.player) - Number(a.player)) * 1e6 + (a.name || '').localeCompare(b.name ?? ''));
	return <div className='Users'>
		<h1>Hráči</h1>

		{hasPrivilege(currentUser, Privilege.ManageUsers) && <Toggle
			name='Editace'
			value={editEnabled}
			setValue={setEditEnabled}
		/>}

		<UsersTable
			users={sortedUsers}
			errorMessage={errorMessage}
			currentUser={currentUser}
			firebaseApp={props.firebaseApp}
			router={props.router}
			editEnabled={editEnabled}
		/>
	</div>;
};
export default withFirebase(withAuth(withRouter(Users)));

interface ToggleProps {
	name: string;
	value: boolean;
	setValue: (value: boolean) => void;
}

function Toggle({ name, value, setValue }: ToggleProps) {
	return <div className="custom-control custom-switch">
		<div className="custom-control custom-checkbox custom-control-inline">
			<input type="checkbox" id={name} name={name} className="custom-control-input" checked={value} onChange={() => setValue(!value)}/>
			<label className="custom-control-label" htmlFor={name}>{name}</label>
		</div>
	</div>;
}

interface IUsersTableProps {
	users: IUser[] | undefined;
	errorMessage?: string;
	currentUser: IUser | undefined;
	editEnabled: boolean;
}

function UsersTable({ users, editEnabled, errorMessage, currentUser, firebaseApp, router }: IUsersTableProps & IFirebaseValue & IRouterValue) {
	return <table className="table table-light table-bordered table-hover table-striped table-responsive-md">
		<thead>
			<tr>
				<th>Jméno</th>
				<th>e-mail</th>
				<th>Číslo</th>
				<th>Registračka</th>
				<th>Aktivní</th>
				<th>Pozice</th>
				<th>Role</th>
			</tr>
		</thead>
		<tbody>
			{errorMessage
			? <tr><td colSpan={6}>{errorMessage}</td></tr>
			: users
				? users.map((user) => <UserRow
					key={user.id}
					user={user}
					editEnabled={editEnabled}
					currentUser={currentUser}
					firebaseApp={firebaseApp}
					router={router}
				/>)
				: <tr><td colSpan={6}><Loading size='50px'/></td></tr>}
		</tbody>
	</table>;
}

interface UserRowProps {
	user: IUser;
	editEnabled: boolean;
	currentUser: IUser | undefined;
}

function UserRow({ user, editEnabled, currentUser, firebaseApp, router }: UserRowProps & IFirebaseValue & IRouterValue) {
	const createRemoveRole = (role: Ordered<TeamRole>) => async () => {
		await removeUserTeamRole(firebaseApp, user, role);
		router.refresh();
	};
	const createRemovePosition = (position: Ordered<PlayerPosition>) => async () => {
		await removeUserPlayerPosition(firebaseApp, user, position);
		router.refresh();
	};
	const createAddRole = (user: IUser) => async (name: TeamRole, order: number) => {
		await addUserTeamRole(firebaseApp, user, { name, order });
		router.refresh();
	};
	const createAddPosition = (user: IUser) => async (name: PlayerPosition, order: number) => {
		await addUserPlayerPosition(firebaseApp, user, { name, order });
		router.refresh();
	};
	const createSetUserDressNumber = (user: IUser) => async (value: number) => {
		await setUserDressNumber(firebaseApp, user, value);
		router.refresh();
	};
	const createSetPSMFNumberNumber = (user: IUser) => async (value: number) => {
		await setUserPSMFNumber(firebaseApp, user, value);
		router.refresh();
	};

	const showEdit = editEnabled && hasPrivilege(currentUser, Privilege.ManageUsers);

	const roles = user.teamRoles ?? [];
	const positions = user.playerPositions ?? [];
	return <tr className={classNames({
		'table-dark': !user.player,
	})}>
		<td>{user.name}</td>
		<td>{user.email}</td>
		<td>
			{!showEdit
				? user.dressNumber
				: <NumberForm
					defaultValue={user.dressNumber}
					saveValue={createSetUserDressNumber(user)}
				/>
			}
		</td>
		<td>
			{!showEdit
				? user.psmfNumber
				: <NumberForm
					defaultValue={user.psmfNumber}
					saveValue={createSetPSMFNumberNumber(user)}
				/>
			}
		</td>
		<td>{user.player ? 'Ano' : 'Ne'}</td>
		<td>
			{positions.map((item, index) => (
				<span key={item.order + '-' + index} className={classNames("badge", {
					"badge-primary": item.order === 0,
					"badge-secondary": item.order !== 0,
				})}>{item.order > 0 ? (item.order + 1) + ' ' : ''}
					{PlayerPositionMap[item.name]}
					{showEdit
						? <button onClick={createRemovePosition(item)} className="close">&times;</button>
						: null}
				</span>
			))}
			{showEdit
				? <AddForm<PlayerPosition>
					label='pozice'
					values={PlayerPositionMap}
					defaultOrder={positions.reduce((sum, { order }) => order > sum ? order : sum, 0) + 1}
					onSubmit={createAddPosition(user)}
				/>
				: null}
		</td>
		<td>
			{user.teamRoles?.map((item, index) => (
				<span key={item.order + '-' + index} className={classNames("badge", {
					"badge-success": item.order === 0,
					"badge-secondary": item.order !== 0,
				})}>{item.order > 0 ? (item.order + 1) + ' ' : ''}
					{TeamRoleMap[item.name]}
					{showEdit
						? <button onClick={createRemoveRole(item)} className="close">&times;</button>
						: null}
				</span>
			))}
			{showEdit
				? <AddForm<TeamRole>
					label='role'
					values={TeamRoleMap}
					defaultOrder={roles.reduce((sum, { order }) => order > sum ? order : sum, 0) + 1}
					onSubmit={createAddRole(user)}
				/>
				: null}
		</td>
	</tr>;
}

interface NumberFormProps {
	defaultValue: number | undefined;
	saveValue: (value: number) => void;
}

function NumberForm({ defaultValue, saveValue }: NumberFormProps) {
	const [value, setValue] = useState<number | undefined>(defaultValue);
	return <>
		<input
			type="number"
			className="form-control form-control-sm"
			value={value}
			onChange={(event) => setValue(parseInt(event.target.value))}
		/>
		<button
			className="btn btn-sm btn-secondary"
			disabled={value === undefined}
			onClick={() => value && saveValue(value)}
		>Uložit</button>
	</>;
}

type AddFormProps<T extends string> = {
	label: string;
	defaultOrder?: number;
	values: { [key in T]: string };
	onSubmit: (name: T, order: number) => void;
};

function AddForm<T extends string>({ label, values, defaultOrder, onSubmit }: AddFormProps<T>) {
	const [name, setName] = useState<T | undefined>(undefined);
	const [order, setOrder] = useState<number>(defaultOrder ?? 0);
	const entries = Object.entries<string>(values);
	return <form className="form-inline form-group">
		<input type="number" className="col-sm-2 form-control form-control-sm" value={order} onChange={(event) => setOrder(parseInt(event.target.value))}/>
		<select className="col-sm-6 form-control form-control-sm" value={name} onChange={(event) => {
			const newName = event.target.value as T;
			setName(newName);
			onSubmit(newName, order);
		}}>
			<option value={undefined}>--- {label} ---</option>
			{entries.map(([key, value]) => <option key={key} value={key}>{value}</option>)}
		</select>
	</form>;
}
