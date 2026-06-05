import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { X, Edit2, Trash2, Send, Paperclip, FileText, Image as ImageIcon, CornerUpLeft, Search, Pin, PinOff, Info, Images, MapPin, UserCheck, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ImageMarkupModal from './ImageMarkupModal';
import './PinDetailModal.css';

const CLOUDINARY_PRESET = 'insaat_preset';
const CLOUDINARY_CLOUD = 'dfl7x5dud';

const CATEGORY_COLORS = {
  'genel': '#3b82f6', 
  'mimari': '#a855f7', 
  'statik': '#ef4444', 
  'elektrik': '#eab308', 
  'tesisat': '#22c55e', 
  'mekanik': '#f97316', 
  'diğer': '#64748b'
};
const CATEGORIES = Object.keys(CATEGORY_COLORS);

export default function PinDetailModal({ pin, pins, setSelectedPin, projectId, isManager, onClose }) {
  const { currentUser, userData } = useAuth();
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const [status, setStatus] = useState(pin.status);
  const [priority, setPriority] = useState(pin.priority || 'Normal');
  const [pinCategory, setPinCategory] = useState(pin.category || 'genel');
  const [pinColor, setPinColor] = useState(pin.color || '#3b82f6');
  const [pinTitle, setPinTitle] = useState(pin.title || `Pin ${pin.category}`);
  const [pinInfo, setPinInfo] = useState(pin.info || '');
  
  const [markupImageUrl, setMarkupImageUrl] = useState(null);
  const [markupTarget, setMarkupTarget] = useState(null);
  const objectUrlRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMention, setShowMention] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  
  const [searchPins, setSearchPins] = useState('');

  const bottomRef = useRef(null);

  useEffect(() => {
    const qUsers = query(collection(db, 'users'));
    const unsub = onSnapshot(qUsers, snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    setStatus(pin.status);
    setPriority(pin.priority || 'Normal');
    setPinCategory(pin.category || 'genel');
    setPinColor(pin.color || '#3b82f6');
    setPinTitle(pin.title || `Pin ${pin.category}`);
    setPinInfo(pin.info || '');
  }, [pin]);

  useEffect(() => {
    const qMsg = query(collection(db, 'messages'), where('pinId', '==', pin.id), orderBy('createdAt', 'asc'));
    const unsubMsg = onSnapshot(qMsg, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
    });

    const qFiles = query(collection(db, 'files'), where('pinId', '==', pin.id), orderBy('createdAt', 'desc'));
    const unsubFiles = onSnapshot(qFiles, snap => {
      setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubMsg(); unsubFiles(); };
  }, [pin.id]);

  async function sendMessage(fileUrl = null, fileType = null, fileDescription = '') {
    if (!text.trim() && !fileUrl) return;
    try {
      await addDoc(collection(db, 'messages'), {
        pinId: pin.id,
        projectId,
        text: text.trim(),
        userId: currentUser.uid,
        userName: userData?.name,
        userRole: userData?.role,
        replyTo,
        fileUrl,
        type: fileType,
        description: fileDescription,
        isPinned: false,
        createdAt: serverTimestamp()
      });
      setText('');
      setReplyTo(null);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error(err);
    }
  }

  async function uploadToCloudinary(file, target = 'chat', description = '') {
    if (file.size > 10 * 1024 * 1024) { alert("Dosya 10MB'dan küçük olmalı"); return; }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || data.error) { alert('Dosya yüklenemedi.'); setUploading(false); return; }
      if (target === 'chat') {
        await sendMessage(data.secure_url, file.type, description);
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
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const newUrl = URL.createObjectURL(file);
      objectUrlRef.current = newUrl;
      setMarkupImageUrl(newUrl);
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

  async function togglePinMessage(msgId, currentIsPinned) {
    await updateDoc(doc(db, 'messages', msgId), { isPinned: !currentIsPinned });
  }

  const renderTextWithMentions = (msgText) => {
    if (!msgText) return null;
    const parts = msgText.split(/(@\S+)/g);
    return parts.map((part, i) => 
      part.startsWith('@') ? <span key={i} style={{ color: 'var(--primary-color)', fontWeight: 600, backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '0 4px', borderRadius: '4px' }}>{part}</span> : part
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
    const replaced = text.replace(/(?:\s|^)@(\S*)$/, (match, p1, offset) => (offset === 0 ? '' : ' ') + '@' + name.replace(/\s+/g, '') + ' ');
    setText(replaced);
    setShowMention(false);
  };

  const filteredUsers = users.filter(u => u.name?.toLowerCase().includes(mentionSearch));
  const filteredPins = (pins || []).filter(p => (p.title || p.category || '').toLowerCase().includes(searchPins.toLowerCase()));
  const displayedMessages = showSearch && chatSearch ? messages.filter(m => m.text?.toLowerCase().includes(chatSearch.toLowerCase())) : messages;

  return (
    <div className="discussion-overlay" onClick={onClose}>
      {markupImageUrl && (
        <ImageMarkupModal
          imageUrl={markupImageUrl}
          onSave={handleMarkupComplete}
          onCancel={() => { setMarkupImageUrl(null); setMarkupTarget(null); }}
        />
      )}
      <div className="discussion-drawer" onClick={e => e.stopPropagation()}>
        
        {/* Left Panel: Pins List */}
        <div className="discussion-sidebar">
          <div className="sidebar-header-box">
            <h3>Pins & Threads</h3>
            <div className="search-bar">
              <Search size={16} className="search-icon" />
              <input type="text" placeholder="Search pins..." value={searchPins} onChange={e => setSearchPins(e.target.value)} />
            </div>
          </div>
          <div className="pins-scroll-list">
            {filteredPins.length > 0 ? filteredPins.map(p => {
              const isActive = pin.id === p.id;
              const isResolved = p.status === 'Çözüldü';
              return (
                <div key={p.id} onClick={() => setSelectedPin(p)} className={`sidebar-pin-item ${isActive ? 'active' : ''}`}>
                  <div className="pin-item-header">
                    <span className="pin-id">Pin #{p.number || p.id.slice(0,4)}</span>
                    <span className="pin-time">
                      {p.createdAt?.toDate ? p.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                    </span>
                  </div>
                  <h4>{p.title || `Pin ${p.category}`}</h4>
                  <div className="pin-item-footer">
                    <span className={`status-badge ${isResolved ? 'resolved' : 'open'}`}>
                      {isResolved ? 'RESOLVED' : 'OPEN'}
                    </span>
                    {p.info && <span className="pin-desc">{p.info}</span>}
                  </div>
                </div>
              );
            }) : (
              <p className="empty-pins">Projede başka pin bulunmuyor.</p>
            )}
          </div>
        </div>

        {/* Right Panel: Chat & Detail */}
        <div className="discussion-main">
          {/* Header */}
          <div className="main-header">
            <div>
              <div className="header-title-row">
                <h2>Pin #{pin.number || pin.id.slice(0,4)} - {pinTitle}</h2>
                <span className={`status-badge ${status === 'Çözüldü' ? 'resolved' : 'open'}`}>
                  {status === 'Çözüldü' ? 'RESOLVED' : 'OPEN'}
                </span>
              </div>
              <div className="header-meta">
                <span><MapPin size={14} /> Zone B, Floor {pin.floorPlanIndex + 1}</span>
                <span><UserCheck size={14} /> Assignee: {userData?.name || 'Yönetici'}</span>
              </div>
            </div>
            <button className="close-btn-large" onClick={onClose}>
              <X size={24} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="main-content-scroll">
            
            {/* Info Cards */}
            <div className="info-cards-grid">
              <div className="info-card details-card">
                <h4><Info size={16} /> Details</h4>
                <div className="detail-row">
                  <span className="label">Created</span>
                  <span className="value">{pin.createdAt?.toDate ? pin.createdAt.toDate().toLocaleDateString() : 'Unknown'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Priority</span>
                  <span className={`value priority-${priority === 'Acil' ? 'high' : priority === 'Yüksek' ? 'medium' : 'normal'}`}>
                    {priority === 'Acil' ? 'High' : priority === 'Yüksek' ? 'Medium' : 'Normal'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="label">Trade</span>
                  <span className="value capitalize">{pinCategory}</span>
                </div>
              </div>

              <div className="info-card media-card">
                <div className="media-header">
                  <h4><Images size={16} /> Media</h4>
                  <span className="file-count">{files.length} Files</span>
                </div>
                <div className="media-list">
                  {files.slice(0, 3).map(f => (
                    f.type?.startsWith('image/') ? (
                      <img key={f.id} src={f.url} alt="" className="media-thumb" onClick={() => window.open(f.url, '_blank')} />
                    ) : (
                      <div key={f.id} className="media-doc-thumb" onClick={() => window.open(f.url, '_blank')}>
                        <FileText size={24} />
                      </div>
                    )
                  ))}
                  {files.length > 3 && (
                    <div className="media-more">+{files.length - 3}</div>
                  )}
                  {(isManager || pin.createdBy === currentUser.uid) && (
                    <label className="media-add">
                      {uploading ? '...' : '+'}
                      <input type="file" hidden onChange={e => handleFileSelect(e, 'files')} accept="image/*,.pdf,.doc,.docx" />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Pinned Message */}
            {displayedMessages.find(m => m.isPinned) && (
              <div className="pinned-message-box">
                <Pin size={16} className="pin-icon" />
                <div>
                  <h5>Pinned Message</h5>
                  <p>{displayedMessages.find(m => m.isPinned).text}</p>
                </div>
              </div>
            )}

            {/* Chat Flow */}
            <div className="chat-flow">
              <div className="chat-date-divider">
                <span>Discussion Started</span>
              </div>
              {displayedMessages.map((msg) => {
                const isMe = msg.userId === currentUser.uid;
                return (
                  <div key={msg.id} className={`chat-message ${isMe ? 'mine' : 'theirs'}`}>
                    <div className="chat-message-inner">
                      {!isMe && <div className="avatar">{msg.userName?.charAt(0).toUpperCase()}</div>}
                      <div className="chat-bubble-wrapper">
                        <div className="chat-meta">
                          <span className="name">{msg.userName}</span>
                          <span className="time">{msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                        </div>
                        <div className="chat-bubble">
                          {msg.replyTo && (
                            <div className="chat-reply-preview">
                              <strong>{msg.replyTo.userName}</strong>
                              {msg.replyTo.text.length > 50 ? msg.replyTo.text.substring(0,50)+'...' : msg.replyTo.text}
                            </div>
                          )}
                          {msg.type === 'image/jpeg' || msg.type === 'image/png' || msg.type === 'image/webp' ? (
                            <img src={msg.fileUrl} alt="Eklenti" className="chat-image" onClick={() => window.open(msg.fileUrl, '_blank')} />
                          ) : msg.fileUrl ? (
                            <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="chat-doc">
                              <FileText size={16} /> {msg.text || 'Dosya'}
                            </a>
                          ) : (
                            renderTextWithMentions(msg.text)
                          )}
                        </div>
                        
                        {/* Hover Actions */}
                        <div className="chat-hover-actions">
                          <button onClick={() => setReplyTo({ id: msg.id, text: msg.text || 'Dosya', userName: msg.userName })}><CornerUpLeft size={14} /></button>
                          {isManager && (
                            <button onClick={() => togglePinMessage(msg.id, msg.isPinned)}>{msg.isPinned ? <PinOff size={14} /> : <Pin size={14} />}</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Message Input Box */}
          <div className="chat-input-container">
            {replyTo && (
              <div className="chat-reply-active">
                <div><strong>Replying to {replyTo.userName}:</strong> {replyTo.text.substring(0, 40)}</div>
                <button onClick={() => setReplyTo(null)}>&times;</button>
              </div>
            )}
            <div className="chat-input-row">
              <label className="attach-btn">
                <Paperclip size={18} />
                <input type="file" hidden onChange={e => handleFileSelect(e, 'chat')} accept="image/*,.pdf,.doc,.docx" />
              </label>
              
              <div className="input-wrapper">
                {showSearch ? (
                  <div className="chat-search-active">
                    <Search size={16} />
                    <input 
                      type="text" 
                      value={chatSearch} 
                      onChange={e => setChatSearch(e.target.value)} 
                      placeholder="Sohbette ara..." 
                      autoFocus
                    />
                    <button onClick={() => { setShowSearch(false); setChatSearch(''); }}>&times;</button>
                  </div>
                ) : (
                  <textarea
                    value={text}
                    onChange={handleTextChange}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message or update..."
                    rows={1}
                  />
                )}
                {showMention && filteredUsers.length > 0 && (
                  <div className="mention-autocomplete">
                    {filteredUsers.map(u => (
                      <div key={u.id || u.name} onClick={() => handleMentionSelect(u.name)} className="mention-item">
                        <div className="mention-avatar">{u.name?.charAt(0)}</div>
                        {u.name}
                      </div>
                    ))}
                  </div>
                )}
                {!showSearch && (
                  <button className="search-toggle-btn" onClick={() => setShowSearch(true)}>
                    <Search size={16} />
                  </button>
                )}
              </div>

              <button 
                className="send-btn"
                onClick={() => sendMessage()}
                disabled={uploading || (!text.trim() && !uploading)}
              >
                {uploading ? <span>...</span> : <Send size={18} />}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}