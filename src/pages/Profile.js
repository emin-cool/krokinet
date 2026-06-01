import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { updatePassword, signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { Building, ArrowLeft } from 'lucide-react';

export default function Profile() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState(userData?.name || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (password && password !== confirmPassword) {
      setError('Şifreler eşleşmiyor!');
      setLoading(false);
      return;
    }

    try {
      // İsmi güncelle
      if (name !== userData?.name) {
        await updateDoc(doc(db, 'users', currentUser.uid), { name });
      }

      // Şifreyi güncelle
      if (password) {
        if (password.length < 6) {
          setError('Şifre en az 6 karakter olmalıdır.');
          setLoading(false);
          return;
        }
        await updatePassword(currentUser, password);
        await updateDoc(doc(db, 'users', currentUser.uid), { tempPassword: deleteField() });
      }

      setMessage('Profiliniz başarıyla güncellendi!');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setError('Şifre değiştirmek için lütfen çıkış yapıp tekrar giriş yapın (Güvenlik gereği).');
      } else {
        setError('Bir hata oluştu: ' + err.message);
      }
    }
    
    setLoading(false);
  }

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="app-logo-container" style={{ width: '56px', height: '56px' }}>
            <img src="/logo.png" alt="Yapı Chat Logo" />
          </div>
          <div>
            <h1 className="app-logo-text" style={{ margin: 0 }}>Yapı Chat</h1>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Ana Sayfaya Dön</p>
          </div>
        </div>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => signOut(auth)}>Çıkış</button>
        </div>
      </div>

      <div style={{ flex: 1, padding: 32, display: 'flex', justifyContent: 'center' }}>
        <div style={{ background: 'var(--bg-card)', padding: 36, borderRadius: 16, width: '100%', maxWidth: 500, height: 'fit-content', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
          <h2 style={{ color: 'var(--text-main)', marginBottom: 28 }}>Profil Ayarları</h2>
          
          {message && <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: 14, borderRadius: 10, marginBottom: 16, fontSize: '0.875rem', fontWeight: 600 }}>{message}</div>}
          {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: 14, borderRadius: 10, marginBottom: 16, fontSize: '0.875rem', fontWeight: 600 }}>{error}</div>}
          
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: 8, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ad Soyad</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                style={{ width: '100%', padding: '14px 18px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-card-hover)', color: 'var(--text-main)', fontSize: '0.9375rem', outline: 'none', fontFamily: 'inherit' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: 8, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Unvan / Rol</label>
              <input 
                type="text" 
                value={userData?.role || ''} 
                disabled
                style={{ width: '100%', padding: '14px 18px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-card-hover)', color: 'var(--text-muted)', cursor: 'not-allowed', fontSize: '0.9375rem', fontFamily: 'inherit' }}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', marginTop: 6, display: 'block' }}>Unvanınızı proje yöneticileri değiştirebilir.</small>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: 8, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Yeni Şifre (Değiştirmek istemiyorsanız boş bırakın)</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="En az 6 karakter"
                style={{ width: '100%', padding: '14px 18px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-card-hover)', color: 'var(--text-main)', fontSize: '0.9375rem', fontFamily: 'inherit' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: 8, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Yeni Şifre Tekrar</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                style={{ width: '100%', padding: '14px 18px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-card-hover)', color: 'var(--text-main)', fontSize: '0.9375rem', fontFamily: 'inherit' }}
              />
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              disabled={loading}
              style={{ marginTop: 8, padding: '14px', fontSize: '0.9375rem' }}
            >
              {loading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
