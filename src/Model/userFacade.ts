import { useEffect, useState } from "react";
import { getErrorMessage } from "../Util/error";
import { USERS, mapUser, IUser } from "./collections";

export function usePossibleAttendees(
	firebaseApp: firebase.app.App,
	user: firebase.User | null,
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [possibleAttendees, setPossibleAttendees] = useState<string[]>();
	useEffect(() => {
		(async () => {
			try {
				const { docs } = await firebaseApp.firestore().collection(USERS).get();
				const users = docs.map(mapUser);
				console.log('users', users);
				setPossibleAttendees(users.filter((user) => user.player).map((user) => user.name || user.email));
				setErrorMessage(undefined);
			} catch (error) {
				console.error(error);
				setErrorMessage(getErrorMessage(error));
			}
		})();
	}, [firebaseApp, user, setErrorMessage]);
	return [possibleAttendees];
}

export function useCurrentUser(
	firebaseApp: firebase.app.App,
	user: firebase.User | null,
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [currentUser, setCurrentUser] = useState<IUser>();
	useEffect(() => {
		(async () => {
			if (!user) {
				return;
			}
			try {
				const { docs } = await firebaseApp.firestore().collection(USERS).where('linkedUserUid', '==', user.uid).get();
				if (docs.length < 1) {
					return;
				}
				const currentUser = mapUser(docs[0]);
				console.log('currentUser', user);
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
