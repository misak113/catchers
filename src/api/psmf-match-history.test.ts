// @ts-nocheck
import {
	extractScorers,
	parseGroupPageMatches,
	getSeasonTeamPagePath,
	parseRoundResults,
	parseStatsCategories,
	parseStatsCategoryTables,
	parseTeamPageMatches,
} from '../Model/psmfMatchHistoryParser';

describe('psmf match history parser', () => {
	it('finds the requested season team page from search html', () => {
		const teamPagePath = getSeasonTeamPagePath(`
			<section class="component--content">
				<div class="search-content">
					<ul>
						<li><a href="/souteze/2026-hanspaulska-liga-jaro/6-d/tymy/catchers-sc/">2026 jaro</a></li>
						<li><a href="/souteze/2026-hanspaulska-liga-podzim/8-c/tymy/catchers-sc/">2026 podzim</a></li>
					</ul>
				</div>
			</section>
		`, '2026-podzim');

		expect(teamPagePath).toBe('/souteze/2026-hanspaulska-liga-podzim/8-c/tymy/catchers-sc/');
	});

	it('parses team page rows with scores and detail links', () => {
		const matches = parseTeamPageMatches(`
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
		`, '/souteze/2026-hanspaulska-liga-podzim/8-c/tymy/catchers-sc/');

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
		const scorers = extractScorers(`
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
		`, match);

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

	it('parses played matches from round results json payloads', () => {
		const matches = parseRoundResults(JSON.stringify({
			html: `
				<div class="component__table-wrap" id="GameResultItem301999">
					<table class="component__table has-wrapper">
						<tr>
							<td>
								<table class="component__table is-inside">
									<tr>
										<th class="is-centered">Datum</th>
										<th class="is-centered">Čas</th>
										<th>Hřiště</th>
										<th>Domácí - Hosté</th>
										<th class="is-centered">Kolo</th>
										<th class="is-centered">Výsledek</th>
									</tr>
									<tr>
										<td class="is-centered">Út 1.9.26</td>
										<td class="is-centered">19:15</td>
										<td><a href="/hriste/#MALES">MALES</a></td>
										<td>
											<a href="/souteze/2026-hanspaulska-liga-podzim/6-e/tymy/catchers-sc/">Catchers SC</a>
											<a href="/souteze/2026-hanspaulska-liga-podzim/6-e/tymy/youngsters-fc-b/">Youngsters FC B</a>
										</td>
										<td class="is-centered">1.</td>
										<td class="is-centered is-result">2:6 <span class="period-goals">(1:3)</span></td>
									</tr>
								</table>
							</td>
						</tr>
						<tr>
							<td>
								<table class="component__table is-inside has-smaller-text">
									<tr>
										<th class="is-centered">Góly</th>
										<th class="is-centered">Karty</th>
										<th></th>
										<th class="is-centered">Góly</th>
										<th class="is-centered">Karty</th>
									</tr>
									<tr>
										<td>12. Michael Žabka<br/>46. OG</td>
										<td></td>
										<td></td>
										<td>7. Jan Host<br/>15., 25., 38., 44. Petr Host</td>
										<td></td>
									</tr>
								</table>
							</td>
						</tr>
					</table>
				</div>
			`,
		}), '/souteze/2026-hanspaulska-liga-podzim/6-e/');

		expect(matches).toHaveLength(1);
		expect(matches[0]).toMatchObject({
			id: '301999',
			tournament: '2026-hanspaulska-liga-podzim',
			group: '6-e',
			field: 'MALES',
			round: '1.',
			opponentCode: 'youngsters-fc-b',
			score: {
				home: 2,
				guest: 6,
				raw: '2:6',
			},
			status: 'finished',
		});
		expect(matches[0].scorers).toEqual([
			{
				playerName: 'Michael Žabka',
				minute: 12,
				rawMinute: '12.',
				teamSide: 'home',
				rawText: '12. Michael Žabka',
			},
			{
				playerName: 'OG',
				minute: 46,
				rawMinute: '46.',
				teamSide: 'home',
				rawText: '46. OG',
			},
			{
				playerName: 'Jan Host',
				minute: 7,
				rawMinute: '7.',
				teamSide: 'guest',
				rawText: '7. Jan Host',
			},
			{
				playerName: 'Petr Host',
				minute: 15,
				rawMinute: '15.',
				teamSide: 'guest',
				rawText: '15., 25., 38., 44. Petr Host',
			},
			{
				playerName: 'Petr Host',
				minute: 25,
				rawMinute: '25.',
				teamSide: 'guest',
				rawText: '15., 25., 38., 44. Petr Host',
			},
			{
				playerName: 'Petr Host',
				minute: 38,
				rawMinute: '38.',
				teamSide: 'guest',
				rawText: '15., 25., 38., 44. Petr Host',
			},
			{
				playerName: 'Petr Host',
				minute: 44,
				rawMinute: '44.',
				teamSide: 'guest',
				rawText: '15., 25., 38., 44. Petr Host',
			},
		]);
	});

	it('parses season stats categories and tables', () => {
		const categories = parseStatsCategories(`
			<a class="stats-action is-active" data-url="/souteze/2026-hanspaulska-liga-podzim/?cmd=stats&type=competition&subtype=shooters&competition=1&year=2026&season=2" href="#">Střelci</a>
			<a class="stats-action" data-url="/souteze/2026-hanspaulska-liga-podzim/?cmd=stats&type=competition&subtype=offensive&competition=1&year=2026&season=2" href="#">Útok</a>
		`);

		expect(categories).toEqual([
			{
				key: 'shooters',
				title: 'Střelci',
				sourcePath: '/souteze/2026-hanspaulska-liga-podzim/?cmd=stats&type=competition&subtype=shooters&competition=1&year=2026&season=2',
			},
			{
				key: 'offensive',
				title: 'Útok',
				sourcePath: '/souteze/2026-hanspaulska-liga-podzim/?cmd=stats&type=competition&subtype=offensive&competition=1&year=2026&season=2',
			},
		]);

		const statsCategory = parseStatsCategoryTables(`
			<table class="component__table">
				<tr>
					<th>#</th>
					<th>Jméno</th>
					<th>Góly</th>
				</tr>
				<tr>
					<td>1.</td>
					<td>Michael Žabka</td>
					<td>3</td>
				</tr>
			</table>
		`, categories[0]);

		expect(statsCategory).toEqual({
			key: 'shooters',
			title: 'Střelci',
			sourcePath: '/souteze/2026-hanspaulska-liga-podzim/?cmd=stats&type=competition&subtype=shooters&competition=1&year=2026&season=2',
			tables: [
				{
					title: undefined,
					rows: [
						['#', 'Jméno', 'Góly'],
						['1.', 'Michael Žabka', '3'],
					],
				},
			],
		});
	});

	it('parses visible group page result rows as fallback', () => {
		const matches = parseGroupPageMatches(`
			<table class="component__table">
				<tr>
					<th>Datum</th>
					<th>Čas</th>
					<th>Hřiště</th>
					<th>Domácí - Hosté</th>
					<th>Kolo</th>
					<th>Výsledek</th>
				</tr>
				<tr>
					<td>Út 1.9.26</td>
					<td>19:15</td>
					<td><a href="/hriste/#MALES">MALES</a></td>
					<td>
						<a href="/souteze/2026-hanspaulska-liga-podzim/6-e/tymy/catchers-sc/">Catchers SC</a>
						<a href="/souteze/2026-hanspaulska-liga-podzim/6-e/tymy/youngsters-fc-b/">Youngsters FC B</a>
					</td>
					<td>1.</td>
					<td>2:6 <a class="component__table-info game-result-info-link" href="#gameResults" data-round="1" data-gameid="301999" title="Info"></a></td>
				</tr>
			</table>
		`, '/souteze/2026-hanspaulska-liga-podzim/6-e/');

		expect(matches).toHaveLength(1);
		expect(matches[0]).toMatchObject({
			id: '301999',
			score: {
				home: 2,
				guest: 6,
				raw: '2:6',
			},
			raw: {
				groupResultGameId: '301999',
				groupResultRound: '1',
			},
		});
	});
});
