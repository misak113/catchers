import * as FirebaseApp from '@firebase/app';
import * as FirebaseFirestore from '@firebase/firestore';
import { IMail, getMailsCollection } from "./collections";

export async function sendMail(
	firebaseApp: FirebaseApp.FirebaseApp,
	mail: IMail,
) {
	await FirebaseFirestore.addDoc(getMailsCollection(firebaseApp), mail);
}
