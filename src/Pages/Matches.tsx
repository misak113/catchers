import React from 'react';
import moment from 'moment';
import Anchor from '../Components/Anchor';

const Matches: React.FC = () => {
	const matches = [
		{
			id: '1',
			startsAt: new Date(),
			opponent: {
				name: 'Kanalpucers PL',
			},
			playground: {
				id: 'MIKU3',
				name: 'Mikulovka',
			},
		},
		{
			id: '2',
			startsAt: new Date(),
			opponent: {
				name: 'Mestek FC',
			},
			playground: {
				id: 'HANSP',
				name: 'Hanspaulka',
			},
		},
		{
			id: '3',
			startsAt: new Date(),
			opponent: {
				name: 'Ameby FC A',
			},
			playground: {
				id: 'P3',
				name: 'Pražačka',
			},
		},
	];
	return <>
		<h1>Zápasy</h1>
		
		<table className="table table-light table-bordered table-hover table-striped table-responsive-md">
			<thead>
				<tr>
					<th>Datum</th>
					<th>Čas</th>
					<th>Soupeř</th>
					<th>Hřiště</th>
					<th>Detail</th>
				</tr>
			</thead>
			<tbody>
				{matches.map((match) => (
					<tr>
						<td>{moment(match.startsAt).format('LL')} <small>{moment(match.startsAt).format('ddd')}</small></td>
						<td>{moment(match.startsAt).format('LT')}</td>
						<td>{match.opponent.name.replace(' ', ' ')}</td>
						<td>{match.playground.name.replace(' ', ' ')}</td>
						<td>
							<Anchor href={`/zapas/${match.id}`}>detail</Anchor>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	</>;
};
export default Matches;
