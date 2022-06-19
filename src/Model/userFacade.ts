import * as firebase from '@firebase/app';
import * as firestore from '@firebase/firestore';
import { User as FirebaseUser } from '@firebase/auth';
import { useEffect, useState } from "react";
import { getErrorMessage } from "../Util/error";
import { mapUser, IUser, getUsersCollection, IPersonResult } from "./collections";

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
