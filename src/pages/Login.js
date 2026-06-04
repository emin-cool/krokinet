/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
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
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setTimeout(() => setLockoutSeconds(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [lockoutSeconds]);

  const isLockedOut = lockoutSeconds > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (isLockedOut) return;
    setError('');
    setLoading(true);
    try {
      const emailAddress = username.includes('@') ? username : `${username.toLowerCase().replace(/\s+/g, '')}@insaat-app.com`;
      await signInWithEmailAndPassword(auth, emailAddress, password);
      setFailedAttempts(0);
      navigate('/');
    } catch {
      const newCount = failedAttempts + 1;
      setFailedAttempts(newCount);
      if (newCount >= 3) {
        setLockoutSeconds(30);
        setFailedAttempts(0);
        setError('Çok fazla başarısız deneme. Lütfen 30 saniye bekleyin.');
      } else {
        setError('Kullanıcı adı veya şifre hatalı.');
      }
    }
    setLoading(false);
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', gap: '12px' }}>
          <div className="app-logo-container" style={{ width: '84px', height: '84px', borderRadius: '22px', boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)' }}>
            <img src="/logo.png" alt="Yapı Chat Logo" />
          </div>
          <h1 className="app-logo-text">Yapı Chat</h1>
        </div>
        <p>Hesabınıza giriş yapın</p>
        {error && <div className="error-msg">{error}</div>}
        {isLockedOut && <div className="error-msg">{lockoutSeconds} saniye sonra tekrar deneyebilirsiniz.</div>}
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
          <button type="submit" disabled={loading || isLockedOut}>
            {isLockedOut ? `Kilitlendi (${lockoutSeconds}s)` : loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}