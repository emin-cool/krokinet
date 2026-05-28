import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import ImageCropper from './ImageCropper';
import { CornerUpLeft, Edit2, Trash2, Paperclip } from 'lucide-react';

const CLOUDINARY_CLOUD = 'dcx4qribb';
const CLOUDINARY_PRESET = 'insaat-upload';

export default function GeneralChat({ projectId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState(null);
  const [users, setUsers] = useState([]);
  const [showMention, setShowMention] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const { currentUser, userData } = useAuth();
  const bottomRef = useRef(null);

  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      where('projectId', '==', projectId),
      where('pinId', '==', 'general'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    
    getDocs(collection(db, 'users')).then(snap => {
      setUsers([{ name: 'Herkes' }, ...snap.docs.map(d => ({ id: d.id, ...d.data() }))]);
    });

    return () => unsub();
  }, [projectId]);

  async function sendMessage(fileUrl = null, fileType = null) {
    if (!text.trim() && !fileUrl) return;
    let notificationPromises = [];
    const mentionedUsernames = Array.from(new Set(text.match(/@(\w+)/g) || [])).map(m => m.slice(1));
    for (const username of mentionedUsernames) {
      if (username === userData?.name) continue;
      const userDoc = users.find(u => u.name === username);
      if (userDoc && userDoc.id) {
        notificationPromises.push(
          addDoc(collection(db, 'notifications'), {
            userId: userDoc.id,
            projectId: projectId,
            type: 'mention',
            message: `${userData?.name}, genel sohbette senden bahsetti.`,
            read: false,
            createdAt: serverTimestamp()
          })
        );
      }
    }

    try {
      await Promise.all([
        addDoc(collection(db, 'messages'), {
          projectId,
          pinId: 'general',
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

  async function uploadToCloudinary(file) {
    if (file.size > 10 * 1024 * 1024) { alert('Dosya 10MB\'dan küçük olmalı'); return; }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      await sendMessage(data.secure_url, file.type);
    } catch (err) { alert('Yükleme başarısız'); }
    setUploading(false);
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      setCropImageUrl(URL.createObjectURL(file));
    } else {
      uploadToCloudinary(file);
    }
    e.target.value = '';
  }

  async function handleCropComplete(blob) {
    setCropImageUrl(null);
    await uploadToCloudinary(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
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
    <div className="chat-container">
      {cropImageUrl && (
        <ImageCropper imageUrl={cropImageUrl} onCrop={handleCropComplete} onCancel={() => setCropImageUrl(null)} />
      )}
      <div className="messages-list">
        {messages.length === 0 && <div className="chat-empty">Henüz mesaj yok. İlk mesajı siz gönderin!</div>}
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.userId === currentUser.uid ? 'own' : ''}`}>
            <div className="message-header">
              <span className="message-name">{msg.userName}</span>
              <span className="message-role">({msg.userRole})</span>
              <div className="message-actions" style={{ display: 'inline-flex', gap: 6, marginLeft: 10 }}>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }} onClick={() => setReplyTo({ id: msg.id, userName: msg.userName, text: msg.text || 'Fotoğraf' })}>
                  <CornerUpLeft size={14} color="#94a3b8" />
                </button>
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
                <div key={i} onClick={() => handleMentionSelect(u.name)} style={{ padding: '6px 10px', cursor: 'pointer', borderRadius: 4, fontSize: 13, color: '#fff', background: 'rgba(255,255,255,0.05)' }}>
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
            <input type="file" hidden onChange={handleFileSelect} accept="image/*,.pdf,.doc,.docx" />
          </label>
          <button className="btn-primary" onClick={() => sendMessage()}>Gönder</button>
        </div>
      </div>
    </div>
  );
}