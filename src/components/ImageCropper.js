import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Crop, ZoomIn } from 'lucide-react';

async function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', reject);
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.92);
  });
}

export default function ImageCropper({ imageUrl, onCrop, onCancel, showDescription }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');

  const onCropComplete = useCallback((_, cap) => setCroppedAreaPixels(cap), []);

  async function handleCrop() {
    if (!croppedAreaPixels) return;
    setLoading(true);
    try {
      const blob = await getCroppedImg(imageUrl, croppedAreaPixels);
      onCrop(blob, description);
    } catch (e) { alert('Kırpma hatası oluştu'); }
    setLoading(false);
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="cropper-modal" style={{ maxWidth: '500px', width: '100%', background: '#111827', borderRadius: '16px', padding: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Crop size={20} color="var(--primary-color)" /> Fotoğrafı Kırp
        </h3>
        <div className="cropper-box" style={{ position: 'relative', width: '100%', height: '300px', background: '#333', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>
        <div className="cropper-controls" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <ZoomIn size={18} color="var(--text-muted)" />
          <input type="range" min={1} max={3} step={0.05} value={zoom}
            onChange={e => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
        </div>
        {showDescription && (
          <div style={{ marginBottom: '16px' }}>
            <input 
              type="text" 
              placeholder="Fotoğraf için bir açıklama veya bilgi yazın..." 
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '14px' }}
            />
          </div>
        )}
        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="btn-secondary" onClick={onCancel}>İptal</button>
          <button className="btn-primary" onClick={handleCrop} disabled={loading}>
            <Crop size={16} /> {loading ? 'İşleniyor...' : 'Kırp ve Yükle'}
          </button>
        </div>
      </div>
    </div>
  );
}