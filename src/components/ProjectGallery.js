import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export default function ProjectGallery({ projectId, pinId }) {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMedia() {
      try {
        let q;
        if (pinId) {
          // Pin içi mesajlar
          q = query(collection(db, 'messages'), where('pinId', '==', pinId));
        } else {
          // Genel mesajlar
          q = query(collection(db, 'messages'), where('projectId', '==', projectId));
        }
        const snapshot = await getDocs(q);
        
        let files = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.fileUrl) {
            files.push({
              id: doc.id,
              ...data
            });
          }
        });
        
        // Kendi içimizde tarihe göre sıralayalım (en yeni en üstte)
        files.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });

        setMediaFiles(files);
      } catch (err) {
        console.error("Medya çekilirken hata:", err);
      }
      setLoading(false);
    }

    fetchMedia();
  }, [projectId]);

  if (loading) return <div className="loading">Galeri yükleniyor...</div>;

  return (
    <div style={{ padding: '24px', backgroundColor: 'var(--bg-main)', minHeight: '60vh' }}>
      <h2 style={{ color: '#fff', marginBottom: 20, fontSize: 20 }}>🗂️ Proje Galerisi</h2>
      {mediaFiles.length === 0 ? (
        <div className="empty-state">Henüz bu projede hiç fotoğraf/dosya paylaşılmamış.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {mediaFiles.map(file => (
            <div key={file.id} style={{ 
              backgroundColor: 'var(--bg-secondary)', 
              borderRadius: '8px', 
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <a href={file.fileUrl} target="_blank" rel="noreferrer" style={{ display: 'block', flex: 1, backgroundColor: '#000' }}>
                <img 
                  src={file.fileUrl} 
                  alt="Medya" 
                  style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }} 
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/200?text=Dosya'; }}
                />
              </a>
              <div style={{ padding: '12px' }}>
                <div style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 600, marginBottom: 4 }}>
                  {file.senderName}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {pinId ? 'Pin Galerisi' : (file.pinId === 'general' ? 'Genel Sohbet' : 'Pin İçi')}
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: 8 }}>
                  {file.createdAt?.toDate ? file.createdAt.toDate().toLocaleString('tr-TR') : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
