import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { User, Lock, ArrowRight, Fingerprint, Activity } from 'lucide-react';
import './Login.css';

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
      const uname = username.toLowerCase().replace(/\s+/g, '');
      if (username.includes('@')) {
        await signInWithEmailAndPassword(auth, username, password);
      } else {
        // Mobil ile ortak alan adı önce denenir; eski web hesapları için yedek.
        try {
          await signInWithEmailAndPassword(auth, `${uname}@santi.app`, password);
        } catch (err) {
          const code = err?.code || '';
          // Yalnızca "kullanıcı/kimlik bulunamadı" hatalarında diğer alan adını dene;
          // yanlış şifre gibi hatalarda ikinci denemeyle kilitlenmeyi tetiklemeyelim.
          if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/invalid-email') {
            await signInWithEmailAndPassword(auth, `${uname}@insaat-app.com`, password);
          } else {
            throw err;
          }
        }
      }
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
    <div className="login-wrapper">
      {/* Split Screen Container */}
      <div className="login-split">
        
        {/* Left Side (Image & Brand - Desktop Only) */}
        <div className="login-brand-panel">
          <div className="login-brand-overlay"></div>
          <div className="login-brand-content">
            <div className="brand-logo-text">
              <Activity size={32} /> Santi
            </div>
            <h1 className="brand-slogan">Projelerinizi<br/>Sahadan Yönetin.</h1>
            <p className="brand-desc">
              Modern şantiyeler için tasarlanmış, mimari hassasiyet ve saha uygulamasını birleştiren yüksek performanslı yönetim platformu.
            </p>
            
            <div className="brand-stats">
              <div>
                <h2>500+</h2>
                <span>AKTİF PROJE</span>
              </div>
              <div>
                <h2>%99.9</h2>
                <span>UPTIME</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side (Form) */}
        <div className="login-form-panel">
          <div className="login-form-container">
            {/* Mobile Logo */}
            <div className="mobile-logo-wrapper">
              <div className="mobile-logo-icon">
                <Activity size={24} color="#fff" />
              </div>
              <h2>Santi</h2>
            </div>

            <div className="login-header">
              <h2>Sisteme Giriş</h2>
              <p>Lütfen kimlik bilgilerinizi girin.</p>
            </div>

            {error && <div className="error-msg">{error}</div>}
            {isLockedOut && <div className="error-msg">{lockoutSeconds} saniye sonra tekrar deneyebilirsiniz.</div>}

            <form onSubmit={handleSubmit} className="santi-form">
              <div className="input-group">
                <label>Kullanıcı Adı</label>
                <div className="input-with-icon">
                  <User size={18} className="input-icon" />
                  <input
                    type="text"
                    placeholder="kullanici.adi"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Şifre</label>
                <div className="input-with-icon">
                  <Lock size={18} className="input-icon" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-options">
                <label className="checkbox-label">
                  <input type="checkbox" />
                  <span>Beni Hatırla</span>
                </label>
                <a href="#/" className="forgot-password">Şifremi Unuttum</a>
              </div>

              <button type="submit" className="btn-login" disabled={loading || isLockedOut}>
                {isLockedOut ? `Kilitlendi (${lockoutSeconds}s)` : loading ? 'Giriş yapılıyor...' : (
                  <>Giriş Yap <ArrowRight size={18} /></>
                )}
              </button>

              {/* Mobile Only Biometric */}
              <div className="mobile-biometric">
                <div className="divider"><span>VEYA</span></div>
                <button type="button" className="btn-biometric">
                  <Fingerprint size={32} />
                  <span>Biyometrik Giriş</span>
                </button>
              </div>

            </form>

            <p className="support-text">
              Sisteme erişimde sorun mu yaşıyorsunuz? <a href="#/">Destek ile iletişime geçin.</a>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}