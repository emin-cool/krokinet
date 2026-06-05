/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { updatePassword, signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, User, Mail, Phone, MapPin, Award, Lock, Bell, ChevronRight, Briefcase, Clock, CheckCircle2, Shield, Folder } from 'lucide-react';

export default function Profile() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [name, setName] = useState(userData?.name || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(false);

  useEffect(() => { if (userData?.name && !name) setName(userData.name); }, [userData]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!name.trim()) return alert('İsim alanı boş olamaz.');
    setLoading(true); setMessage(''); setError('');
    try {
      if (name !== userData?.name) {
        await updateDoc(doc(db, 'users', currentUser.uid), { name });
      }
      setMessage('Profiliniz güncellendi!');
      setTimeout(() => { setShowEditModal(false); setMessage(''); }, 1500);
    } catch (err) {
      setError('Hata: ' + err.message);
    }
    setLoading(false);
  }

  async function handleSavePassword(e) {
    e.preventDefault();
    if (password !== confirmPassword) return setError('Şifreler eşleşmiyor!');
    if (password.length < 6) return setError('Şifre en az 6 karakter olmalı.');
    setLoading(true); setMessage(''); setError('');
    try {
      await updatePassword(currentUser, password);
      await updateDoc(doc(db, 'users', currentUser.uid), { tempPassword: deleteField() });
      setMessage('Şifreniz başarıyla değiştirildi!');
      setPassword(''); setConfirmPassword('');
      setTimeout(() => { setShowPasswordModal(false); setMessage(''); }, 1500);
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') setError('Güvenlik gereği yeniden giriş yapmalısınız.');
      else setError('Hata: ' + err.message);
    }
    setLoading(false);
  }

  const avatarInitial = (userData?.name || 'K').charAt(0).toUpperCase();

  const ToggleSwitch = ({ checked, onChange }) => (
    <div 
      onClick={() => onChange(!checked)}
      style={{ 
        width: 44, height: 24, borderRadius: 12, 
        background: checked ? '#4f46e5' : '#e2e8f0',
        position: 'relative', cursor: 'pointer', transition: 'background 0.3s'
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 2, left: checked ? 22 : 2,
        transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#475569' }}
            title="Geri Dön"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>Profilim</h1>
          </div>
        </div>
        <button onClick={() => signOut(auth)} style={{ padding: '8px 16px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Çıkış Yap</button>
      </div>

      <div style={{ flex: 1, padding: '32px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        
        {/* Header Card */}
        <div style={{ background: '#fff', borderRadius: '24px', padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '300px', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(79, 70, 229, 0.05))' }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', zIndex: 1 }}>
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '40px', fontWeight: 800, boxShadow: '0 8px 16px rgba(79, 70, 229, 0.2)', border: '4px solid #fff' }}>
              {avatarInitial}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>{userData?.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontWeight: 500 }}>
                <Briefcase size={18} />
                {userData?.role || 'Kullanıcı'}
              </div>
            </div>
          </div>
          
          <button onClick={() => setShowEditModal(true)} style={{ zIndex: 1, padding: '12px 24px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '30px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)' }}>
            Profili Düzenle
          </button>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '24px' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '16px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
              <Folder size={28} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>12</div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Aktif Projeler</div>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '16px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <Clock size={28} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>3</div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Sistemdeki Yılı</div>
            </div>
          </div>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '16px', background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
              <Award size={28} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>5</div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Sertifikalar</div>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
          
          {/* Personal Info */}
          <div style={{ background: '#fff', padding: '32px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '18px', color: '#0f172a', margin: '0 0 24px 0', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <User size={20} color="#4f46e5" />
              Kişisel Bilgiler
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>E-Posta Adresi</div>
                <div style={{ color: '#1e293b', fontWeight: 500 }}>{currentUser?.email}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>Telefon Numarası</div>
                <div style={{ color: '#1e293b', fontWeight: 500 }}>+90 (555) 019 28 34</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700, marginBottom: '6px' }}>Konum</div>
                <div style={{ color: '#1e293b', fontWeight: 500 }}>İstanbul, TR</div>
              </div>
            </div>
          </div>

          {/* Professional Credentials */}
          <div style={{ background: '#fff', padding: '32px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '18px', color: '#0f172a', margin: '0 0 24px 0', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <Award size={20} color="#4f46e5" />
              Mesleki Belgeler
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <CheckCircle2 size={20} color="#0ea5e9" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ color: '#0f172a', fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>PMP Certification</div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>Project Management Institute</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <CheckCircle2 size={20} color="#0ea5e9" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ color: '#0f172a', fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>İş Sağlığı ve Güvenliği Sertifikası</div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>Çalışma Bakanlığı</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <CheckCircle2 size={20} color="#0ea5e9" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ color: '#0f172a', fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>İleri Düzey Şantiye Yönetimi</div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>İMO</div>
                </div>
              </div>
            </div>
          </div>

          {/* Security & Privacy */}
          <div style={{ background: '#fff', padding: '32px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '18px', color: '#0f172a', margin: '0 0 24px 0', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <Lock size={20} color="#4f46e5" />
              Güvenlik ve Gizlilik
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div 
                onClick={() => setShowPasswordModal(true)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: '12px', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ color: '#1e293b', fontWeight: 600, fontSize: '14px' }}>Şifre Değiştir</div>
                <ChevronRight size={18} color="#94a3b8" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: '12px' }}>
                <div style={{ color: '#1e293b', fontWeight: 600, fontSize: '14px' }}>İki Aşamalı Doğrulama (2FA)</div>
                <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>Aktif</div>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div style={{ background: '#fff', padding: '32px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '18px', color: '#0f172a', margin: '0 0 24px 0', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <Bell size={20} color="#4f46e5" />
              Bildirimler
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#1e293b', fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>E-Posta Uyarıları</div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>Günlük proje özetleri</div>
                </div>
                <ToggleSwitch checked={emailAlerts} onChange={setEmailAlerts} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#1e293b', fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>Anlık Bildirimler (Push)</div>
                  <div style={{ color: '#64748b', fontSize: '12px' }}>Kritik şantiye güncellemeleri</div>
                </div>
                <ToggleSwitch checked={pushAlerts} onChange={setPushAlerts} />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '20px' }}>Profili Düzenle</h2>
            {message && <div style={{ background: '#dcfce7', color: '#166534', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{message}</div>}
            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}
            
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>Ad Soyad</label>
                <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>İptal</button>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '20px' }}>Şifre Değiştir</h2>
            {message && <div style={{ background: '#dcfce7', color: '#166534', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{message}</div>}
            {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}
            
            <form onSubmit={handleSavePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>Yeni Şifre</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="En az 6 karakter" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>Yeni Şifre Tekrar</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowPasswordModal(false)} style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>İptal</button>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Şifreyi Güncelle</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
