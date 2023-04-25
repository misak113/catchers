import moment from 'moment-timezone';
import 'moment/locale/cs';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUpcomingMatches, updateMatchNotificationSent } from '../Model/matchFacade';
import { initFirebase } from '../Model/firebaseFacade';
import { getPossibleAttendees, getUnrespondedUsersOfMatch } from '../Model/userFacade';
import { sendMatchUnrespondedNotification } from '../Model/notificationFacade';
import { IMail } from '../Model/collections';
import config from '../config.json';

type ResponseObject = {
	message?: string;
	mails: IMail[];
};

const THRESHOLD_IN_MS = 3 * 24 * 60 * 60 * 1e3;

export default async function handler(req: VercelRequest, res: VercelResponse) {
	moment.locale('cs');
	if (req.query.key !== '3fdb9f6371244ea7c613e39f3e626771') {
		res.status(401).end('Unauthorized');
		return;
	}
	const apply = req.query.apply === 'true';
	const host = req.headers['x-forwarded-host'] ?? req.headers.host;
	const protocol = req.headers['x-forwarded-proto'] ?? 'http';
	const baseUrl = config.baseUrl ?? (protocol + '://' + host);

	const responseObject: ResponseObject = {
		mails: [],
	};

	const firebaseApp = await initFirebase();
	const upcomingMatches = await getUpcomingMatches(firebaseApp);
	const matchesToNotify = upcomingMatches.filter((match) => match.startsAt.getTime() - Date.now() < THRESHOLD_IN_MS);
	const possibleAttendees = await getPossibleAttendees(firebaseApp);
	for (const match of matchesToNotify) {
		const unrespondedUsers = getUnrespondedUsersOfMatch(match, possibleAttendees);
		const notNotifiedUnrespondedUsers = unrespondedUsers.filter((user) => !match.notificationsSent?.[user.id]);
		for (const unrespondedUser of notNotifiedUnrespondedUsers) {
			const mail = await sendMatchUnrespondedNotification(firebaseApp, match, unrespondedUser, apply, baseUrl);
			responseObject.mails.push(mail);
			await updateMatchNotificationSent(firebaseApp, match, unrespondedUser);
		}
	}

	if (apply) {
		responseObject.message = 'Match notifications has been updated';
	} else {
		responseObject.message = 'Match notifications would have been updated if this was not a dry run. Add query param &apply=true to apply the changes.';
	}
	res.status(200).json(responseObject);
}
