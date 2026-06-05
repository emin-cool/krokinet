import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FolderKanban, CalendarDays, TrendingUp, User, LogOut, Settings, HelpCircle, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export default function Sidebar() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

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
    <div className={`sidebar hide-on-mobile ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <div className="app-logo-container" style={{ width: '40px', height: '40px', borderRadius: '10px' }}>
            <img src="/logo.png" alt="Logo" />
          </div>
          {!isCollapsed && (
            <div className="sidebar-title">
              <h2>ConstructPro</h2>
              <p>Site Management</p>
            </div>
          )}
        </div>
        <button 
          className="sidebar-toggle-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <div className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} end>
          <FolderKanban size={20} />
          {!isCollapsed && <span>Projects</span>}
        </NavLink>
        <NavLink to="/calendar" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <CalendarDays size={20} />
          {!isCollapsed && <span>Calendar</span>}
        </NavLink>
        <NavLink to="/materials" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <TrendingUp size={20} />
          {!isCollapsed && <span>Ham Madde</span>}
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <User size={20} />
          {!isCollapsed && <span>Profile</span>}
        </NavLink>
      </div>

      <div className="sidebar-footer">
        {userData?.isSuperAdmin && (
          <button className={`sidebar-new-btn ${isCollapsed ? 'icon-only' : ''}`} onClick={() => navigate('/?new=true')}>
            <Plus size={18} /> {!isCollapsed && <span>New Project</span>}
          </button>
        )}
        <div className="sidebar-bottom-links">
          <button className="sidebar-link-btn" title="Settings">
            <Settings size={18} /> {!isCollapsed && <span>Settings</span>}
          </button>
          <button className="sidebar-link-btn" title="Support">
            <HelpCircle size={18} /> {!isCollapsed && <span>Support</span>}
          </button>
          <button className="sidebar-link-btn" onClick={handleSignOut} title="Sign Out">
            <LogOut size={18} /> {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
