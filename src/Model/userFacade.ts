import { useEffect, useState } from "react";
import { USERS, mapUser } from "./collections";

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
				setErrorMessage(error.message);
			}
		})();
	}, [firebaseApp, user, setErrorMessage]);
	return [possibleAttendees];
}
