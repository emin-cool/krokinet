import React, { useState } from 'react';
import TaskCard from './TaskCard';
import { Search } from 'lucide-react';

export default function TaskBoard({ events, onTaskClick, onAddToCalendar }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Tümü');
  const [statusFilter, setStatusFilter] = useState('Tümü'); // Tümü, Gecikenler, Yaklaşanlar

  // Kategoriler (Kroki ile birebir aynı)
  const categories = ['Tümü', 'yapısal', 'elektrik', 'tesisat', 'mekanik', 'mimari', 'joker'];

  const today = new Date();
  today.setHours(0,0,0,0);

  // Filtreleme
  let filteredTasks = events.filter(e => {
    // 1. Arama filtresi
    if (searchTerm && !e.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    
    // 2. Kategori filtresi
    if (categoryFilter !== 'Tümü' && e.category !== categoryFilter) return false;

    // 3. Durum filtresi
    if (statusFilter === 'Gecikenler') {
      const isOverdue = e.progress < 100 && new Date(e.end) < today;
      if (!isOverdue) return false;
    }
    if (statusFilter === 'Yaklaşanlar') {
      const isUpcoming = new Date(e.start) >= today && new Date(e.start) <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (!isUpcoming) return false;
    }

    return true;
  });

  // Kolonlara bölme
  const pendingTasks = filteredTasks.filter(t => t.progress < 100);
  const completedTasks = filteredTasks.filter(t => t.progress === 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* TOOLBAR */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
        
        {/* Arama */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', flex: 1, minWidth: '200px', maxWidth: '350px' }}>
          <Search size={18} color="var(--text-muted)" />
          <input 
            type="text"
            placeholder="Görev ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-main)', width: '100%', fontSize: '14px' }}
          />
        </div>


        {/* Durum Filtreleri */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['Tümü', 'Gecikenler', 'Yaklaşanlar'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: statusFilter === status ? `1px solid ${status === 'Gecikenler' ? '#ef4444' : 'var(--primary-color)'}` : '1px solid var(--border-color)',
                background: statusFilter === status ? (status === 'Gecikenler' ? '#fef2f2' : 'var(--primary-glow)') : 'transparent',
                color: statusFilter === status ? (status === 'Gecikenler' ? '#ef4444' : 'var(--primary-color)') : 'var(--text-main)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {status}
            </button>
          ))}
        </div>

      </div>

      {/* BOARD (COLUMNS) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '12px' }}>
        
        {/* AKTİF GÖREVLER (GRID) */}
        <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', minHeight: '300px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid var(--border-color)' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
              Aktif Görevler
            </h3>
            <span style={{ background: 'var(--primary-color)', color: '#fff', padding: '4px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 600 }}>
              {pendingTasks.length}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {pendingTasks.length > 0 ? (
              pendingTasks.map(task => (
                <TaskCard key={task.id} task={task} onClick={onTaskClick} onAddToCalendar={onAddToCalendar} />
              ))
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', background: 'var(--bg-main)', borderRadius: '8px', border: '1px dashed var(--border-color)', gridColumn: '1 / -1' }}>
                Gösterilecek aktif görev bulunmuyor.
              </div>
            )}
          </div>
        </div>

        {/* BİTEN GÖREVLER (COLLAPSIBLE) */}
        <details style={{ background: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', outline: 'none', listStyle: 'none' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-muted)' }}>
              Biten Görevler
            </h3>
            <span style={{ background: 'var(--bg-main)', color: 'var(--text-muted)', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
              {completedTasks.length}
            </span>
          </summary>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            {completedTasks.length > 0 ? (
              completedTasks.map(task => (
                <TaskCard key={task.id} task={task} onClick={onTaskClick} onAddToCalendar={onAddToCalendar} />
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', gridColumn: '1 / -1' }}>Henüz biten görev yok.</div>
            )}
          </div>
        </details>

      </div>

    </div>
  );
}
