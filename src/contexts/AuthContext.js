import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userDataLoading, setUserDataLoading] = useState(true);

  useEffect(() => {
    let unsubUser = null;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      let profileSynced = false; // oturum başına bir kez publicProfile senkronizasyonu
      setCurrentUser(user);

      if (unsubUser) { unsubUser(); unsubUser = null; }

      if (user) {
        setUserDataLoading(true);
        unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
          const data = snap.exists() ? snap.data() : null;
          setUserData(data);
          setUserDataLoading(false);
          // publicProfiles migration/backfill: mobil ile aynı — oturum başına bir kez.
          // Mobil AuthContext ile birebir alanlar (isim/mahlas/rol her yerde görünebilsin).
          if (data && !profileSynced) {
            profileSynced = true;
            setDoc(doc(db, 'publicProfiles', user.uid), {
              name:       data.name       || '',
              profilePic: data.profilePic || '',
              mahlas:     data.mahlas     || '',
              role:       data.role       || '',
              username:   data.username   || '',
            }, { merge: true }).catch(() => {});
          }
        });
      } else {
        setUserData(null);
        setUserDataLoading(false);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubUser) unsubUser();
    };
  }, []);

  const value = { currentUser, userData, loading, userDataLoading };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}