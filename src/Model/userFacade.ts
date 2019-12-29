import { useEffect, useState } from "react";
import { USERS, mapUser } from "./collections";

export function usePossibleAttendees(
	firebaseApp: firebase.app.App,
	setErrorMessage: (errorMessage: string) => void,
) {
	const [possibleAttendees, setPossibleAttendees] = useState<string[]>();
	useEffect(() => {
		(async () => {
			try {
				const { docs } = await firebaseApp.firestore().collection(USERS).get();
				const users = docs.map(mapUser);
				console.log('users', users);
				setPossibleAttendees(users.filter((user) => user.player).map((user) => user.name || user.email));
			} catch (error) {
				console.error(error);
				setErrorMessage(error.message);
			}
		})();
	}, [firebaseApp, setErrorMessage]);
	return [possibleAttendees];
}
