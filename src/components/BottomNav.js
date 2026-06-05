import React from 'react';
import { NavLink } from 'react-router-dom';
import { FolderKanban, CalendarDays, TrendingUp, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function BottomNav() {
  const { currentUser } = useAuth();

  if (!currentUser) return null;

  return (
    <div className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`} end>
        <FolderKanban size={24} />
        <span>Projeler</span>
      </NavLink>
      <NavLink to="/calendar" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <CalendarDays size={24} />
        <span>Takvim</span>
      </NavLink>
      <NavLink to="/materials" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <TrendingUp size={24} />
        <span>Maddeler</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <User size={24} />
        <span>Profil</span>
      </NavLink>
    </div>
  );
}
