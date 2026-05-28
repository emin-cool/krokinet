import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageSquare, MapPin } from 'lucide-react';

export default function NotificationsDropdown() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [currentUser]);

  // Dışarı tıklandığında menüyü kapatma
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsReadAndNavigate = async (notif) => {
    if (!notif.read) {
      await updateDoc(doc(db, 'notifications', notif.id), { read: true });
    }
    setIsOpen(false);
    if (notif.projectId) {
      navigate(`/project/${notif.projectId}`);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', marginRight: 16, display: 'flex', alignItems: 'center' }}
      >
        <Bell size={24} color="#f8fafc" />
        {unreadCount > 0 && (
          <span style={{ 
            position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', 
            borderRadius: '50%', padding: '2px 6px', fontSize: 11, fontWeight: 'bold' 
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{ 
          position: 'absolute', top: 40, right: 0, width: 320, background: '#1e293b', 
          border: '1px solid #334155', borderRadius: 8, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 999 
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, color: '#fff', fontSize: 15 }}>Bildirimler</h4>
          </div>
          <div style={{ maxHeight: 350, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Hiç bildiriminiz yok.</div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id} 
                  onClick={() => markAsReadAndNavigate(notif)}
                  style={{ 
                    padding: '12px 16px', borderBottom: '1px solid #334155', cursor: 'pointer',
                    background: notif.read ? 'transparent' : 'rgba(59, 130, 246, 0.1)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ color: '#3b82f6', marginTop: '2px' }}>
                      {notif.type === 'mention' ? <MessageSquare size={18} /> : <MapPin size={18} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: notif.read ? '#cbd5e1' : '#fff', fontWeight: notif.read ? 'normal' : 'bold' }}>
                        {notif.message}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleString('tr-TR') : ''}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
