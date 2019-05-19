import React from 'react';
import moment from 'moment';
import classNames from 'classnames';
import Anchor from '../Components/Anchor';

const Matches: React.FC = () => {
	const now = new Date();
	const matches = [
		{
			id: '1',
			startsAt: new Date('2019-05-19T18:45:00'),
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
			startsAt: new Date('2019-05-26T17:30:00'),
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
			startsAt: new Date('2019-06-01T10:00:00'),
			referees: [
				{
					name: 'Tomáš Veselý',
				},
				{
					name: 'Tomáš Pavlík',
				},
			],
			playground: {
				id: 'P2',
				name: 'Pražačka',
			},
		},
		{
			id: '4',
			startsAt: new Date('2019-06-02T15:00:00'),
			opponent: {
				name: 'Ameby FC A',
			},
			playground: {
				id: 'P3',
				name: 'Pražačka',
			},
		},
		{
			id: '5',
			startsAt: new Date('2019-06-09T18:45:00'),
			opponent: {
				name: 's. Oliver A',
			},
			playground: {
				id: 'ZABEH',
				name: 'Záběhlice',
			},
		},
		{
			id: '6',
			startsAt: new Date('2019-06-23T18:45:00'),
			opponent: {
				name: 'S. T. R. U. P.',
			},
			playground: {
				id: 'MIKU3',
				name: 'Mikulovka',
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
					<tr key={match.id} className={classNames({
						'table-success': moment(match.startsAt).diff(now, 'days') < 6,
						'table-dark': !!match.referees,
					})}>
						<td>{moment(match.startsAt).format('LL')} <small>{moment(match.startsAt).format('ddd')}</small></td>
						<td>{moment(match.startsAt).format('LT')}</td>
						<td>
							{match.opponent && match.opponent.name.replace(' ', ' ')}
							{match.referees && match.referees.map((referee) => referee.name.replace(' ', ' ')).join(', ')}
						</td>
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
