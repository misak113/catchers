import React from 'react';
import { CurrencyMap, DEFAULT_CURRENCY_CODE, SettleUpDebts, SettleUpMembers, debtsDescAmountSorter } from '../../Model/settleUpFacade';
import { formatCurrencyAmount, generateQrCode } from '../../Util/currency';
import QRModal from './QRModal';

interface IDebtsProps {
	debts: SettleUpDebts;
	members: SettleUpMembers;
}

const Debts = (props: IDebtsProps) => {
	return <div className='Debts'>
		<h2>Dluhy</h2>
		<table className="table table-light table-bordered table-hover table-striped table-responsive-md">
			<thead>
				<tr>
					<th>Kdo</th>
					<th>Komu</th>
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
					const humanizedCurrency = CurrencyMap[DEFAULT_CURRENCY_CODE] ?? DEFAULT_CURRENCY_CODE;
					const key = debt.from + '-' + debt.to;
					const bankAcount = props.members[debt.to]?.bankAccount ?? '';
					return (
						<tr key={key} className={'table-danger'}>
							<td className='font-weight-bold'>{props.members[debt.from]?.name}</td>
							<td>
								{props.members[debt.to]?.name}
								 
								<small>{bankAcount}</small>
								 
								{sepaQrCode && <QRModal sepaQrCode={sepaQrCode} amount={debt.amount} bankAccount={bankAcount} humanizedCurrency={humanizedCurrency}/>}
							</td>
							<td className='font-weight-bold'>{formatCurrencyAmount(debt.amount)} {humanizedCurrency}</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	</div>;
};
export default Debts;
