import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { updatePassword, signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { Building } from 'lucide-react';

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
      <div className="projects-top-header">
        <div className="projects-top-left" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px' }} onClick={() => navigate('/')}>
          <img src="/logo.png" alt="KrokiNet Logo" style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
          <div>
            <h1>KrokiNet</h1>
            <p>Ana Sayfaya Dön</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => signOut(auth)}>Çıkış</button>
        </div>
      </div>

      <div style={{ flex: 1, padding: 24, display: 'flex', justifyContent: 'center' }}>
        <div style={{ background: '#1e293b', padding: 32, borderRadius: 12, width: '100%', maxWidth: 500, height: 'fit-content', border: '1px solid #334155' }}>
          <h2 style={{ color: '#fff', marginBottom: 24 }}>Profil Ayarları</h2>
          
          {message && <div style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', padding: 12, borderRadius: 6, marginBottom: 16 }}>{message}</div>}
          {error && <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: 12, borderRadius: 6, marginBottom: 16 }}>{error}</div>}
          
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', marginBottom: 8, fontSize: 13 }}>Ad Soyad</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', marginBottom: 8, fontSize: 13 }}>Unvan / Rol</label>
              <input 
                type="text" 
                value={userData?.role || ''} 
                disabled
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#64748b', cursor: 'not-allowed' }}
              />
              <small style={{ color: '#64748b', fontSize: 11, marginTop: 4, display: 'block' }}>Unvanınızı proje yöneticileri değiştirebilir.</small>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #334155', margin: '8px 0' }} />

            <div>
              <label style={{ display: 'block', color: '#94a3b8', marginBottom: 8, fontSize: 13 }}>Yeni Şifre (Değiştirmek istemiyorsanız boş bırakın)</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="En az 6 karakter"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', marginBottom: 8, fontSize: 13 }}>Yeni Şifre Tekrar</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#fff' }}
              />
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              disabled={loading}
              style={{ marginTop: 16, padding: '12px', fontSize: 15 }}
            >
              {loading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
