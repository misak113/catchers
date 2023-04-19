import React from 'react';
import { DEFAULT_CURRENCY_CODE, SettleUpDebts, SettleUpMembers, debtsDescAmountSorter } from '../../Model/settleUpFacade';
import { formatCurrencyAmountHumanized, generateQrCode } from '../../Util/currency';
import QRModal from './QRModal';

interface IDebtsProps {
	debts: SettleUpDebts;
	members: SettleUpMembers;
	hideWho?: boolean;
}

const Debts = (props: IDebtsProps) => {
	if (props.debts.length === 0) {
		return <div className='Debts'>
			<h2>Dluhy</h2>
			<div className='alert alert-success'>Všechny dluhy jsou srovnány 🙌</div>
		</div>;
	}

	return <div className='Debts'>
		<h2>Dluhy</h2>
		<table className="table table-light table-bordered table-hover table-striped table-responsive-md">
			<thead>
				<tr>
					<th>Kdo</th>
					{!props.hideWho && <th>Komu</th>}
					<th>Kolik</th>
				</tr>
			</thead>
			<tbody>
				{props.debts.sort(debtsDescAmountSorter).map((debt) => {
					const targetMember = props.members[debt.to];
					const sepaQrCode = targetMember?.bankAccount ? generateQrCode({
						bankAccount: targetMember.bankAccount,
						amount: parseInt(debt.amount),
						name: targetMember.name,
					}) : null;
					const key = debt.from + '-' + debt.to;
					const bankAcount = props.members[debt.to]?.bankAccount ?? '';
					return (
						<tr key={key} className={'table-danger'}>
							<td className='font-weight-bold'>{props.members[debt.from]?.name}</td>
							{!props.hideWho && <td>
								{props.members[debt.to]?.name}
								 
								<small>{bankAcount}</small>
								 
								{sepaQrCode && <QRModal sepaQrCode={sepaQrCode} amount={debt.amount} bankAccount={bankAcount} currencyCode={DEFAULT_CURRENCY_CODE}/>}
							</td>}
							<td className='font-weight-bold'>{formatCurrencyAmountHumanized({ amount: debt.amount, currencyCode: DEFAULT_CURRENCY_CODE })}</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	</div>;
};
export default Debts;
