import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, getDocs, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import ProjectGallery from './ProjectGallery';
import ImageMarkupModal from './ImageMarkupModal';
import { MapPin, MessageSquare, Images, Info, Trash2, Edit2, Paperclip, CornerUpLeft, ClipboardList, FolderOpen, FileText, Image as ImageIcon, UserCheck, Search, Pin, PinOff } from 'lucide-react';

const CLOUDINARY_CLOUD = 'dcx4qribb';
const CLOUDINARY_PRESET = 'insaat-upload';

const CATEGORY_COLORS = {
  'yapısal': '#ef4444', 
  'elektrik': '#eab308', 
  'tesisat': '#22c55e', 
  'mekanik': '#f97316', 
  'mimari': '#a855f7', 
  'genel': '#3b82f6', 
  'diğer': '#64748b'
};
const CATEGORIES = Object.keys(CATEGORY_COLORS);

export default function PinDetailModal({ pin, projectId, isManager, onClose }) {
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(pin.status);
  const [priority, setPriority] = useState(pin.priority || 'Normal');

  const [pinCategory, setPinCategory] = useState(pin.category || 'genel');
  const [pinColor, setPinColor] = useState(pin.color || '#ef4444');
  const [pinTitle, setPinTitle] = useState(pin.title);
  const [editingHeader, setEditingHeader] = useState(false);
  const [pinInfo, setPinInfo] = useState(pin.info || '');
  const [editingInfo, setEditingInfo] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [users, setUsers] = useState([]);
  const [showMention, setShowMention] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [hasSeenPinned, setHasSeenPinned] = useState(false);
  
  const [markupImageUrl, setMarkupImageUrl] = useState(null);
  const [markupTarget, setMarkupTarget] = useState(null);

  const { currentUser, userData } = useAuth();
  const bottomRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'messages'), where('pinId', '==', pin.id), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    
    // Sadece bu projenin aktif üyelerini çek
    getDoc(doc(db, 'projects', projectId)).then(async projectSnap => {
      if (!projectSnap.exists()) return;
      const projectData = projectSnap.data();
      const allRoles = projectData.memberRoles || {};
      const memberIds = [...(projectData.memberIds || [])];
      // Manager'ı da ekle
      if (projectData.managerId && !memberIds.includes(projectData.managerId)) {
        memberIds.push(projectData.managerId);
      }
      if (memberIds.length > 0) {
        // Her bir üyeyi doğrudan kontrol et
        const projectUsers = [];
        for (const uid of memberIds) {
          const userSnap = await getDoc(doc(db, 'users', uid));
          if (userSnap.exists()) {
            projectUsers.push({ id: userSnap.id, ...userSnap.data() });
          }
        }
        setUsers([{ name: 'Herkes' }, ...projectUsers]);
      }
    });

    return () => unsub();
  }, [pin.id]);

  useEffect(() => {
    const q = query(collection(db, 'files'), where('pinId', '==', pin.id));
    const unsub = onSnapshot(q, snap => setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [pin.id]);

  async function sendMessage(fileUrl = null, fileType = null) {
    if (!text.trim() && !fileUrl) return;
    
    let notificationPromises = [];
    // Kullanıcı isimlerini metin içinde ara (boşluklu isimler dahil)
    const projectUsers = users.filter(u => u.name && u.name !== 'Herkes' && u.name !== userData?.name);
    for (const userDoc of projectUsers) {
      const mentionTag = `@${userDoc.name.replace(/\s+/g, '')}`;
      if (text.includes(mentionTag)) {
        notificationPromises.push(
          addDoc(collection(db, 'notifications'), {
            userId: userDoc.id,
            projectId: projectId,
            pinId: pin.id,
            type: 'mention',
            message: `${userData?.name}, "${pin.title}" pininde senden bahsetti.`,
            read: false,
            createdAt: serverTimestamp()
          })
        );
      }
    }

    try {
      await Promise.all([
        addDoc(collection(db, 'messages'), {
          projectId, pinId: pin.id,
          userId: currentUser.uid,
          userName: userData?.name,
          userRole: userData?.role,
          text: text.trim(),
          fileUrl: fileUrl || null,
          fileType: fileType || null,
          replyTo: replyTo || null,
          createdAt: serverTimestamp()
        }),
        ...notificationPromises
      ]);
      setText('');
      setReplyTo(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function uploadToCloudinary(file, target, description = '') {
    if (file.size > 10 * 1024 * 1024) { alert('Dosya 10MB\'dan küçük olmalı'); return; }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (target === 'chat') {
        await sendMessage(data.secure_url, file.type);
      } else {
        await addDoc(collection(db, 'files'), {
          pinId: pin.id, projectId,
          userId: currentUser.uid, userName: userData?.name,
          name: file.name, url: data.secure_url, type: file.type,
          description: description,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) { alert('Yükleme başarısız'); }
    setUploading(false);
  }

  function handleFileSelect(e, target) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.type.startsWith('image/')) {
      // Eğer fotoğrafsa çizim ekranını aç
      setMarkupImageUrl(URL.createObjectURL(file));
      setMarkupTarget(target);
    } else {
      let description = '';
      if (target === 'files') {
        description = window.prompt("Dosya için bir açıklama (isteğe bağlı):") || '';
      }
      uploadToCloudinary(file, target, description);
    }
    e.target.value = '';
  }

  async function handleMarkupComplete(blob) {
    let description = '';
    if (markupTarget === 'files') {
      description = window.prompt("Fotoğraf için bir açıklama (isteğe bağlı):") || '';
    }
    const markupFile = new File([blob], 'photo_markup.jpg', { type: 'image/jpeg' });
    setMarkupImageUrl(null);
    await uploadToCloudinary(markupFile, markupTarget, description);
    setMarkupTarget(null);
  }

  async function deleteFile(fileId) {
    if (window.confirm('Bu dosyayı/fotoğrafı silmek istediğinize emin misiniz?')) {
      try {
        await deleteDoc(doc(db, 'files', fileId));
      } catch (err) {
        console.error('Dosya silinirken hata:', err);
      }
    }
  }

  async function updateStatus(newStatus) {
    await updateDoc(doc(db, 'pins', pin.id), { status: newStatus });
    setStatus(newStatus);
  }

  async function savePinInfo() {
    setSavingInfo(true);
    await updateDoc(doc(db, 'pins', pin.id), { 
      info: pinInfo,
      priority
    });
    setSavingInfo(false);
    setEditingInfo(false);
  }

  async function saveHeaderInfo() {
    const newColor = CATEGORY_COLORS[pinCategory] || '#3b82f6';
    await updateDoc(doc(db, 'pins', pin.id), {
      title: pinTitle,
      category: pinCategory,
      color: newColor
    });
    setEditingHeader(false);
    pin.title = pinTitle;
    pin.category = pinCategory;
    pin.color = newColor;
    setPinColor(newColor);
  }

  async function deletePin() {
    const action = window.prompt('Pini kaldırmak için "arsiv" veya "sil" yazın:\\n\\narsiv: Pin gizlenir, arşive kaldırılır.\\nsil: Pin ve içindeki her şey KÖKTEN silinir.');
    
    if (action === 'arsiv' || action === 'arşiv') {
      await updateDoc(doc(db, 'pins', pin.id), { isArchived: true });
      onClose();
    } else if (action === 'sil') {
      if (!window.confirm('DİKKAT: Pin, mesajlar ve dosyalar tamamen SİLİNECEK! Emin misiniz?')) return;
      
      try {
        // Delete messages
        for (const msg of messages) {
          await deleteDoc(doc(db, 'messages', msg.id));
        }
        // Delete files
        for (const file of files) {
          await deleteDoc(doc(db, 'files', file.id));
        }
        // Delete pin
        await deleteDoc(doc(db, 'pins', pin.id));
        onClose();
      } catch (err) {
        console.error("Silme hatası:", err);
        alert("Silinirken bir hata oluştu.");
      }
    }
  }

  async function unarchivePin() {
    await updateDoc(doc(db, 'pins', pin.id), { isArchived: false });
    // Keep it open, no need to close
  }

  async function deleteMessage(msgId) {
    if (window.confirm('Bu mesajı silmek istediğinize emin misiniz?')) {
      await deleteDoc(doc(db, 'messages', msgId));
    }
  }

  async function saveMessageEdit(msgId) {
    if (editingMessageText.trim()) {
      await updateDoc(doc(db, 'messages', msgId), { text: editingMessageText.trim() });
    } else {
      await deleteMessage(msgId);
    }
    setEditingMessageId(null);
  }

  async function togglePinMessage(msgId, currentIsPinned) {
    await updateDoc(doc(db, 'messages', msgId), { isPinned: !currentIsPinned });
  }

  const renderTextWithMentions = (text) => {
    if (!text) return null;
    const parts = text.split(/(@\S+)/g);
    return parts.map((part, i) => 
      part.startsWith('@') ? <span key={i} className="mention-highlight">{part}</span> : part
    );
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    const match = val.match(/(?:\s|^)@(\S*)$/);
    if (match) {
      setShowMention(true);
      setMentionSearch(match[1].toLowerCase());
    } else {
      setShowMention(false);
    }
  };

  const handleMentionSelect = (name) => {
    const replaced = text.replace(/(?:\s|^)@(\S*)$/, ` @${name.replace(/\s+/g, '')} `);
    setText(replaced);
    setShowMention(false);
  };

  const filteredUsers = users.filter(u => u.name?.toLowerCase().includes(mentionSearch));

  return (
    <div className="modal-overlay" onClick={onClose}>
      {markupImageUrl && (
        <ImageMarkupModal
          imageUrl={markupImageUrl}
          onSave={handleMarkupComplete}
          onCancel={() => { setMarkupImageUrl(null); setMarkupTarget(null); }}
        />
      )}
      <div className="pin-modal" onClick={e => e.stopPropagation()}>
        <div className="bottom-sheet-handle"></div>
        <div className="pin-modal-header" style={{ alignItems: editingHeader ? 'flex-start' : 'center' }}>
          {editingHeader ? (
            <div style={{ flex: 1, marginRight: 16 }}>
              <input 
                value={pinTitle} 
                onChange={e => setPinTitle(e.target.value)} 
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', marginBottom: 8, fontSize: 16, fontWeight: 'bold' }} 
              />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select value={pinCategory} onChange={e => {
                  setPinCategory(e.target.value);
                  setPinColor(CATEGORY_COLORS[e.target.value] || '#3b82f6');
                }} style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}>
                  <option value="" disabled>İş Türü</option>
                  {CATEGORIES.map(c => <option key={c} value={c} style={{ color: CATEGORY_COLORS[c], fontWeight: 'bold' }}>{c}</option>)}
                </select>
              </div>
              <div style={{ marginTop: 8 }}>
                <button className="btn-primary" onClick={saveHeaderInfo} style={{ padding: '4px 12px', fontSize: 13, marginRight: 8 }}>Kaydet</button>
                <button className="btn-secondary" onClick={() => { setEditingHeader(false); setPinTitle(pin.title); setPinCategory(pin.category || 'genel'); setPinColor(pin.color || '#3b82f6'); }} style={{ padding: '4px 12px', fontSize: 13 }}>İptal</button>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1 }}>
              <h2 style={{ display: 'flex', alignItems: 'center', margin: '0 0 6px 0', fontSize: '1.25rem' }}>
                <MapPin size={24} color={pinColor || "var(--primary-color)"} style={{ marginRight: '8px', minWidth: 24 }} /> 
                <span style={{ wordBreak: 'break-word' }}>{pinTitle}</span>
                {isManager && <Edit2 size={16} color="var(--text-muted)" style={{ cursor: 'pointer', marginLeft: 8, minWidth: 16 }} onClick={() => setEditingHeader(true)} />}
              </h2>
              <span className="pin-category" style={{ background: pinColor || '#ef4444' }}>{pinCategory} {pin.isArchived ? '(Arşivlenmiş)' : ''}</span>
            </div>
          )}
          <div className="pin-header-actions" style={{ alignSelf: 'flex-start', marginTop: editingHeader ? 4 : 0 }}>
            {isManager && pin.isArchived && (
              <button className="btn-secondary" onClick={unarchivePin} style={{ marginRight: 8, fontSize: 13 }}>
                📦 Arşivden Çıkar
              </button>
            )}
            {isManager && !pin.isArchived && <button className="btn-danger" onClick={deletePin}><Trash2 size={18} /></button>}
            <button className="btn-secondary" onClick={onClose} style={{ padding: '8px 12px' }}>✕</button>
          </div>
        </div>

        <div className="pin-tabs">
          <button className={activeTab === 'chat' ? 'tab active' : 'tab'} onClick={() => setActiveTab('chat')}>
            <MessageSquare size={16} style={{ marginRight: '6px' }} /> Sohbet
          </button>
          <button className={activeTab === 'gallery' ? 'tab active' : 'tab'} onClick={() => setActiveTab('gallery')}>
            <Images size={16} style={{ marginRight: '6px' }} /> Galeri
          </button>
          <button className={activeTab === 'info' ? 'tab active' : 'tab'} onClick={() => setActiveTab('info')}>
            <Info size={16} style={{ marginRight: '6px' }} /> Bilgiler
          </button>
        </div>

        {activeTab === 'gallery' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <ProjectGallery projectId={projectId} pinId={pin.id} />
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="chat-container" style={{ position: 'relative' }}>
            {messages.some(m => m.isPinned) && !hasSeenPinned && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-surface)', zIndex: 100, display: 'flex', flexDirection: 'column', padding: 20 }}>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--primary-color)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                    <Pin size={20} /> Sabitlenmiş Mesajlar
                  </div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 20, textAlign: 'center', fontSize: 13 }}>
                    Sohbete geçmeden önce yöneticiler tarafından sabitlenen bu önemli mesajları okumalısınız.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {messages.filter(m => m.isPinned).map(msg => (
                      <div key={'pinned-' + msg.id} style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 12, fontSize: 15, borderLeft: '4px solid var(--primary-color)', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: 14 }}>{msg.userName} <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: 12 }}>({msg.userRole})</span></span>
                          {isManager && (
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }} onClick={() => togglePinMessage(msg.id, msg.isPinned)} title="Sabitlemeyi Kaldır">
                              <PinOff size={16} color="var(--text-muted)" />
                            </button>
                          )}
                        </div>
                        <div style={{ color: 'var(--text-main)', lineHeight: 1.5 }}>
                          {msg.text ? renderTextWithMentions(msg.text) : <em style={{ color: 'var(--text-muted)' }}>Fotoğraf/Dosya</em>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <button className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: 16, borderRadius: 12, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }} onClick={() => setHasSeenPinned(true)}>
                    Sohbete Geç (Atla)
                  </button>
                </div>
              </div>
            )}
            
            {messages.some(m => m.isPinned) && hasSeenPinned && (
              <div style={{ padding: '8px 16px', background: 'rgba(59, 130, 246, 0.05)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Pin size={14} /> {messages.filter(m => m.isPinned).length} Sabitlenmiş Mesaj
                </span>
                <button onClick={() => setHasSeenPinned(false)} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }}>
                  Göster
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 16px', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
              {showSearch ? (
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8, background: 'var(--bg-card)', padding: '4px 12px', borderRadius: 20, border: '1px solid var(--primary-color)' }}>
                  <Search size={14} color="var(--text-muted)" />
                  <input 
                    autoFocus
                    placeholder="Mesajlarda ara..." 
                    value={chatSearch} 
                    onChange={e => setChatSearch(e.target.value)}
                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: 14, outline: 'none' }}
                  />
                  <button onClick={() => { setShowSearch(false); setChatSearch(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
                </div>
              ) : (
                <button onClick={() => setShowSearch(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Search size={16} /> <span style={{ fontSize: 13 }}>Ara</span>
                </button>
              )}
            </div>
            <div className="messages-list">
              {messages.filter(m => !chatSearch || m.text?.toLowerCase().includes(chatSearch.toLowerCase())).length === 0 && <div className="chat-empty">Henüz mesaj yok.</div>}
              {messages.filter(m => !chatSearch || m.text?.toLowerCase().includes(chatSearch.toLowerCase())).map(msg => (
                <div key={msg.id} className={`message ${msg.userId === currentUser.uid ? 'own' : ''}`}>
                  <div className="message-header">
                    <span className="message-name">{msg.userName}</span>
                    <span className="message-role">({msg.userRole})</span>
                    <div className="message-actions" style={{ display: 'inline-flex', gap: 6, marginLeft: 10 }}>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }} onClick={() => setReplyTo({ id: msg.id, userName: msg.userName, text: msg.text || 'Fotoğraf' })}>
                        <CornerUpLeft size={14} color="#94a3b8" />
                      </button>
                      {isManager && (
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: msg.isPinned ? 1 : 0.6 }} onClick={() => togglePinMessage(msg.id, msg.isPinned)} title={msg.isPinned ? "Sabitlemeyi Kaldır" : "Mesajı Sabitle"}>
                          {msg.isPinned ? <PinOff size={14} color="#3b82f6" /> : <Pin size={14} color="#94a3b8" />}
                        </button>
                      )}
                      {msg.userId === currentUser.uid && (
                        <>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }} onClick={() => { setEditingMessageId(msg.id); setEditingMessageText(msg.text); }}>
                            <Edit2 size={14} color="#94a3b8" />
                          </button>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }} onClick={() => deleteMessage(msg.id)}>
                            <Trash2 size={14} color="#ef4444" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {msg.replyTo && (
                    <div className="reply-quote">
                      <strong>{msg.replyTo.userName}</strong>
                      {msg.replyTo.text.length > 50 ? msg.replyTo.text.substring(0, 50) + '...' : msg.replyTo.text}
                    </div>
                  )}
                  {msg.text && (
                    <div className="message-text">
                      {editingMessageId === msg.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <input autoFocus value={editingMessageText} onChange={e => setEditingMessageText(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveMessageEdit(msg.id)} style={{ width: '100%', padding: '4px 8px', borderRadius: 4, border: 'none', color: '#000' }} />
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={() => saveMessageEdit(msg.id)} style={{ fontSize: 11, padding: '2px 8px', cursor: 'pointer', background: '#fff', border: 'none', borderRadius: 4, color: '#000' }}>Kaydet</button>
                            <button onClick={() => setEditingMessageId(null)} style={{ fontSize: 11, padding: '2px 8px', cursor: 'pointer', background: 'transparent', border: '1px solid #fff', borderRadius: 4, color: '#fff' }}>İptal</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {renderTextWithMentions(msg.text)}
                          {msg.createdAt && <span className="message-time">{msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                        </>
                      )}
                    </div>
                  )}
                  {msg.fileUrl && (
                    msg.fileType?.startsWith('image/')
                      ? <div style={{ position: 'relative', display: 'inline-block' }}>
                          <img src={msg.fileUrl} alt="upload" className="message-image" />
                          {msg.createdAt && !msg.text && (
                            <span className="message-time" style={{ bottom: 22, right: 8, color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: 10 }}>
                              {msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      : <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="message-file">
                          <Paperclip size={14} style={{ marginRight: '4px' }} /> Dosyayı Aç
                        </a>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="chat-input" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {replyTo && (
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, borderLeft: '3px solid var(--primary-color)' }}>
                  <div>
                    <strong style={{ color: 'var(--primary-color)' }}>{replyTo.userName}</strong> yanıtlanıyor
                  </div>
                  <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                </div>
              )}
              <div style={{ position: 'relative', display: 'flex', gap: 10, width: '100%', alignItems: 'center' }}>
                {showMention && filteredUsers.length > 0 && (
                  <div style={{ position: 'absolute', bottom: '100%', left: 0, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 8, zIndex: 10, maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, width: 200, marginBottom: 8, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                    {filteredUsers.map((u, i) => (
                      <div key={i} 
                           onMouseDown={(e) => { e.preventDefault(); handleMentionSelect(u.name); }} 
                           onTouchStart={(e) => { e.preventDefault(); handleMentionSelect(u.name); }} 
                           style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 4, fontSize: 14, color: '#fff', background: 'rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        {u.name}
                      </div>
                    ))}
                  </div>
                )}
                <input placeholder="Mesaj yaz... (@kisi)" value={text}
                  onChange={handleTextChange}
                  onKeyDown={e => e.key === 'Enter' && !showMention && sendMessage()} />
                <label className="upload-btn">
                  {uploading ? '⏳' : '📎'}
                  <input type="file" hidden onChange={e => handleFileSelect(e, 'chat')} accept="image/*,.pdf,.doc,.docx" />
                </label>
                <button className="btn-primary" onClick={() => sendMessage()}>Gönder</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'info' && (
          <div className="files-container">
            <div className="pin-info-section">
              <div className="pin-info-header" style={{ justifyContent: 'flex-end', marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                {isManager && !editingInfo && (
                  <button className="btn-secondary" style={{ padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setEditingInfo(true)}>
                    <Edit2 size={16} />
                  </button>
                )}
              </div>
              {editingInfo ? (
                <div>

                  <textarea value={pinInfo} onChange={e => setPinInfo(e.target.value)}
                    placeholder="Bu pin hakkında bilgiler, yapılacaklar (madde başı tire ile)..." rows={5}
                    style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn-primary" onClick={savePinInfo} disabled={savingInfo}>
                      {savingInfo ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                    <button className="btn-secondary" onClick={() => { setEditingInfo(false); setPinInfo(pin.info || ''); }}>İptal</button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 14, color: 'var(--text-main)', lineHeight: 1.7 }}>

                  <div style={{ whiteSpace: 'pre-wrap', color: pinInfo ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    {pinInfo || (isManager ? 'Henüz bilgi eklenmemiş. Düzenle butonuna tıklayın.' : 'Henüz bilgi eklenmemiş.')}
                  </div>
                </div>
              )}
            </div>
            <div className="pin-files-section">
              <div className="pin-info-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <FolderOpen size={18} /> TEKNİK DOSYALAR
                </h4>
                {isManager && (
                  <label className="btn-primary" style={{ padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}>
                    {uploading ? <span style={{ fontSize: '12px' }}>⏳</span> : <span style={{ fontSize: '20px', fontWeight: 'bold', lineHeight: 1 }}>+</span>}
                    <input type="file" hidden onChange={e => handleFileSelect(e, 'files')} accept="image/*,.pdf,.doc,.docx" />
                  </label>
                )}
              </div>
              <div className="files-list">
                {files.length === 0 ? <p className="empty-state" style={{ color: 'var(--text-muted)' }}>Henüz dosya yok.</p> : files.map(file => (
                  <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="file-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
                    {file.type?.startsWith('image/') && (
                      <div style={{ width: '100%', height: '140px', overflow: 'hidden', borderRadius: '8px' }}>
                        <img src={file.url} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <div style={{ width: '100%' }}>
                      {file.description && (
                        <p style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '8px', lineHeight: 1.5 }}>
                          {file.description}
                        </p>
                      )}
                      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                          {!file.type?.startsWith('image/') && <FileText size={16} color="var(--primary-color)" />}
                          {file.type?.startsWith('image/') ? 'Fotoğraf Görüntüsü' : file.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="file-uploader" style={{ fontSize: '12px', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '12px', color: 'var(--primary-color)' }}>
                            {file.userName}
                          </span>
                          {(isManager || file.userId === currentUser.uid) && (
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteFile(file.id); }}
                              style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Sil"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}