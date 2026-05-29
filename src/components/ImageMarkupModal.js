import React, { useRef, useState, useEffect } from 'react';
import { PenTool, Undo, Save, X } from 'lucide-react';

export default function ImageMarkupModal({ imageUrl, onSave, onCancel }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState([]);
  const [image, setImage] = useState(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      setImage(img);
      const canvas = canvasRef.current;
      if (canvas && containerRef.current) {
        // Tuvali kapsayıcının boyutuna uydur ama orijinal resim oranını koru
        const containerWidth = containerRef.current.clientWidth;
        const scale = containerWidth / img.width;
        const scaledHeight = img.height * scale;

        canvas.width = containerWidth;
        canvas.height = scaledHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // İlk boş hali geçmişe kaydet
        setHistory([canvas.toDataURL()]);
      }
    };
  }, [imageUrl]);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    // Mouse veya dokunmatik olaylarını destekle
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    if (clientX === undefined) return;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    if (clientX === undefined) return;

    ctx.strokeStyle = '#ef4444'; // Kırmızı kalem
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      setHistory([...history, canvas.toDataURL()]);
    }
  };

  const undo = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop(); // Son çizimi at
      const previousState = newHistory[newHistory.length - 1];
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = previousState;
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        setHistory(newHistory);
      };
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    canvas.toBlob((blob) => {
      onSave(blob);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="modal-overlay" onClick={e => e.stopPropagation()} style={{ zIndex: 3000, background: 'rgba(0,0,0,0.8)' }}>
      <div className="pin-modal" style={{ maxWidth: '800px', width: '90%' }}>
        <div className="pin-modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <PenTool size={18} color="#ef4444" /> Fotoğraf Üzerine Çizim Yap
          </h4>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-secondary" onClick={undo} disabled={history.length <= 1} title="Geri Al" style={{ padding: '8px' }}>
              <Undo size={18} />
            </button>
            <button className="btn-secondary" onClick={onCancel} style={{ padding: '8px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ padding: '20px', background: '#0f172a' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>
            Parmağınızla veya farenizle sorunlu bölgeyi yuvarlak içine alabilir, ok çizebilirsiniz.
          </p>

          <div ref={containerRef} style={{ width: '100%', overflow: 'hidden', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#000', display: 'flex', justifyContent: 'center' }}>
            {!image && <div style={{ padding: '40px', color: '#fff' }}>Yükleniyor...</div>}
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{ cursor: 'crosshair', touchAction: 'none', display: image ? 'block' : 'none' }}
            />
          </div>
        </div>

        <div className="pin-modal-header" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', justifyContent: 'flex-end', gap: '12px', background: 'var(--bg-card)' }}>
          <button className="btn-secondary" onClick={onCancel}>İptal</button>
          <button className="btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Save size={16} /> Kaydet ve Yükle
          </button>
        </div>
      </div>
    </div>
  );
}
