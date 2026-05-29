import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, doc, setDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
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

export default function ProjectTeam({ projectId, isManager }) {
  const [groups, setGroups] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  const [project, setProject] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', groupId: '', customTitle: '' });
  const [selectedRole, setSelectedRole] = useState('worker');
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('members');

  useEffect(() => { 
    const unsubGroups = onSnapshot(collection(db, 'groups'), snap => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubProject = onSnapshot(doc(db, 'projects', projectId), snap => {
      if (snap.exists()) {
        const projectData = { id: snap.id, ...snap.data() };
        setProject(projectData);
      }
    });

    return () => {
      unsubGroups();
      unsubUsers();
      unsubProject();
    };
  }, [projectId]);

  useEffect(() => {
    if (project && allUsers.length > 0) {
      const memberIds = project.memberIds || [];
      setProjectMembers(allUsers.filter(u => memberIds.includes(u.id)));
    }
  }, [project, allUsers]);

  async function createGroup() {
    if (!newGroupName.trim()) return;
    await addDoc(collection(db, 'groups'), { name: newGroupName.trim(), createdAt: serverTimestamp() });
    setNewGroupName('');
  }

  async function createUserAndAdd() {
    if (!newUser.name) {
      alert('Ad Soyad alanı zorunludur'); return;
    }
    setLoading(true);
    
    // Auto-generate username & password
    const safeName = newUser.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const autoUsername = safeName + Math.floor(Math.random() * 1000);
    const autoPassword = "insaat" + Math.floor(Math.random() * 900 + 100);
    try {
      const selectedGroup = groups.find(g => g.id === newUser.groupId);
      const finalTitle = newUser.customTitle.trim() || selectedGroup?.name || '';
      const email = `${autoUsername}@insaat-app.com`;
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, autoPassword);
      const uid = userCred.user.uid;
      await setDoc(doc(db, 'users', uid), {
        name: newUser.name,
        username: autoUsername,
        email,
        role: finalTitle,
        groupId: newUser.groupId,
        isSuperAdmin: false,
        tempPassword: autoPassword
      });
      await updateDoc(doc(db, 'projects', projectId), {
        memberIds: arrayUnion(uid),
        [`memberRoles.${uid}`]: selectedRole
      });
      await secondaryAuth.signOut();
      setNewUser({ name: '', username: '', password: '', groupId: '', customTitle: '' });
      setSelectedRole('worker');
      alert(`Kullanıcı başarıyla oluşturuldu!\n\nKullanıcı Adı: ${autoUsername}\nGeçici Şifre: ${autoPassword}\n\nLütfen bu bilgileri kullanıcıyla paylaşın. Kullanıcı profilinden şifresini değiştirebilir.`);
    } catch (err) { alert('Hata: ' + err.message); }
    setLoading(false);
  }

  async function addExistingUser(userId) {
    await updateDoc(doc(db, 'projects', projectId), {
      memberIds: arrayUnion(userId),
      [`memberRoles.${userId}`]: selectedRole
    });
  }

  async function removeUser(userId) {
    if (!window.confirm('Bu kullanıcıyı projeden çıkarmak istiyor musunuz?')) return;
    const projectRef = doc(db, 'projects', projectId);
    await updateDoc(projectRef, { 
      memberIds: arrayRemove(userId),
      [`memberRoles.${userId}`]: null // Roles will be cleaned up slightly, technically firebase requires deleteField() but null is fine to unset logic
    });
  }

  const nonMembers = allUsers.filter(u => !u.isSuperAdmin && !(project?.memberIds || []).includes(u.id));

  const managers = projectMembers.filter(m => project?.memberRoles?.[m.id] === 'manager' || project?.managerId === m.id);
  const workers = projectMembers.filter(m => project?.memberRoles?.[m.id] !== 'manager' && project?.managerId !== m.id);

  const RoleSelector = () => (
    <div className="permissions-box" style={{ marginBottom: 16 }}>
      <p style={{fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 8}}>Proje Yetkisi (Rol):</p>
      <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', width: '100%', fontSize: 14, background: 'var(--bg-card)', color: 'var(--text-main)' }}>
        <option value="worker">Çalışan (Sadece sohbet eder ve görüntüler)</option>
        <option value="manager">Yönetici (Pin ekler/siler, ekibi yönetir)</option>
      </select>
    </div>
  );

  return (
    <div className="team-view">
      <div className="floor-tabs" style={{ padding: '16px 24px 0' }}>
        <button className={activeSection === 'members' ? 'floor-tab active' : 'floor-tab'} onClick={() => setActiveSection('members')}>👥 Üyeler</button>
        {isManager && <button className={activeSection === 'add' ? 'floor-tab active' : 'floor-tab'} onClick={() => setActiveSection('add')}>➕ Üye Ekle</button>}
        {isManager && <button className={activeSection === 'groups' ? 'floor-tab active' : 'floor-tab'} onClick={() => setActiveSection('groups')}>🏷️ Gruplar</button>}
      </div>

      <div style={{ padding: '16px 24px' }}>
        {activeSection === 'members' && (
          <div className="members-list">
            {projectMembers.length === 0 ? (
              <p className="empty-state">Henüz üye yok.</p>
            ) : (
              <>
                {managers.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ color: 'var(--primary-color)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>👑 Yöneticiler</h4>
                    {managers.map(member => (
                      <div key={member.id} className="member-item">
                        <div className="member-avatar">{member.name?.charAt(0)?.toUpperCase()}</div>
                        <div className="member-info">
                          <span className="member-name">{member.name}</span>
                          <span className="member-role">{member.role || 'Yönetici'}</span>
                        </div>
                        {isManager && project?.managerId !== member.id && <button className="btn-danger" onClick={() => removeUser(member.id)}>Çıkar</button>}
                      </div>
                    ))}
                  </div>
                )}
                {workers.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h4 style={{ color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: 6 }}>👷 Çalışanlar</h4>
                    </div>

                    {isManager && (
                      <div style={{ overflowX: 'auto', marginBottom: 24, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(59, 130, 246, 0.1)' }}>
                              <th style={{ padding: '10px 16px', color: '#94a3b8', fontWeight: 600 }}>Ad Soyad</th>
                              <th style={{ padding: '10px 16px', color: '#94a3b8', fontWeight: 600 }}>Ünvan</th>
                              <th style={{ padding: '10px 16px', color: '#94a3b8', fontWeight: 600 }}>Kullanıcı Adı</th>
                              <th style={{ padding: '10px 16px', color: '#94a3b8', fontWeight: 600 }}>Şifre</th>
                              <th style={{ padding: '10px 16px', color: '#94a3b8', fontWeight: 600, textAlign: 'right' }}>İşlem</th>
                            </tr>
                          </thead>
                          <tbody>
                            {workers.map(member => (
                              <tr key={member.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '10px 16px' }}>{member.name}</td>
                                <td style={{ padding: '10px 16px', color: '#94a3b8' }}>{member.role || 'Çalışan'}</td>
                                <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: '#3b82f6' }}>{member.username}</td>
                                <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>
                                  {member.tempPassword ? member.tempPassword : <span style={{color: '#10b981', fontSize: 11}}>Kullanıcı değiştirdi</span>}
                                </td>
                                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                  <button onClick={() => removeUser(member.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>Çıkar</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {!isManager && workers.map(member => (
                      <div key={member.id} className="member-item">
                        <div className="member-avatar" style={{ background: '#94a3b8' }}>{member.name?.charAt(0)?.toUpperCase()}</div>
                        <div className="member-info">
                          <span className="member-name">{member.name}</span>
                          <span className="member-role">{member.role || 'Çalışan'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeSection === 'add' && isManager && (
          <div>

            <h4 style={{ marginBottom: 12, color: '#94a3b8' }}>Hızlı Kullanıcı Oluştur</h4>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
              Kullanıcı adı ve şifre sistem tarafından otomatik oluşturulur.
            </p>
            <div className="add-user-form" style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
              <input placeholder="Ad Soyad *" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)', marginBottom: 12 }} />
              <input placeholder="(Opsiyonel) Özel Ünvan/Mahlas (Örn: Proje Müdürü)" value={newUser.customTitle} onChange={e => setNewUser({...newUser, customTitle: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)', marginBottom: 16 }} />
              
              <RoleSelector />
              <button className="btn-primary" onClick={createUserAndAdd} disabled={loading} style={{ width: '100%', marginTop: 8 }}>
                {loading ? 'Oluşturuluyor...' : 'Hızlı Oluştur ve Ekle'}
              </button>
            </div>
          </div>
        )}

        {activeSection === 'groups' && isManager && (
          <div>
            <div className="add-row">
              <input placeholder="Yeni grup adı (örn: Mimar Grubu)" value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createGroup()} />
              <button className="btn-primary" onClick={createGroup}>+ Ekle</button>
            </div>
            <div className="team-list">
              {groups.length === 0 ? <p className="empty-state">Henüz grup yok.</p> : groups.map(group => (
                <div key={group.id} className="team-item">
                  <span>🏷️ {group.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}