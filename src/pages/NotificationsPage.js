import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, MapPin, Check, ArrowLeft } from 'lucide-react';
import SwipeableItem from '../components/SwipeableItem';

export default function NotificationsPage() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [currentUser]);

  const markAsReadAndNavigate = async (notif) => {
    if (!notif.read) {
      await updateDoc(doc(db, 'notifications', notif.id), { read: true });
    }
    if (notif.projectId) {
      const pinParam = notif.pinId ? `?pin=${notif.pinId}` : '';
      navigate(`/project/${notif.projectId}${pinParam}`);
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifs = notifications.filter(n => !n.read);
    for (const notif of unreadNotifs) {
      await updateDoc(doc(db, 'notifications', notif.id), { read: true });
    }
  };

  const deleteNotification = async (id) => {
    await deleteDoc(doc(db, 'notifications', id));
  };

  return (
    <div className="projects-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="detail-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'var(--bg-surface)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-card-hover)', border: 'none', cursor: 'pointer', transition: 'all 0.2s', color: 'var(--text-main)' }}
            className="back-btn-hover"
            title="Geri Dön"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>Bildirimler</h1>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Son gelişmeler</p>
          </div>
        </div>
        {notifications.some(n => !n.read) && (
          <button onClick={markAllAsRead} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={16} /> Okundu İşaretle
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
            Hiç bildiriminiz yok.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingBottom: 80 }}>
            {notifications.map(notif => (
              <SwipeableItem key={notif.id} onDelete={() => deleteNotification(notif.id)}>
                <div 
                  onClick={() => markAsReadAndNavigate(notif)}
                  style={{ 
                    padding: 16, 
                    borderRadius: 12, 
                    background: notif.read ? 'var(--bg-card)' : 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid',
                    borderColor: notif.read ? 'var(--border-color)' : 'var(--primary-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 16,
                    boxShadow: 'var(--shadow-sm)',
                    margin: 0
                  }}
                >
                  <div style={{ color: 'var(--primary-color)', marginTop: 2 }}>
                    {notif.type === 'mention' ? <MessageSquare size={24} /> : <MapPin size={24} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, color: 'var(--text-main)', fontWeight: notif.read ? '500' : '700' }}>
                      {notif.message}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                      {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleString('tr-TR') : ''}
                    </div>
                  </div>
                </div>
              </SwipeableItem>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
