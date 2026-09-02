import moment from 'moment-timezone';
// @ts-ignore - moment locale types not available
import 'moment/locale/cs';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUpcomingMatches, queueMatchNotification } from '../Model/matchFacade';
import { initFirebase } from '../Model/firebaseFacade';
import { getPossibleAttendees, getUnrespondedUsersOfMatch } from '../Model/userFacade';
import { createMatchUnrespondedNotification } from '../Model/notificationFacade';
import { IMail } from '../Model/collections';
import config from '../config.json';

type ResponseObject = {
	message?: string;
	mails: IMail[];
};

const THRESHOLD_IN_MS = 3 * 24 * 60 * 60 * 1e3;

export default async function handler(req: VercelRequest, res: VercelResponse) {
	const startedAt = Date.now();
	moment.locale('cs');
	if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
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
	const candidates = matchesToNotify.flatMap((match) => {
		const unrespondedUsers = getUnrespondedUsersOfMatch(match, possibleAttendees);
		return unrespondedUsers
			.filter((user) => !match.notificationsSent?.[user.id])
			.map((user) => ({ match, user }));
	});
	responseObject.mails = await Promise.all(candidates.map(({ match, user }) =>
		createMatchUnrespondedNotification(match, user, baseUrl),
	));

	let failedNotifications = 0;
	if (apply) {
		const results = await Promise.allSettled(candidates.map(({ match, user }, index) =>
			queueMatchNotification(firebaseApp, match, user, responseObject.mails[index]),
		));
		const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
		failedNotifications = failures.length;
		failures.forEach((failure) => {
			console.error('Failed to queue a match notification', failure.reason instanceof Error ? failure.reason.message : failure.reason);
		});
	}

	console.log('Match notification run completed', {
		apply,
		upcomingMatches: upcomingMatches.length,
		matchesInWindow: matchesToNotify.length,
		candidates: candidates.length,
		queued: apply ? candidates.length - failedNotifications : 0,
		failed: failedNotifications,
		durationMs: Date.now() - startedAt,
	});

	if (failedNotifications > 0) {
		responseObject.message = `Failed to queue ${failedNotifications} of ${candidates.length} match notifications`;
		res.status(500).json(responseObject);
		return;
	} else if (apply) {
		responseObject.message = 'Match notifications has been updated';
	} else {
		responseObject.message = 'Match notifications would have been updated if this was not a dry run. Add query param ?apply=true to apply the changes.';
	}
	res.status(200).json(responseObject);
}
