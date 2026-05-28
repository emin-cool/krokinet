import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Building } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const emailAddress = username.includes('@') ? username : `${username.toLowerCase().replace(/\s+/g, '')}@insaat-app.com`;
      await signInWithEmailAndPassword(auth, emailAddress, password);
      navigate('/');
    } catch {
      setError('Kullanıcı adı veya şifre hatalı.');
    }
    setLoading(false);
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <img src="/logo.png" alt="KrokiNet Logo" style={{ width: '80px', height: '80px', borderRadius: '16px', objectFit: 'cover' }} />
        </div>
        <h1>KrokiNet</h1>
        <p>Hesabınıza giriş yapın</p>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input
            placeholder="Kullanıcı Adı"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}