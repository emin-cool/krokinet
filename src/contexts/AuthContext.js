import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

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
      setCurrentUser(user);

      if (unsubUser) { unsubUser(); unsubUser = null; }

      if (user) {
        setUserDataLoading(true);
        unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
          if (snap.exists()) {
            setUserData(snap.data());
          } else {
            setUserData(null);
          }
          setUserDataLoading(false);
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