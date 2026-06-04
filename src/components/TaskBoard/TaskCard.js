import React from 'react';
import moment from 'moment';
import { AlertCircle, CalendarClock, CalendarPlus } from 'lucide-react';
import { CATEGORY_COLORS } from '../../utils/constants';

export default function TaskCard({ task, onClick, onAddToCalendar }) {
  const isOverdue = task.progress < 100 && new Date(task.end) < new Date();

  // Progress Bar Renklendirme
  let progressColor = 'var(--primary-color)';
  if (task.progress < 30) progressColor = '#ef4444'; // Kırmızı
  else if (task.progress < 70) progressColor = '#f59e0b'; // Sarı
  else if (task.progress < 100) progressColor = '#3b82f6'; // Mavi
  else progressColor = '#22c55e'; // Yeşil

  // Kategori rengi
  const catColor = CATEGORY_COLORS[task.category?.toLowerCase()] || task.color || '#3b82f6';

  return (
    <div 
      onClick={() => onClick(task)}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${isOverdue ? '#ef4444' : 'var(--border-color)'}`,
        borderRadius: '8px',
        padding: '12px 16px',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}
      onMouseEnter={(e) => Object.assign(e.currentTarget.style, { transform: 'translateY(-2px)', boxShadow: 'var(--shadow-md)' })}
      onMouseLeave={(e) => Object.assign(e.currentTarget.style, { transform: 'translateY(0)', boxShadow: 'var(--shadow-sm)' })}
    >
      {/* Sol kenar renk şeridi */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', backgroundColor: catColor }} />

      {/* Sol Kısım: Başlık ve Kategori */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 2, paddingLeft: '8px', minWidth: '150px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
            {task.title}
          </h4>
          {isOverdue && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fef2f2', color: '#ef4444', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, border: '1px solid #fecaca', whiteSpace: 'nowrap' }}>
              <AlertCircle size={12} /> Gecikti
            </span>
          )}
        </div>
        <div>
          <span style={{ background: `${catColor}22`, color: catColor, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, border: `1px solid ${catColor}44` }}>
            {task.category || 'Belirtilmedi'}
          </span>
        </div>
      </div>

      {/* Orta Kısım: Tarih */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px', flex: 1, minWidth: '120px' }}>
        <CalendarClock size={16} />
        <span style={{ whiteSpace: 'nowrap' }}>{moment(task.start).format('DD MMM')} - {moment(task.end).format('DD MMM')}</span>
      </div>

      {/* Sağ Kısım: İlerleme Çubuğu ve Aksiyonlar */}
      <div style={{ flex: 1, minWidth: '100px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px', color: 'var(--text-muted)', fontWeight: 600 }}>
            <span>İlerleme</span>
            <span>%{task.progress || 0}</span>
          </div>
          <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${task.progress || 0}%`, backgroundColor: progressColor, borderRadius: '4px', transition: 'width 0.3s ease' }} />
          </div>
        </div>

        {onAddToCalendar && (
          <button 
            title="Kişisel Takvime Ekle"
            onClick={(e) => onAddToCalendar(task, e)}
            style={{ 
              background: 'transparent', border: '1px solid var(--border-color)', 
              borderRadius: '8px', padding: '8px', cursor: 'pointer', 
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', transition: 'all 0.2s',
              boxShadow: 'var(--shadow-sm)'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary-color)'; e.currentTarget.style.borderColor = 'var(--primary-color)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
          >
            <CalendarPlus size={18} />
          </button>
        )}
      </div>
      
    </div>
  );
}
