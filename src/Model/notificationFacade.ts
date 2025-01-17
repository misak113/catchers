import * as FirebaseApp from '@firebase/app';
import { IMail, IMatch, IUser } from './collections';
import { formatDateTimeHumanized } from '../Util/datetime';
import { stripHtmlEntities } from '../Util/html';
import { UNRESPONDED_LATE_FINE } from './fineFacade';
import { formatCurrencyAmountHumanized } from '../Util/currency';
import { sendMail } from './mailFacade';
import { getDeadlineResponseDate } from './matchFacade';
import { getCachedTeamName, getPSMFFieldUrl, getPSMFTeamUrl } from './psmfFacade';

const BUTTON_STYLE = '\
display: inline-block;\
padding: 0.5rem 1rem;\
text-decoration: none;\
background: #28a745;\
color: white;\
border-bottom: solid 1px #28a745;\
border-radius: 0.3rem;\
';

export async function sendMatchUnrespondedNotification(firebaseApp: FirebaseApp.FirebaseApp, match: IMatch, unrespondedUser: IUser, apply: boolean, baseUrl: string) {
	const deadlineDate = getDeadlineResponseDate(match);
	const emails = [unrespondedUser.email];
	const teamName = await getCachedTeamName({
		tournament: match.tournament,
		group: match.group,
		code: match.opponent,
	}) ?? match.opponent;
	const subject = await getSubject(match, teamName);
	const matchUrl = getMatchUrl(match, baseUrl);
	const psmfTeamUrl = match.tournament && match.group ? getPSMFTeamUrl(match.tournament, match.group, match.opponent) : undefined;
	const teamLink = psmfTeamUrl ? `<a href="${psmfTeamUrl}">${teamName}</a>` : teamName;

	const fieldLink = match.field ? `<a href="${getPSMFFieldUrl(match.field)}">${match.field}</a>` : `<span>Neuvedeno</span>`;
	const messageHtml = `Ahoj,<br/>
		<br/>
		<p>
			ještě ses nevyjádřil k zápasu, který se odehrává <strong>${formatDateTimeHumanized(match.startsAt)}</strong><br/>
			a hraje se na hřišti <strong>${fieldLink}</strong>.
		</p>

		<p>
			Hrajeme s týmem <strong>${teamLink}</strong>, tak nezapomeň, jinak dostaneš pokutu <em>${formatCurrencyAmountHumanized(UNRESPONDED_LATE_FINE)}</em>.
			Učiň tak nejpozději do půlnoci <strong>${formatDateTimeHumanized(deadlineDate)}</strong>.
		</p>
	`;
	const html = `
		${messageHtml}
		<a href="${matchUrl}" style="${BUTTON_STYLE}" class="button">Vyjádřit se k zápasu</a>
	`;
	const text = stripHtmlEntities(messageHtml) + `

	Vyjádřit se k zápasu kliknutím na odkaz: ${matchUrl}`;
	const mail: IMail = {
		to: emails,
		message: {
			subject,
			text,
			html,
		},
	};

	if (apply) {
		await sendMail(firebaseApp, mail);
	}

	return mail;
}

function getMatchUrl(match: IMatch, baseUrl: string) {
	return `${baseUrl}/zapas/${match.id}`;
}

async function getSubject(match: IMatch, teamName: string) {
	const subject = `Nevyjádřil ses k zápasu ${formatDateTimeHumanized(match.startsAt)} - ${teamName} - ${match.field ?? 'Neuvedeno'}`;
	return subject;
}
