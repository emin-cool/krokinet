import React from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

export default function Layout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
