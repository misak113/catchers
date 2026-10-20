import React, { useEffect, useRef, useState } from 'react';
import './SetFine.css';
import FinesTable from './FinesTable';
import { IFineDefinition, formatMatchDateOnly } from '../../Model/fineFacade';
import { prepareFine } from './fineSubmission';
import { IMatch, IUser, Privilege } from '../../Model/collections';
import { getUserName, hasPrivilege } from '../../Model/userFacade';
import { SettleUpMembers, SettleUpTransaction, SettleUpType, getSettleUpMembers, useSettleUpAuth } from '../../Model/settleUpFacade';
import FineTransactionTable from './FineTransactionTable';
import { generateHash } from '../Util/hash';
import { ISettleUpValue, withSettleUp } from '../../Context/SettleUpContext';
import { Modal } from '../Modal/Modal';

export interface ISetFineProps {
	userId: string;
	users: IUser[] | undefined;
	match: IMatch | null;
	currentUser: IUser | undefined;
	showFineTransactionCallback?: (fine: SettleUpTransaction) => boolean;
}

export const SetFine = (props: ISetFineProps & ISettleUpValue) => {
	const [errorMessage, setErrorMessage] = useState<string>();
	const [open, setOpen] = useState(false);
	const [refreshToken, setRefreshToken] = useState(generateHash());

	const auth = useSettleUpAuth(props.settleUp);
	const canWrite = hasPrivilege(props.currentUser, Privilege.WriteFines);
	const uid = auth.user?.uid;
	const [access, setAccess] = useState<{ uid: string; members: SettleUpMembers }>();
	const [accessError, setAccessError] = useState<string>();
	const [accessAttempt, setAccessAttempt] = useState(0);
	const [submitting, setSubmitting] = useState(false);
	const inFlight = useRef(false);
	const pendingWrite = useRef<{ uid: string; target: string; write: () => Promise<void> } | undefined>(undefined);
	const target = `${props.userId}/${props.match?.id}`;

	useEffect(() => {
		setAccess(undefined);
		setAccessError(undefined);
		if (!open || !canWrite || auth.loading || !uid) return;
		let active = true;
		getSettleUpMembers(props.settleUp, SettleUpType.Fines).then(members => {
			if (active) setAccess({ uid, members });
		}).catch(() => {
			if (active) setAccessError('Cannot read the Settle Up fines group. Check this account’s group access or connection, then retry.');
		});
		return () => { active = false; };
	}, [open, canWrite, auth.loading, uid, props.settleUp, accessAttempt]);

	const ready = open && canWrite && !auth.loading && !!uid && access?.uid === uid;

	const user = props.users?.find((user) => user.id === props.userId);

	const showTransactionCallback = (transaction: SettleUpTransaction, members: SettleUpMembers) => {
		const isForCurrentUser = user && transaction.items.some(item => item.forWhom.some((participant) => members[participant.memberId]?.name === user.name));
		const isForCurrentMatch = transaction?.purpose.includes(`${props.match?.opponent} ${formatMatchDateOnly(props.match)}`);
		return Boolean(isForCurrentUser && isForCurrentMatch);
	};

	const submit = async (fine?: IFineDefinition) => {
		// A ref also protects clicks occurring before React commits disabled buttons.
		if (!ready || !access || !uid || inFlight.current) return;
		if (pendingWrite.current && (pendingWrite.current.uid !== uid || pendingWrite.current.target !== target || fine)) return;
		inFlight.current = true;
		setSubmitting(true);
		setErrorMessage(undefined);
		try {
			if (!pendingWrite.current && fine) {
				pendingWrite.current = { uid, target, write: prepareFine(props.settleUp, access.members, user?.name, fine, props.match) };
			}
			if (!pendingWrite.current) return;
			await pendingWrite.current.write();
			pendingWrite.current = undefined;
			setRefreshToken(generateHash());
		} catch (error) {
			setErrorMessage(pendingWrite.current
				? "The fine could not be confirmed. Check Settle Up write access and your connection. Retry the same fine below; do not add it elsewhere or reload while the result is uncertain."
				: error instanceof Error ? error.message : "Cannot prepare this fine. Check the group members.");
		} finally {
			inFlight.current = false;
			setSubmitting(false);
		}
	};

	if (!canWrite) return null;

	return <div className='SetFine'>
		<button type="button" className="close" onClick={() => setOpen(true)}>
			<span title="Přidat pokutu">
				<i className="fa fa-cogs"></i>
			</span>
		</button>
		{user && <Modal title='Přidat pokutu' open={open} setOpen={setOpen}>
			{auth.errorMessage && <div role="alert" className="alert alert-danger">{auth.errorMessage}</div>}
			{auth.loading && <p role="status">Waiting for Settle Up sign-in…</p>}
			{!auth.loading && !uid && <div>
				<p>Sign in to Settle Up separately to add fines.</p>
				{Object.keys(props.settleUp.firebaseAuthProviders).map(provider => <button type="button" className="btn btn-primary" key={provider} disabled={auth.loggingIn} onClick={() => { void auth.login(provider); }}>Login Settle Up with {provider}</button>)}
			</div>}
			{open && !auth.loading && uid && !ready && !accessError && <p role="status">Checking Settle Up fines group access…</p>}
			{accessError && <div role="alert" className="alert alert-danger">{accessError} <button type="button" onClick={() => setAccessAttempt(attempt => attempt + 1)}>Retry group access</button></div>}
			{errorMessage && <div role="alert" className="alert alert-danger">{errorMessage}</div>}
			{pendingWrite.current && <button type="button" disabled={!ready || submitting || pendingWrite.current.uid !== uid || pendingWrite.current.target !== target} onClick={() => { void submit(); }}>Retry same fine</button>}
			{submitting && <p role="status">Saving fine…</p>}
			<h1>{getUserName(user)}</h1>
			{ready && <FineTransactionTable key={refreshToken} showTransactionCallback={showTransactionCallback}/>}
			<p>Přidat pokutu tomuto hráči</p>
			<FinesTable disabled={!ready || submitting || !!pendingWrite.current} onSetFine={fine => { void submit(fine); }}/>
		</Modal>}
	</div>;
};
export default withSettleUp(SetFine);
