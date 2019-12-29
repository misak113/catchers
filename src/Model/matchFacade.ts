import { useEffect, useState } from "react";
import { MATCHES, IMatch, mapMatch } from "./collections";

export function useMatches(
	firebaseApp: firebase.app.App,
	setErrorMessage: (errorMessage: string) => void,
) {
	const [matches, setMatches] = useState<IMatch[]>();
	useEffect(() => {
		(async () => {
			try {
				const { docs } = await firebaseApp.firestore().collection(MATCHES).get();
				const matches = docs.map(mapMatch);
				console.log('matches', matches);
				setMatches(matches);
			} catch (error) {
				console.error(error);
				setErrorMessage(error.message);
			}
		})();
	}, [firebaseApp, setErrorMessage]);

	return [matches];
}

export function useMatch(
	matchId: string,
	firebaseApp: firebase.app.App,
	setErrorMessage: (errorMessage: string) => void,
) {
	const [match, setMatch] = useState<IMatch>();
	useEffect(() => {
		(async () => {
			try {
				const doc = await firebaseApp.firestore().collection(MATCHES).doc(matchId).get();
				const match = doc.exists ? mapMatch(doc as firebase.firestore.QueryDocumentSnapshot) : undefined;
				console.log('match', match);
				setMatch(match);
			} catch (error) {
				console.error(error);
				setErrorMessage(error.message);
			}
		})();
	}, [matchId, firebaseApp, setErrorMessage]);

	return [match];
}
