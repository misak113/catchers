import * as firebase from '@firebase/app';
import * as firestore from '@firebase/firestore';
import { User as FirebaseUser } from '@firebase/auth';
import { useEffect, useState } from "react";
import { getErrorMessage } from "../Util/error";
import { mapUser, IUser, getUsersCollection } from "./collections";

export function usePossibleAttendees(
	firebaseApp: firebase.FirebaseApp,
	user: FirebaseUser | null,
	setErrorMessage: (errorMessage: string | undefined) => void,
) {
	const [possibleAttendees, setPossibleAttendees] = useState<string[]>();
	useEffect(() => {
		(async () => {
			try {
				const { docs } = await firestore.getDocs(getUsersCollection(firebaseApp));
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
				const { docs } = await firestore.getDocs(firestore.query(getUsersCollection(firebaseApp), firestore.where('linkedUserUid', '==', user.uid)));
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
