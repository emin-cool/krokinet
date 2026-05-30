import React, { useState, useRef } from 'react';
import { Trash2 } from 'lucide-react';

export default function SwipeableItem({ children, onDelete }) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    isDragging.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current) return;
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;
    
    // Sola kaydırmaya izin ver (en fazla -80px)
    if (diff < 0 && diff > -100) {
      setOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    // Eğer yeterince sola kaydırıldıysa açık kalsın
    if (offset < -50) {
      setOffset(-80);
    } else {
      setOffset(0);
    }
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', width: '100%', marginBottom: 12, borderRadius: 12 }}>
      {/* Arka plan (Silme Butonu) */}
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        width: '80px',
        backgroundColor: '#ef4444',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        cursor: 'pointer',
        borderRadius: '0 12px 12px 0'
      }} onClick={() => { setOffset(0); onDelete(); }}>
        <Trash2 size={24} />
      </div>

      {/* Kaydırılabilir İçerik */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging.current ? 'none' : 'transform 0.2s ease-out',
          backgroundColor: 'var(--bg-card)',
          position: 'relative',
          zIndex: 2,
          width: '100%'
        }}
      >
        {children}
      </div>
    </div>
  );
}
