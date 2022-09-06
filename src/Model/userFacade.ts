import * as firebase from '@firebase/app';
import * as firestore from '@firebase/firestore';
import { User as FirebaseUser } from '@firebase/auth';
import { useEffect, useState } from "react";
import { getErrorMessage } from "../Util/error";
import { mapUser, IUser, getUsersCollection, IPersonResult, getMailsCollection, getUserPlayerLinkRequestsCollection, IUserPlayerLinkRequest, mapUserPlayerLinkRequest } from "./collections";
import { generateHash } from '../Components/Util/hash';
import { Creatable } from './types';
import moment from 'moment';

export function getUserName(user: IUser) {
	return user.name ?? user.email;
}

export const createMapPersonResultToUser = (possibleAttendees: IUser[] | undefined) => (personResult: IPersonResult): IUser => {
	const user = possibleAttendees?.find((user) => user.id === personResult.userId);
	return user ?? {
		id: personResult.userId,
		email: `user-${personResult.userId}@sccatchers.cz`, // This is only dummy replacement of User if not found in DB from any reason
		player: false,
	};
};

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
	useEffect(() => {
		(async () => {
			try {
				const { docs } = await firestore.getDocs(getUsersCollection(firebaseApp));
				const users = docs.map(mapUser);
				console.log('users', users);
				setPossibleAttendees(users.filter((user) => user.player));
				setErrorMessage(undefined);
			} catch (error) {
				console.error(error);
				setErrorMessage(getErrorMessage(error));
			}
		})();
	}, [firebaseApp, user, setErrorMessage]);
	return [possibleAttendees];
}

export function useAllUsers(
	firebaseApp: firebase.FirebaseApp,
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [users, setUsers] = useState<IUser[]>();
	useEffect(() => {
		(async () => {
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
		})();
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
	useEffect(() => {
		(async () => {
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
		})();
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
	firestore.addDoc(getMailsCollection(firebaseApp), {
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
	});
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

	useEffect(() => {
		setLinking(true);
		(async () => {
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
		})();
	}, [firebaseApp, user, requestHash]);

	return [linking, errorMessage];
}
