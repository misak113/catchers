import * as firebase from '@firebase/app';
import * as firestore from '@firebase/firestore';
import { User as FirebaseUser } from '@firebase/auth';
import { useEffect, useState } from "react";
import { getErrorMessage } from "../Util/error";
import { mapUser, IUser, getUsersCollection, IPersonResult, getUserPlayerLinkRequestsCollection, IUserPlayerLinkRequest, mapUserPlayerLinkRequest, IMatch, IMail, Privilege, TeamRole, PlayerPosition } from "./collections";
import { generateHash } from '../Components/Util/hash';
import { Creatable } from './types';
import moment from 'moment-timezone';
import { useAsyncEffect } from '../React/async';
import { AuthProviderName } from '../Context/SettleUpContext';
import { sendMail } from './mailFacade';

export const TeamRoleMap = {
	[TeamRole.Captain]: 'Kapitán',
	[TeamRole.ViceCaptain]: 'Asistent',
	[TeamRole.TeamManager]: 'Manažer týmu',
	[TeamRole.DeputyTeamManager]: 'Zástupce manažera týmu',
};

export const PlayerPositionMap = {
	[PlayerPosition.Goalkeeper]: 'Brankář',
	[PlayerPosition.Defender]: 'Obránce',
	[PlayerPosition.Midfielder]: 'Záložník',
	[PlayerPosition.Forward]: 'Útočník',
};

export function getUserName(user: IUser) {
	return user.name ?? user.email;
}

export const createMapPersonResultToUser = (possibleAttendees: IUser[] | undefined) => (personResult: IPersonResult): IUser => {
	return createMapUserIdToUser(possibleAttendees)(personResult.userId);
};

export const createMapUserIdToUser = (possibleAttendees: IUser[] | undefined) => (userId: string): IUser => {
	const user = possibleAttendees?.find((user) => user.id === userId);
	return user ?? {
		id: userId,
		email: `user-${userId}@sccatchers.cz`, // This is only dummy replacement of User if not found in DB from any reason
		player: false,
	};
};

export function getUnrespondedUsersOfMatch(match: IMatch | null, possibleAttendees: IUser[] | undefined) {
	const attendees = match?.attendees || [];
	const maybeAttendees = match?.maybeAttendees || [];
	const nonAttendees = match?.nonAttendees || [];

	const unrespondedUsers = getUnrespondedUsers({ attendees, maybeAttendees, nonAttendees, possibleAttendees });
	return unrespondedUsers;
}

export function getUnrespondedUsers(props: {
	attendees: IPersonResult[];
	maybeAttendees: IPersonResult[];
	nonAttendees: IPersonResult[];
	possibleAttendees?: IUser[];
}) {
	const responded = [
		...props.attendees,
		...props.nonAttendees,
		...props.maybeAttendees,
	].map((response) => response.userId);
	return props.possibleAttendees?.filter((user: IUser) => !responded.includes(user.id)) ?? [];
}

export function usePossibleAttendees(
	firebaseApp: firebase.FirebaseApp,
	user: FirebaseUser | null,
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [possibleAttendees, setPossibleAttendees] = useState<IUser[]>();
	useAsyncEffect(async () => {
		try {
			const possibleAttendees = await getPossibleAttendees(firebaseApp);
			setPossibleAttendees(possibleAttendees);
			setErrorMessage(undefined);
		} catch (error) {
			console.error(error);
			setErrorMessage(getErrorMessage(error));
		}
	}, [firebaseApp, user, setErrorMessage]);
	return [possibleAttendees];
}

export async function getPossibleAttendees(firebaseApp: firebase.FirebaseApp) {
	const { docs } = await firestore.getDocs(getUsersCollection(firebaseApp));
	const users = docs.map(mapUser);
	console.log('users', users);
	const possibleAttendees = users.filter((user) => user.player);
	return possibleAttendees;
}

export function useAllUsers(
	firebaseApp: firebase.FirebaseApp,
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [users, setUsers] = useState<IUser[]>();
	useAsyncEffect(async () => {
		try {
			const { docs } = await firestore.getDocs(firestore.query(getUsersCollection(firebaseApp)));
			const users = docs.map(mapUser);
			console.log('users', users);
			setUsers(users);
			setErrorMessage(undefined);
		} catch (error) {
			console.error(error);
			setErrorMessage(getErrorMessage(error));
		}
	}, [firebaseApp, setErrorMessage]);
	return [users];
}

export function useCurrentUser(
	firebaseApp: firebase.FirebaseApp,
	user: FirebaseUser | null,
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [currentUser, setCurrentUser] = useState<IUser>();
	const [loading, setLoading] = useState<boolean>(true);
	useAsyncEffect(async () => {
		if (!user) {
			return;
		}
		setLoading(true);
		try {
			const { docs } = await firestore.getDocs(firestore.query(getUsersCollection(firebaseApp), firestore.where('linkedUserUids', 'array-contains', user.uid)));
			if (docs.length < 1) {
				return;
			}
			const currentUser = mapUser(docs[0]);
			console.log('currentUser', user, currentUser);
			setCurrentUser(currentUser);
			setErrorMessage(undefined);
		} catch (error) {
			console.error(error);
			setErrorMessage(getErrorMessage(error));
		} finally {
			setLoading(false);
		}
	}, [firebaseApp, user, setErrorMessage]);
	return [currentUser, loading] as const;
}

export function useShowPlayerLinkingModal(
	firebaseApp: firebase.FirebaseApp,
	user: FirebaseUser | null,
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [showModal, setShowModal] = useState(false);
	const [currentUser, loading] = useCurrentUser(firebaseApp, user, setErrorMessage);

	useEffect(() => {
		if (user && !currentUser && !loading) {
			setShowModal(true);
		} else {
			setShowModal(false);
		}
	}, [firebaseApp, user, currentUser, loading]);

	return showModal;
}

export async function sendEmailLinkPlayerWithUser(
	firebaseApp: firebase.FirebaseApp,
	user: FirebaseUser,
	player: IUser,
) {
	const userPlayerLinkRequest = await createUserPlayerLinkRequest(firebaseApp, user, player);
	const userName = user.displayName ?? user.email ?? 'unknown';
	const infoText = `Na stránkách SCCatchers bylo požádáno o připojení hráče "${player.name} - ${player.email}" (aktuální e-mailová adresa) k uživateli `
		+ `"${user.displayName ? user.displayName + ' - ' : ''}${user.email}".`;
	const linkUrl = `${window.location.origin}/spoj-hrace/${userPlayerLinkRequest.hash}`;
	const mail: IMail = {
		to: [player.email],
		message: {
			subject: `Připojení hráče "${player.name}" k uživateli "${userName}"`,
			text: `${infoText} Pro potvrzení klikni na odkaz: ${linkUrl}`,
			html: `<table style="width: 100%"><tbody>
				<tr style="text-align: center">
					${infoText}<br /><br />
					Pro potvrzení klikni na odkaz: <a href="${linkUrl}">${linkUrl}</a>
				</tr>
			</tbody></table>`,
		},
	};
	await sendMail(firebaseApp, mail);
}

export async function createUserPlayerLinkRequest(
	firebaseApp: firebase.FirebaseApp,
	user: FirebaseUser,
	player: IUser,
) {
	const hash = generateHash();
	const userPlayerLinkRequest: Creatable<IUserPlayerLinkRequest> = {
		hash,
		userUid: user.uid,
		playerId: player.id,
		requestedAt: new Date(),
		linkedAt: null,
	};
	await firestore.addDoc(getUserPlayerLinkRequestsCollection(firebaseApp), userPlayerLinkRequest);
	return userPlayerLinkRequest;
}

export function useLinkPlayer(
	firebaseApp: firebase.FirebaseApp,
	user: FirebaseUser | null,
	requestHash: string,
) {
	const [linking, setLinking] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | undefined>();

	useAsyncEffect(async () => {
		setLinking(true);
		if (!user) {
			setErrorMessage('Nejprve se prosím přihlas');
			setLinking(false);
			return;
		}
		try {
			const { docs } = await firestore.getDocs(firestore.query(
				getUserPlayerLinkRequestsCollection(firebaseApp),
				firestore.where('hash', '==', requestHash),
				firestore.where('userUid', '==', user.uid),
				firestore.where('linkedAt', '==', null),
				firestore.where('requestedAt', '>', moment().subtract(1, 'day').toDate()),
			));
			if (docs.length < 1) {
				setErrorMessage('Neplatný požadavek');
				return;
			}
			const requestDoc = docs[0];
			const userPlayerLinkRequest = mapUserPlayerLinkRequest(requestDoc);
			const userDoc = await firestore.getDoc(firestore.doc(getUsersCollection(firebaseApp), userPlayerLinkRequest.playerId));
			console.log("User doc", userDoc.id);
			await firestore.updateDoc(userDoc.ref, {
				linkedUserUids: firestore.arrayUnion(userPlayerLinkRequest.userUid),
			});
			await firestore.updateDoc(requestDoc.ref, {
				linkedAt: new Date(),
			});
			setErrorMessage(undefined);
		} catch (error) {
			console.error(error);
			setErrorMessage(getErrorMessage(error));
		} finally {
			setLinking(false);
		}
	}, [firebaseApp, user, requestHash]);

	return [linking, errorMessage];
}

export async function setUserSettleUpProviderName(
	firebaseApp: firebase.FirebaseApp,
	player: IUser,
	settleUpProviderName: AuthProviderName | null,
) {
	const userDoc = await firestore.getDoc(firestore.doc(getUsersCollection(firebaseApp), player.id));
	if (settleUpProviderName) {
		await firestore.updateDoc(userDoc.ref, {
			settleUpProviderName,
		});
	} else {
		await firestore.updateDoc(userDoc.ref, {
			settleUpProviderName: firestore.deleteField(),
		});
	}
}

export function hasPrivilege(user: IUser | null | undefined, privilege: Privilege): user is IUser {
	if (!user) {
		return false;
	}
	return Boolean(user.privileges?.includes(privilege));
}
