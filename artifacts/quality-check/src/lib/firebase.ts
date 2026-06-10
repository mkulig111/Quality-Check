import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  projectId: "qualitycheck-42z32",
  appId: "1:938034343523:web:ed4eed913ab58985fad256",
  storageBucket: "qualitycheck-42z32.firebasestorage.app",
  apiKey: "AIzaSyBI2S9cBA9LiZFS-XfOM2ZTnEHRcfCw7qQ",
  authDomain: "qualitycheck-42z32.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "938034343523",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const firestore = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, firestore, auth, storage };
