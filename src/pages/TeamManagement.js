import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp, setDoc, onSnapshot } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDPA02P6tUmrKMVOUY_oTweDJz901hQERE",
  authDomain: "insaat-app-70b06.firebaseapp.com",
  projectId: "insaat-app-70b06",
  storageBucket: "insaat-app-70b06.firebasestorage.app",
  messagingSenderId: "632247836112",
  appId: "1:632247836112:web:580e479e5ff9dce497edd5"
};

const secondaryApp = getApps().find(a => a.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
const secondaryAuth = getAuth(secondaryApp);

export default function TeamManagement({ onClose }) {
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', groupId: '' });
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('groups');

  useEffect(() => {
    const unsubGroups = onSnapshot(collection(db, 'groups'), snap => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubGroups();
      unsubUsers();
    };
  }, []);

  async function createGroup() {
    if (!newGroupName.trim()) return;
    await addDoc(collection(db, 'groups'), {
      name: newGroupName.trim(),
      createdAt: serverTimestamp()
    });
    setNewGroupName('');
  }

  async function deleteGroup(groupId) {
    if (!window.confirm('Bu grubu silmek istiyor musunuz?')) return;
    await deleteDoc(doc(db, 'groups', groupId));
  }

  async function createUser() {
    if (!newUser.name || !newUser.email || !newUser.password || !newUser.groupId) {
      alert('Tüm alanları doldurun'); return;
    }
    setLoading(true);
    try {
      const selectedGroup = groups.find(g => g.id === newUser.groupId);
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
      await setDoc(doc(db, 'users', userCred.user.uid), {
        name: newUser.name,
        email: newUser.email,
        role: selectedGroup?.name || '',
        groupId: newUser.groupId,
        isSuperAdmin: false
      });
      await secondaryAuth.signOut();
      setNewUser({ name: '', email: '', password: '', groupId: '' });
      alert('Kullanıcı başarıyla oluşturuldu!');
    } catch (err) {
      alert('Hata: ' + err.message);
    }
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="team-modal" onClick={e => e.stopPropagation()}>
        <div className="team-modal-header">
          <h2>👥 Ekip Yönetimi</h2>
          <button className="btn-secondary" onClick={onClose}>✕</button>
        </div>

        <div className="detail-tabs">
          <button className={activeSection === 'groups' ? 'tab active' : 'tab'} onClick={() => setActiveSection('groups')}>🏷️ Gruplar</button>
          <button className={activeSection === 'users' ? 'tab active' : 'tab'} onClick={() => setActiveSection('users')}>👤 Kullanıcılar</button>
        </div>

        {activeSection === 'groups' && (
          <div className="team-section">
            <div className="add-row">
              <input placeholder="Grup adı (örn: Mimar Grubu)" value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createGroup()} />
              <button className="btn-primary" onClick={createGroup}>+ Ekle</button>
            </div>
            <div className="team-list">
              {groups.length === 0 ? <p className="empty-state">Henüz grup yok.</p> : groups.map(group => (
                <div key={group.id} className="team-item">
                  <span>🏷️ {group.name}</span>
                  <button className="btn-danger" onClick={() => deleteGroup(group.id)}>Sil</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'users' && (
          <div className="team-section">
            <div className="add-user-form">
              <input placeholder="Ad Soyad *" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
              <input placeholder="Email *" type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              <input placeholder="Şifre *" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
              <select value={newUser.groupId} onChange={e => setNewUser({...newUser, groupId: e.target.value})}>
                <option value="">Grup Seç *</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button className="btn-primary" onClick={createUser} disabled={loading}>
                {loading ? 'Oluşturuluyor...' : '+ Kullanıcı Ekle'}
              </button>
            </div>
            <div className="team-list">
              {users.filter(u => !u.isSuperAdmin).length === 0 
                ? <p className="empty-state">Henüz kullanıcı yok.</p>
                : users.filter(u => !u.isSuperAdmin).map(user => (
                  <div key={user.id} className="team-item">
                    <div>
                      <span className="fw-bold">{user.name}</span>
                      <span className="user-role-tag"> ({user.role})</span>
                    </div>
                    <span className="user-email-small">{user.email}</span>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}