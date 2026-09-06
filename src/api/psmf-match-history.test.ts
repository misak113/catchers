import { createDom, extractScorers, parseTeamPageMatches } from './psmf-match-history';

describe('psmf match history parser', () => {
	it('parses team page rows with scores and detail links', () => {
		const dom = createDom(`
			<section class="component--opener">
				<table class="games-new-table">
					<tr>
						<td>Po&nbsp;01.09.2026</td>
						<td>20:30</td>
						<td><a>SK Záběhlice</a></td>
						<td>
							<a href="/souteze/2026-hanspaulska-liga-podzim/8-c/tymy/catchers-sc/">Catchers SC</a>
							-
							<a href="/souteze/2026-hanspaulska-liga-podzim/8-c/tymy/soupersky-tym/">Soupeřský tým</a>
						</td>
						<td>3.</td>
						<td><a href="/souteze/2026-hanspaulska-liga-podzim/8-c/zapas/123456/">2:1</a></td>
					</tr>
				</table>
			</section>
		`);

		const matches = parseTeamPageMatches(dom.window.document, '/souteze/2026-hanspaulska-liga-podzim/8-c/tymy/catchers-sc/');

		expect(matches).toHaveLength(1);
		expect(matches[0]).toMatchObject({
			id: '123456',
			tournament: '2026-hanspaulska-liga-podzim',
			group: '8-c',
			opponentCode: 'soupersky-tym',
			opponentName: 'Soupeřský tým',
			round: '3.',
			field: 'SK Záběhlice',
			detailPath: '/souteze/2026-hanspaulska-liga-podzim/8-c/zapas/123456/',
			score: {
				home: 2,
				guest: 1,
				raw: '2:1',
			},
			status: 'finished',
		});
	});

	it('parses scorer tables from match detail', () => {
		const match = {
			id: '123456',
			startsAtIso: new Date('2026-09-01T20:30:00.000Z').toISOString(),
			tournament: '2026-hanspaulska-liga-podzim',
			group: '8-c',
			opponentCode: 'soupersky-tym',
			opponentName: 'Soupeřský tým',
			homeTeamCode: 'catchers-sc',
			homeTeamName: 'Catchers SC',
			guestTeamCode: 'soupersky-tym',
			guestTeamName: 'Soupeřský tým',
			status: 'finished' as const,
			scorers: [],
			raw: {
				rowCells: [],
			},
			score: {
				home: 2,
				guest: 1,
				raw: '2:1',
			},
		};
		const dom = createDom(`
			<h2>Střelci branek</h2>
			<table>
				<tr>
					<th>Catchers SC</th>
					<th>Soupeřský tým</th>
				</tr>
				<tr>
					<td>12. Jan Novák<br/>45. Petr Svoboda</td>
					<td>67. Karel Dvořák</td>
				</tr>
			</table>
		`);

		const scorers = extractScorers(dom.window.document, match);

		expect(scorers).toEqual([
			{
				playerName: 'Jan Novák',
				minute: 12,
				rawMinute: '12.',
				teamSide: 'home',
				rawText: '12. Jan Novák',
			},
			{
				playerName: 'Petr Svoboda',
				minute: 45,
				rawMinute: '45.',
				teamSide: 'home',
				rawText: '45. Petr Svoboda',
			},
			{
				playerName: 'Karel Dvořák',
				minute: 67,
				rawMinute: '67.',
				teamSide: 'guest',
				rawText: '67. Karel Dvořák',
			},
		]);
	});
});
