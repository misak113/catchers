import React, { useState } from 'react';
import { IAuthValue, withAuth } from '../../Context/AuthContext';
import { IFirebaseValue, withFirebase } from '../../Context/FirebaseContext';
import { IUser } from '../../Model/collections';
import { sendEmailLinkPlayerWithUser, useAllUsers } from '../../Model/userFacade';
import { getErrorMessage } from '../../Util/error';
import Loading from '../Loading';
import './PlayerLinkModal.css';

interface IProps {}

export function PlayerLinkModal(props: IProps & IFirebaseValue & IAuthValue) {
	const [errorMessage, setErrorMessage] = useState<string | null>();
	const [linking, setLinking] = useState<boolean>(false);
	const [linkEmailSent, setLinkEmailSent] = useState<boolean>(false);
	const [linkPlayer, setLinkPlayer] = useState<IUser>();
	const [users] = useAllUsers(props.firebaseApp, setErrorMessage);
	const players = users?.filter((user) => user.player);
	return (
		<div className="PlayerLinkModal-modal modal fade in show" data-bs-backdrop="static" tabIndex={-1}>
			<div className="modal-dialog">
				<div className="modal-content">
				<div className="modal-header">
					<h5 className="modal-title">Kdo jsi?</h5>
				</div>
				<div className="modal-body">
				{linkEmailSent && linkPlayer ? <div className='alert alert-primary'>
					<p>
						Právě ti byl poslán potvrzovací e-mail na <code>{linkPlayer.email}</code>.<br/>
						Prosím, klikni na odkaz v e-mailu.
					</p>
					<p><small>Pokud nedorazí, kontaktuj manažera týmu.</small></p>
				</div> : <>
					<p>Zatím nejsi přiřazen k žádnému hráči. Pro pokračování si zvol sám sebe.</p>
					<p><small>Pokud se nenajdeš, kontaktuj manažera týmu.</small></p>
					{errorMessage && <div className="alert alert-danger">
						{errorMessage}
					</div>}
					<table className="table table-light table-bordered table-hover table-striped table-responsive-md">
						<thead>
							<tr>
								<th>Jméno</th>
								<th>E-mail</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{!players || linking ? <tr><td colSpan={3}><Loading/></td></tr> : players.map((player) => (
								<tr key={player.id} className="player-row">
									<td>{player.name}</td>
									<td>{player.email}</td>
									<td>
										<button
											className="btn btn-sm btn-warning player-link-button"
											onClick={async (event) => {
												event.preventDefault();
												setLinkPlayer(player);
												setLinking(true);
												try {
													if (!props.auth.user) {
														throw new Error('Not logged in');
													}
													await sendEmailLinkPlayerWithUser(props.firebaseApp, props.auth.user, player);
													setLinkEmailSent(true);
												} catch (error) {
													console.error(error);
													setErrorMessage(getErrorMessage(error));
												} finally {
													setLinking(false);
												}
											}}
										>To jsem já!</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
					</>}
				</div>
				</div>
			</div>
		</div>
	);
}
export default withFirebase(withAuth(PlayerLinkModal));
