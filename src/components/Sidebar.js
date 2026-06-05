import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FolderKanban, CalendarDays, TrendingUp, User, LogOut, Settings, HelpCircle, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export default function Sidebar() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();

  if (!currentUser) return null;

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Çıkış yapılamadı:', error);
    }
  };

  return (
    <div className="sidebar hide-on-mobile">
      <div className="sidebar-header">
        <div className="app-logo-container" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
          <img src="/logo.png" alt="Logo" />
        </div>
        <div className="sidebar-title">
          <h2>ConstructPro</h2>
          <p>Site Management</p>
        </div>
      </div>

      <div className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} end>
          <FolderKanban size={20} />
          <span>Projects</span>
        </NavLink>
        <NavLink to="/calendar" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <CalendarDays size={20} />
          <span>Calendar</span>
        </NavLink>
        <NavLink to="/materials" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <TrendingUp size={20} />
          <span>Ham Madde</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <User size={20} />
          <span>Profile</span>
        </NavLink>
      </div>

      <div className="sidebar-footer">
        {userData?.isSuperAdmin && (
          <button className="sidebar-new-btn" onClick={() => navigate('/?new=true')}>
            <Plus size={18} /> New Project
          </button>
        )}
        <div className="sidebar-bottom-links">
          <button className="sidebar-link-btn">
            <Settings size={18} /> Settings
          </button>
          <button className="sidebar-link-btn">
            <HelpCircle size={18} /> Support
          </button>
          <button className="sidebar-link-btn" onClick={handleSignOut}>
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
