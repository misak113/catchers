import React, { useState } from 'react';
import classNames from 'classnames';
import { IFirebaseValue, withFirebase } from '../Context/FirebaseContext';
import { IAuthValue, withAuth } from '../Context/AuthContext';
import { IUser } from '../Model/collections';
import { PlayerPositionMap, TeamRoleMap, useAllUsers, useCurrentUser } from '../Model/userFacade';
import Loading from '../Components/Loading';
import './Users.css';

interface IProps {}

export const Users: React.FC<IProps & IFirebaseValue & IAuthValue> = (props: IProps & IFirebaseValue & IAuthValue) => {
	const [errorMessage, setErrorMessage] = useState<string>();
	const [currentUser] = useCurrentUser(props.firebaseApp, props.auth.user, setErrorMessage);
	const [users] = useAllUsers(props.firebaseApp, setErrorMessage);

	const sortedUsers = users && [...users].sort((a, b) => (Number(b.player) - Number(a.player)) * 1e6 + (a.name || '').localeCompare(b.name ?? ''));
	return <div className='Users'>
		<h1>Hráči</h1>

		<UsersTable users={sortedUsers} errorMessage={errorMessage} currentUser={currentUser}/>
	</div>;
};
export default withFirebase(withAuth(Users));

interface IUsersTableProps {
	users: IUser[] | undefined;
	errorMessage?: string;
	currentUser: IUser | undefined;
}

function UsersTable({ users, errorMessage, currentUser }: IUsersTableProps) {
	return <table className="table table-light table-bordered table-hover table-striped table-responsive-md">
		<thead>
			<tr>
				<th>Jméno</th>
				<th>e-mail</th>
				<th>Hráč</th>
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
					currentUser={currentUser}
				/>)
				: <tr><td colSpan={6}><Loading size='50px'/></td></tr>}
		</tbody>
	</table>;
}

interface UserRowProps {
	user: IUser;
	currentUser: IUser | undefined;
}

function UserRow({ user }: UserRowProps) {
	return <tr className={classNames({
		'table-dark': !user.player,
	})}>
		<td>{user.name}</td>
		<td>{user.email}</td>
		<td>{user.player ? 'Ano' : 'Ne'}</td>
		<td>
			{user.playerPositions?.map((item) => (
				<span className={classNames("badge", {
					"badge-primary": item.order === 0,
					"badge-secondary": item.order !== 0,
				})}>{item.order > 0 ? (item.order + 1) + ' ' : ''}{PlayerPositionMap[item.name]}</span>
			))}
		</td>
		<td>
			{user.teamRoles?.map((item) => (
				<span className={classNames("badge", {
					"badge-success": item.order === 0,
					"badge-secondary": item.order !== 0,
				})}>{item.order > 0 ? (item.order + 1) + ' ' : ''}{TeamRoleMap[item.name]}</span>
			))}
		</td>
	</tr>;
}
