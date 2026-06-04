import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Profile from './pages/Profile';
import NotificationsPage from './pages/NotificationsPage';
import BottomNav from './components/BottomNav';
import './index.css';

function PrivateRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const { currentUser } = useAuth();
  return !currentUser ? children : <Navigate to="/" />;
}

function ThemeToggle() {
  const [theme, setTheme] = React.useState(localStorage.getItem('theme') || 'light');
  
  React.useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        background: 'var(--primary-gradient)',
        color: '#fff',
        border: 'none',
        borderRadius: '50%',
        width: 48,
        height: 48,
        fontSize: 22,
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(99, 102, 241, 0.35)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      title="Temayı Değiştir"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}

function AppRoutes() {
  React.useEffect(() => {
    if (!window.visualViewport) {
      // Fallback for browsers without visualViewport API
      const handleFocusIn = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
          document.body.classList.add('keyboard-open');
        }
      };
      const handleFocusOut = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
          document.body.classList.remove('keyboard-open');
        }
      };
      document.addEventListener('focusin', handleFocusIn);
      document.addEventListener('focusout', handleFocusOut);
      return () => {
        document.removeEventListener('focusin', handleFocusIn);
        document.removeEventListener('focusout', handleFocusOut);
      };
    }

    const handleResize = () => {
      // If visual viewport is significantly smaller than screen height, keyboard is open
      if (window.visualViewport.height < window.screen.availHeight * 0.8) {
        document.body.classList.add('keyboard-open');
      } else {
        document.body.classList.remove('keyboard-open');
      }
    };
    
    window.visualViewport.addEventListener('resize', handleResize);
    handleResize(); // Check initially
    
    return () => window.visualViewport.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/" element={<PrivateRoute><Projects /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/project/:projectId" element={<PrivateRoute><ProjectDetail /></PrivateRoute>} />
        <Route path="/notifications" element={<PrivateRoute><NotificationsPage /></PrivateRoute>} />
      </Routes>
      <ThemeToggle />
      <BottomNav />
    </>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error(error, errorInfo); }
  render() {
    if (this.state.hasError) return <div style={{padding: 20, textAlign: 'center'}}><h1 style={{color: 'var(--text-main)'}}>Beklenmeyen bir hata oluştu</h1><p style={{color: '#64748b'}}>Lütfen sayfayı yenileyin.</p><button onClick={() => window.location.reload()} style={{marginTop: 16, padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--primary-gradient, #6366f1)', color: '#fff', cursor: 'pointer', fontSize: 14}}>Sayfayı Yenile</button></div>;
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}