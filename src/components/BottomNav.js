import React from 'react';
import { NavLink } from 'react-router-dom';
import { FolderKanban, Bell, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function BottomNav() {
  const { currentUser } = useAuth();
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      where('read', '==', false)
    );
    const unsub = onSnapshot(q, snap => {
      setUnreadCount(snap.docs.length);
    });
    return () => unsub();
  }, [currentUser]);

  if (!currentUser) return null;

  return (
    <div className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`} end>
        <FolderKanban size={24} />
        <span>Projeler</span>
      </NavLink>
      <NavLink to="/notifications" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <div style={{ position: 'relative' }}>
          <Bell size={24} />
          {unreadCount > 0 && (
            <span className="bottom-nav-badge">{unreadCount}</span>
          )}
        </div>
        <span>Bildirimler</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <User size={24} />
        <span>Profil</span>
      </NavLink>
    </div>
  );
}
