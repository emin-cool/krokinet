import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyDPA02P6tUmrKMVOUY_oTweDJz901hQERE",
  authDomain: "insaat-app-70b06.firebaseapp.com",
  projectId: "insaat-app-70b06",
  storageBucket: "insaat-app-70b06.firebasestorage.app",
  messagingSenderId: "632247836112",
  appId: "1:632247836112:web:580e479e5ff9dce497edd5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

export default app;