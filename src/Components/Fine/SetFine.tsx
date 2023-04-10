import classNames from 'classnames';
import React, { useState } from 'react';
import './SetFine.css';
import FinesTable from './FinesTable';
import { FINE_MEMBER_NAME, IFineDefinition, createFineTransactionPurpose, formatMatchDateOnly } from '../../Model/fineFacade';
import { IMatch, IUser, Privilege } from '../../Model/collections';
import { getUserName } from '../../Model/userFacade';
import { DEFAULT_CURRENCY_CODE, SettleUpMembers, SettleUpTransaction, SettleUpType, createTransaction, getSettleUpMembers } from '../../Model/settleUpFacade';
import FineTransactionTable from './FineTransactionTable';
import { generateHash } from '../Util/hash';
import { ISettleUpValue, withSettleUp } from '../../Context/SettleUpContext';

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

	if (!props.currentUser?.privileges?.includes(Privilege.WriteFines)) {
		return null;
	}

	const user = props.users?.find((user) => user.id === props.userId);

	const showTransactionCallback = (transaction: SettleUpTransaction, members: SettleUpMembers) => {
		const isForCurrentUser = user && transaction.items.some(item => item.forWhom.some((participant) => members[participant.memberId]?.name === user.name));
		const isForCurrentMatch = transaction?.purpose.includes(`${props.match?.opponent} ${formatMatchDateOnly(props.match)}`);
		return Boolean(isForCurrentUser && isForCurrentMatch);
	};

	const onSetFine = async (fine: IFineDefinition) => {
		const members = await getSettleUpMembers(props.settleUp, SettleUpType.Fines);
		let mainFineMemberId: string | undefined;
		let fineMemberId: string | undefined;

		for (const memberId in members) {
			const member = members[memberId];
			if (member.name === FINE_MEMBER_NAME) {
				mainFineMemberId = memberId;
			}
			if (member.name === user?.name) {
				fineMemberId = memberId;
			}
		}
		if (!mainFineMemberId) {
			setErrorMessage(`Cannot find ${FINE_MEMBER_NAME} member in SettleUp`);
			return;
		}
		if (!fineMemberId) {
			setErrorMessage(`Cannot find ${user?.name} member in SettleUp`);
			return;
		}

		const transaction: SettleUpTransaction = {
			currencyCode: DEFAULT_CURRENCY_CODE,
			purpose: createFineTransactionPurpose(fine, props.match),
			dateTime: new Date().valueOf(),
			fixedExchangeRate: true,
			type: 'expense',
			whoPaid: [{ memberId: mainFineMemberId, weight: '1' }],
			items: [{
				amount: fine.amount.toString(),
				forWhom: [{ memberId: fineMemberId, weight: '1' }],
			}],
		};
		await createTransaction(props.settleUp, SettleUpType.Fines, transaction);
		setRefreshToken(generateHash());
	}

	return <div className='SetFine'>
		<button type="button" className="close" onClick={() => setOpen(true)}>
			<span title="Přidat pokutu">
				<i className="fa fa-cogs"></i>
			</span>
		</button>
		{user && <FineSelectionModal open={open} setOpen={setOpen} onSetFine={onSetFine}>
			{errorMessage && <div className='alert alert-danger'>{errorMessage}</div>}
			<h1>{getUserName(user)}</h1>
			<FineTransactionTable key={refreshToken} showTransactionCallback={showTransactionCallback}/>
			<p>Přidat pokutu tomuto hráči</p>
		</FineSelectionModal>}
	</div>;
};
export default withSettleUp(SetFine);

interface IPopoverProps {
	children: React.ReactNode;
	open: boolean;
	setOpen: (open: boolean) => void;
	onSetFine: (fine: IFineDefinition) => void;
}

const FineSelectionModal = ({ children, open, setOpen, onSetFine }: IPopoverProps) => {

	return (
		<>
			<div className={classNames("SetFineModal modal fade", { show: open })} tabIndex={-1}>
				<div className="modal-dialog">
					<div className="modal-content">
						<div className="modal-header">
							<h5 className="modal-title">Přidat pokutu</h5>
							<button type="button" className="close" onClick={() => setOpen(false)}>
								<span>&times;</span>
							</button>
						</div>
						<div className="modal-body">
							{children}
							<FinesTable onSetFine={onSetFine}/>
						</div>
						<div className="modal-footer">
							<button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Close</button>
						</div>
					</div>
				</div>
			</div>

			<div className={classNames("SetFineModal modal-backdrop fade", { show: open })}></div>
		</>
	);
};
