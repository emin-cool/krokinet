/* eslint-disable react-hooks/exhaustive-deps */
// Proje ekip sekmesi — MOBİL `ProjectTeamTab.js` + `AddWorkerModal.js` ile aynı
// veri modeli. Üyelik proje dokümanındaki memberIds / memberRoles / memberMeta
// üzerinden tutulur; eski global `groups` koleksiyonu ARTIK KULLANILMAZ.
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import {
  collection, query, where, doc, onSnapshot, updateDoc, deleteDoc,
  arrayRemove, deleteField, getDocs, documentId,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { createWorkerAccount, updateWorkerMeta, slugifyName, EMAIL_DOMAIN } from '../utils/teamAuth';
import { CATEGORIES, colorFor } from '../utils/constants';
import { UserMinus, UserPlus, Pencil, X, Check, Copy, Shield, HardHat } from 'lucide-react';

const TITLE_PRESETS = [
  'Şantiye Şefi', 'Saha Mühendisi', 'Mimar', 'İnşaat Müh.',
  'Elektrik Müh.', 'Makine Müh.', 'Formen', 'Usta', 'Kalfa',
  'İşçi', 'Tekniker', 'Taşeron',
];

export default function ProjectTeam({ projectId, isManager }) {
  const { currentUser } = useAuth();
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMember, setEditMember] = useState(null);

  // Proje dokümanına canlı abonelik
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'projects', projectId), snap => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [projectId]);

  // Üyeleri publicProfiles'tan getir (users yalnız sahibi tarafından okunabilir)
  const fetchMembers = async () => {
    const ids = project?.memberIds || [];
    if (ids.length === 0) { setMembers([]); setLoading(false); return; }
    try {
      const chunks = [];
      for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
      const snaps = await Promise.all(
        chunks.map(chunk =>
          getDocs(query(collection(db, 'publicProfiles'), where(documentId(), 'in', chunk)))
        )
      );
      setMembers(snaps.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() }))));
    } catch (err) {
      console.error('Ekip üyeleri getirilemedi:', err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchMembers(); }, [JSON.stringify(project?.memberIds), JSON.stringify(project?.memberMeta)]);

  const managers = members.filter(m => project?.memberRoles?.[m.id] === 'manager' || project?.managerId === m.id);
  const workers  = members.filter(m => project?.memberRoles?.[m.id] !== 'manager' && project?.managerId !== m.id);

  const removeUser = async (userId, role) => {
    if (!isManager) return;
    if (!window.confirm('Bu kişiyi projeden çıkarmak istediğinize emin misiniz?')) return;
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        memberIds: arrayRemove(userId),
        [`memberRoles.${userId}`]: deleteField(),
        [`memberMeta.${userId}`]: deleteField(),
      });
    } catch (e) {
      console.error('Üye çıkarılamadı:', e);
      alert('Üye çıkarılırken bir sorun oluştu.');
      return;
    }
    // Yönetici hesapları silinmez; çalışanlar başka projede kalmadıysa tamamen silinir.
    if (role === 'manager') { fetchMembers(); return; }
    try {
      const remaining = await getDocs(query(
        collection(db, 'projects'),
        where('managerId', '==', currentUser.uid),
        where('memberIds', 'array-contains', userId),
      ));
      if (remaining.empty) {
        await deleteDoc(doc(db, 'users', userId)).catch(() => {});
        await deleteDoc(doc(db, 'publicProfiles', userId)).catch(() => {});
      }
    } catch (e) {
      console.error('Çıkarılan çalışan silinemedi (proje üyeliği zaten kaldırıldı):', e);
    }
    fetchMembers();
  };

  const openEdit = (m, role) => {
    if (!isManager) return;
    setEditMember({ ...m, role, meta: project?.memberMeta?.[m.id] || {} });
    setShowModal(true);
  };
  const openCreate = () => { setEditMember(null); setShowModal(true); };

  if (loading) return <div className="loading" style={{ padding: 24 }}>Yükleniyor...</div>;

  const MemberCard = ({ m, role }) => {
    const meta = project?.memberMeta?.[m.id] || {};
    return (
      <div
        onClick={() => openEdit(m, role)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-card)',
          padding: 12, borderRadius: 12, marginBottom: 12, border: '1px solid var(--border-color)',
          cursor: isManager ? 'pointer' : 'default',
        }}
      >
        <div style={{ width: 48, height: 48, borderRadius: 24, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', fontWeight: 800, fontSize: 18 }}>
          {m.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)' }}>
            {m.name} {role === 'manager' ? '👑' : '👷'}
            {meta.mahlas ? <span style={{ fontSize: 13, fontWeight: 500, color: '#6366f1' }}>  ·  "{meta.mahlas}"</span> : null}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{meta.title || (role === 'manager' ? 'Yönetici' : 'Personel')}</div>
          {meta.groups?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
              {meta.groups.map(g => (
                <span key={g} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, color: colorFor(g), background: colorFor(g) + '22' }}>{g}</span>
              ))}
            </div>
          )}
        </div>
        {isManager && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => openEdit(m, role)} title="Düzenle" style={{ padding: 8, background: '#eef2ff', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#4f46e5', display: 'flex' }}>
              <Pencil size={16} />
            </button>
            {m.id !== currentUser?.uid && (
              <button onClick={() => removeUser(m.id, role)} title="Çıkar" style={{ padding: 8, background: '#fee2e2', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                <UserMinus size={18} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--primary-color)' }}>Yöneticiler ({managers.length})</h3>
      </div>
      {managers.length === 0 && <p className="empty-state">Yönetici atanmamış.</p>}
      {managers.map(m => <MemberCard key={m.id} m={m} role="manager" />)}

      <div style={{ height: 1, background: 'var(--border-color)', margin: '20px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--primary-color)' }}>Çalışanlar ({workers.length})</h3>
        {isManager && (
          <button className="btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <UserPlus size={16} /> Yeni Çalışan
          </button>
        )}
      </div>
      {workers.length === 0 && <p className="empty-state">Çalışan yok. Eklemek için "Yeni Çalışan" butonuna basın.</p>}
      {workers.map(m => <MemberCard key={m.id} m={m} role="worker" />)}

      {showModal && (
        <WorkerModal
          projectId={projectId}
          editMember={editMember}
          onClose={() => setShowModal(false)}
          onSaved={fetchMembers}
        />
      )}
    </div>
  );
}

// ── Çalışan oluştur / düzenle modalı (MOBİL AddWorkerModal karşılığı) ──
function WorkerModal({ projectId, editMember, onClose, onSaved }) {
  const isEdit = !!editMember;
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [mahlas, setMahlas] = useState('');
  const [role, setRole] = useState('worker');
  const [titleSel, setTitleSel] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [groups, setGroups] = useState([]);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  useEffect(() => {
    if (editMember) {
      const m = editMember.meta || {};
      setName((editMember.name || '').split(' ')[0] || '');
      setSurname((editMember.name || '').split(' ').slice(1).join(' '));
      setMahlas(m.mahlas || '');
      setRole(editMember.role || 'worker');
      if (m.title && !TITLE_PRESETS.includes(m.title)) { setTitleSel('Diğer'); setCustomTitle(m.title); }
      else { setTitleSel(m.title || ''); setCustomTitle(''); }
      setGroups(m.groups || []);
    }
  }, [editMember]);

  const usernamePreview = useMemo(() => slugifyName(`${name}${surname}`), [name, surname]);
  const finalTitle = titleSel === 'Diğer' ? customTitle.trim() : titleSel;
  const toggleGroup = (label) => setGroups(prev => prev.includes(label) ? prev.filter(g => g !== label) : [...prev, label]);

  const handleSave = async () => {
    setError('');
    if (!name.trim() || !surname.trim()) { setError('Ad ve soyad zorunludur.'); return; }
    if (groups.length === 0) { setError('En az bir ilgi grubu seçin.'); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await updateWorkerMeta({ projectId, uid: editMember.id, mahlas: mahlas.trim(), title: finalTitle, role, groups });
        onSaved?.(); onClose(); return;
      }
      const pw = password.trim();
      if (pw.length < 6) { setError('Şifre en az 6 karakter olmalı.'); setSaving(false); return; }
      const res = await createWorkerAccount({
        projectId, name: name.trim(), surname: surname.trim(),
        mahlas: mahlas.trim(), title: finalTitle, role, groups, password: pw,
      });
      onSaved?.();
      setCreated({ username: res.username, password: pw });
    } catch (e) {
      console.error('Çalışan kaydı hatası:', e);
      setError(e?.code === 'auth/email-already-in-use'
        ? 'Bu kullanıcı adı zaten kullanımda. Mahlası/ismi değiştirip tekrar deneyin.'
        : (e?.message || 'Çalışan eklenemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-main)', fontSize: 15 };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, marginTop: 14 };

  if (created) {
    return (
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 36, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px auto 16px' }}>
            <Check size={40} color="#10b981" />
          </div>
          <h2 style={{ margin: 0 }}>Çalışan oluşturuldu!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>Bu bilgileri çalışana iletin. İlk girişten sonra şifresini değiştirebilir.</p>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border-color)', margin: '20px 0', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>Kullanıcı adı</span>
              <span style={{ fontWeight: 800 }}>{created.username}</span>
            </div>
            <div style={{ height: 1, background: 'var(--border-color)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>Şifre</span>
              <span style={{ fontWeight: 800 }}>{created.password}</span>
            </div>
          </div>
          <button className="btn-secondary" onClick={() => navigator.clipboard?.writeText(`Kullanıcı adı: ${created.username}\nŞifre: ${created.password}`)} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 auto 12px' }}>
            <Copy size={18} /> Bilgileri Kopyala
          </button>
          <button className="btn-primary" onClick={onClose} style={{ width: '100%' }}>Tamam</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{isEdit ? 'Çalışanı Düzenle' : 'Yeni Çalışan'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 8 }}>
          {error && <p style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Ad</label>
              <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Abdullah" disabled={isEdit} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Soyad</label>
              <input style={inputStyle} value={surname} onChange={e => setSurname(e.target.value)} placeholder="Emin" disabled={isEdit} />
            </div>
          </div>
          {isEdit && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Ad-soyad ve kullanıcı adı değiştirilemez.</p>}

          {!isEdit && usernamePreview && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, background: '#eef2ff', borderRadius: 12, padding: '10px 14px', marginTop: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', flex: 1 }}>Kullanıcı adı</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#4338ca' }}>{usernamePreview}</span>
              <span style={{ fontSize: 12, color: '#818cf8' }}>@{EMAIL_DOMAIN}</span>
            </div>
          )}

          <label style={labelStyle}>Mahlas (takma ad)</label>
          <input style={inputStyle} value={mahlas} onChange={e => setMahlas(e.target.value)} placeholder="Sohbette görünecek isim" />

          <label style={labelStyle}>Yetki Seviyesi</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setRole('worker')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 12, border: '1px solid var(--border-color)', cursor: 'pointer', background: role === 'worker' ? '#4f46e5' : 'var(--bg-card)', color: role === 'worker' ? '#fff' : 'var(--text-muted)', fontWeight: 700 }}>
              <HardHat size={18} /> Çalışan
            </button>
            <button onClick={() => setRole('manager')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 12, border: '1px solid var(--border-color)', cursor: 'pointer', background: role === 'manager' ? '#0891b2' : 'var(--bg-card)', color: role === 'manager' ? '#fff' : 'var(--text-muted)', fontWeight: 700 }}>
              <Shield size={18} /> Yönetici
            </button>
          </div>

          <label style={labelStyle}>Görev / Ünvan</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[...TITLE_PRESETS, 'Diğer'].map(t => (
              <button key={t} onClick={() => setTitleSel(t)} style={{ padding: '8px 13px', borderRadius: 20, border: '1px solid var(--border-color)', cursor: 'pointer', background: titleSel === t ? '#1e293b' : 'var(--bg-card)', color: titleSel === t ? '#fff' : 'var(--text-muted)', fontWeight: 600, fontSize: 13 }}>{t}</button>
            ))}
          </div>
          {titleSel === 'Diğer' && (
            <input style={{ ...inputStyle, marginTop: 8 }} value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Görev/ünvan yazın" />
          )}

          <label style={labelStyle}>İlgi Grupları (bildirim alacağı alanlar)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(g => {
              const on = groups.includes(g.key);
              return (
                <button key={g.key} onClick={() => toggleGroup(g.key)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 13px', borderRadius: 20, border: `1px solid ${on ? g.color : 'var(--border-color)'}`, cursor: 'pointer', background: on ? g.color : 'var(--bg-card)', color: on ? '#fff' : 'var(--text-muted)', fontWeight: 700, fontSize: 13 }}>
                  {on && <Check size={13} />} {g.key}
                </button>
              );
            })}
          </div>

          {!isEdit && (
            <>
              <label style={labelStyle}>Başlangıç Şifresi</label>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Çalışana ileteceğiniz ilk şifre (en az 6 karakter). İlk girişten sonra değiştirebilir.</p>
              <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="En az 6 karakter" />
            </>
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-secondary" onClick={onClose}>İptal</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={18} /> {saving ? 'Kaydediliyor...' : (isEdit ? 'Kaydet' : 'Çalışan Oluştur')}
          </button>
        </div>
      </div>
    </div>
  );
}
