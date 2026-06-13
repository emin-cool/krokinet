import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { X, Send, Paperclip, FileText, CornerUpLeft, Search, Pin, PinOff, Info, Images, MapPin, UserCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ImageMarkupModal from './ImageMarkupModal';
import { CATEGORY_COLORS } from '../utils/constants';
import './PinDetailModal.css';

const CLOUDINARY_PRESET = 'insaat_preset';
const CLOUDINARY_CLOUD = 'dfl7x5dud';

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
  
  const [activeAccordion, setActiveAccordion] = useState(null);
  
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
    const messageText = text.trim();
    if (!messageText && !fileUrl) return;
    try {
      await addDoc(collection(db, 'messages'), {
        pinId: pin.id,
        projectId,
        text: messageText,
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

      // Handle Mentions
      const mentionedNames = messageText.match(/@([\wçğıöşüÇĞİÖŞÜ]+(?:\s[\wçğıöşüÇĞİÖŞÜ]+)?)/g);
      if (mentionedNames) {
        for (const mention of mentionedNames) {
          const name = mention.substring(1).toLowerCase();
          // Find matching user
          const mentionedUser = users.find(u => 
            u.name && u.name.toLowerCase().startsWith(name) && u.id !== currentUser.uid
          );
          if (mentionedUser) {
            await addDoc(collection(db, 'notifications'), {
              userId: mentionedUser.id,
              projectId,
              pinId: pin.id,
              message: `${userData?.name || 'Biri'} seni "${pin.title || 'bir pin'}" içinde etiketledi.`,
              type: 'mention',
              read: false,
              createdAt: serverTimestamp()
            });
          }
        }
      }

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
    uploadToCloudinary(blob, markupTarget, description);
    setMarkupImageUrl(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  async function handleUpdateInfo() {
    if (!pin) return;
    try {
      await updateDoc(doc(db, 'pins', pin.id), { info: pinInfo });
      // alert('Bilgi güncellendi!');
    } catch (e) {
      console.error("Error updating info:", e);
    }
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
                    <span className="category-badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: CATEGORY_COLORS[(p.category || 'genel').toLowerCase()] || 'var(--primary-color)' }}></span>
                      {(p.category || 'Genel').toUpperCase()}
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
                <span className={`status-badge ${status === 'çözüldü' ? 'resolved' : 'open'}`}>
                  {status === 'çözüldü' ? 'RESOLVED' : 'OPEN'}
                </span>
              </div>
              <div className="header-meta">
                <span><MapPin size={14} /> Zone B, Floor {pin.floorPlanIndex + 1}</span>
                <span><UserCheck size={14} /> Assignee: {pin.assignee || 'Atanmamış'}</span>
              </div>
            </div>
            <button className="close-btn-large" onClick={onClose}>
              <X size={24} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="main-content-scroll">
            
            {/* Big Action Buttons */}
            <div className="big-action-buttons-container">
              <button 
                className={`big-action-btn ${activeAccordion === 'details' ? 'active' : ''}`}
                onClick={() => setActiveAccordion(activeAccordion === 'details' ? null : 'details')}
              >
                <Info size={28} />
                <span>Bilgi</span>
              </button>
              <button 
                className={`big-action-btn ${activeAccordion === 'media' ? 'active' : ''}`}
                onClick={() => setActiveAccordion(activeAccordion === 'media' ? null : 'media')}
              >
                <Images size={28} />
                <span>Medya</span>
              </button>
            </div>

            {activeAccordion === 'details' && (
              <div className="accordion-content">
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Pin Bilgisi
                  </label>
                  <textarea 
                    value={pinInfo}
                    onChange={(e) => setPinInfo(e.target.value)}
                    placeholder="Bu pin hakkında notlar ekleyin..."
                    style={{ 
                      width: '100%', 
                      minHeight: '80px', 
                      padding: '12px', 
                      borderRadius: '8px', 
                      border: '1px solid var(--border-color)', 
                      background: 'var(--bg-main)', 
                      resize: 'vertical',
                      fontSize: '14px',
                      color: 'var(--text-main)',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                    <div className="media-add">
                      <label className="media-add-btn" style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '13px' }}>
                        <Paperclip size={14} /> Dosya Ekle
                        <input type="file" onChange={(e) => handleFileSelect(e, 'files')} style={{ display: 'none' }} />
                      </label>
                    </div>
                    <button 
                      onClick={handleUpdateInfo}
                      style={{ 
                        background: 'var(--primary-color)', 
                        color: 'white', 
                        border: 'none', 
                        padding: '6px 16px', 
                        borderRadius: '6px', 
                        fontSize: '13px', 
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Kaydet
                    </button>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <div className="detail-row">
                    <span className="label">Oluşturuldu</span>
                    <span className="value">{pin.createdAt?.toDate ? pin.createdAt.toDate().toLocaleDateString() : 'Unknown'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Öncelik</span>
                    <span className={`value priority-${priority === 'Acil' ? 'high' : priority === 'Yüksek' ? 'medium' : 'normal'}`}>
                      {priority}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Kategori</span>
                    <span className="value capitalize">{pinCategory}</span>
                  </div>
                </div>
              </div>
            )}

            {activeAccordion === 'media' && (
              <div className="accordion-content">
                <div className="media-header">
                  <h4><Images size={16} /> Dosyalar</h4>
                  <span className="file-count">{files.length} Dosya</span>
                </div>
                <div className="media-list">
                  {files.map(f => (
                    f.type?.startsWith('image/') ? (
                      <img key={f.id} src={f.url} alt="" className="media-thumb" onClick={() => window.open(f.url, '_blank')} />
                    ) : (
                      <div key={f.id} className="media-doc-thumb" onClick={() => window.open(f.url, '_blank')}>
                        <FileText size={24} />
                      </div>
                    )
                  ))}
                  {(isManager || pin.createdBy === currentUser.uid) && (
                    <label className="media-add">
                      {uploading ? '...' : '+'}
                      <input type="file" hidden onChange={e => handleFileSelect(e, 'files')} accept="image/*,.pdf,.doc,.docx" />
                    </label>
                  )}
                </div>
              </div>
            )}

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