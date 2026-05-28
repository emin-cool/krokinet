import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDPA02P6tUmrKMVOUY_oTweDJz901hQERE",
  authDomain: "insaat-app-70b06.firebaseapp.com",
  projectId: "insaat-app-70b06",
  storageBucket: "insaat-app-70b06.firebasestorage.app",
  messagingSenderId: "632247836112",
  appId: "1:632247836112:web:580e479e5ff9dce497edd5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
  } else if (err.code === 'unimplemented') {
    console.warn('The current browser does not support all of the features required to enable persistence');
  }
});

export default app;