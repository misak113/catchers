import * as FirebaseApp from '@firebase/app';
import * as FirebaseAuth from '@firebase/auth';
import firebaseConfig from '../firebase.json';

export async function initFirebase() {
	const email = process.env.FIREBASE_ADMIN_EMAIL;
	const password = process.env.FIREBASE_ADMIN_PASSWORD;
	if (!email || !password) {
		throw new Error('Missing firebase credentials FIREBASE_ADMIN_EMAIL and FIREBASE_ADMIN_PASSWORD');
	}
	const firebaseApp = FirebaseApp.initializeApp(firebaseConfig);
	const firebaseAuth = FirebaseAuth.getAuth(firebaseApp);
	const credentials = await FirebaseAuth.signInWithEmailAndPassword(firebaseAuth, email, password);
	console.log("Logged in", credentials);

	return firebaseApp;
}
