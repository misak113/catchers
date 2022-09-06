import * as firebase from '@firebase/app';
import * as firestore from '@firebase/firestore';
import { User as FirebaseUser } from '@firebase/auth';
import { useEffect, useState } from "react";
import { getErrorMessage } from "../Util/error";
import { mapUser, IUser, getUsersCollection, IPersonResult, getMailsCollection, getUserPlayerLinkRequestsCollection, IUserPlayerLinkRequest } from "./collections";
import { generateHash } from '../Components/Util/hash';

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
	useEffect(() => {
		(async () => {
			if (!user) {
				return;
			}
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
			}
		})();
	}, [firebaseApp, user, setErrorMessage]);
	return [currentUser];
}

export function useShowPlayerLinkingModal(
	firebaseApp: firebase.FirebaseApp,
	user: FirebaseUser | null,
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [showModal, setShowModal] = useState(false);
	const [currentUser] = useCurrentUser(firebaseApp, user, setErrorMessage);

	useEffect(() => {
		if (user && !currentUser) {
			setShowModal(true);
		} else {
			setShowModal(false);
		}
	}, [firebaseApp, user, currentUser]);

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
	const userPlayerLinkRequest: IUserPlayerLinkRequest = {
		hash,
		userUid: user.uid,
		playerId: player.id,
		requestedAt: new Date(),
	};
	await firestore.addDoc(getUserPlayerLinkRequestsCollection(firebaseApp), userPlayerLinkRequest);
	return userPlayerLinkRequest;
}
