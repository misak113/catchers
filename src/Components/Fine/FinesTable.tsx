import React from 'react';
import { FINES, IFineDefinition } from "../../Model/fineFacade";
import { formatCurrencyAmountHumanized } from "../../Util/currency";

interface IFinesProps {
	onSetFine?: (fine: IFineDefinition) => void;
}

const FinesTable = (props: IFinesProps) => {
	return <div>
		<h2>Sazebník</h2>
		<table className='table table-light table-bordered table-hover table-striped table-responsive-md'>
			<thead>
				<tr>
					<th>Hřích</th>
					<th>Pokuta</th>
					{props.onSetFine && <th>Akce</th>}
				</tr>
			</thead>
			<tbody>
				{FINES.map((fine) => {
					return (
						<tr key={fine.label}>
							<td>{fine.label} <i><small>({fine.detail})</small></i></td>
							<td>{formatCurrencyAmountHumanized(fine)}</td>
							{props.onSetFine && <td><button className='btn btn-primary' onClick={() => props.onSetFine?.(fine)}>Přidat</button></td>}
						</tr>
					);
				})}
			</tbody>
		</table>
	</div>
};
export default FinesTable;
