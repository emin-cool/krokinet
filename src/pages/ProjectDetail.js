import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, addDoc, serverTimestamp, onSnapshot, updateDoc, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import PinDetailModal from '../components/PinDetailModal';

import ProjectGallery from '../components/ProjectGallery';
import ProjectTeam from '../components/ProjectTeam';
import NotificationsDropdown from '../components/NotificationsDropdown';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Building, Ruler, MessageSquare, Info, Users, MapPin, Archive, ArrowLeft } from 'lucide-react';

const PIN_COLORS = { 'açık': '#ef4444', 'devam ediyor': '#f59e0b', 'çözüldü': '#22c55e' };
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

const CLOUDINARY_CLOUD = 'dcx4qribb';
const CLOUDINARY_PRESET = 'insaat-upload';

export default function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const imageRef = useRef(null);

  const [project, setProject] = useState(null);
  const [pins, setPins] = useState([]);
  const [activeTab, setActiveTab] = useState('plan');
  const [activeFloor, setActiveFloor] = useState(0);
  const [pinSearch, setPinSearch] = useState('');
  const [pinFilter, setPinFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [draggingPin, setDraggingPin] = useState(null);
  const [movingPinId, setMovingPinId] = useState(null);
  const [showArchivedPins, setShowArchivedPins] = useState(false);
  const [showArchivedPlans, setShowArchivedPlans] = useState(false);

  const [selectedPin, setSelectedPin] = useState(null);
  const [addingPin, setAddingPin] = useState(false);
  const [newPinData, setNewPinData] = useState({ title: '', category: 'genel', color: '#3b82f6' });
  const [newPinCoords, setNewPinCoords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPlan, setUploadingPlan] = useState(false);
  const [uploadingProjectFile, setUploadingProjectFile] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [projectInfo, setProjectInfo] = useState({});
  const [editingFloorIndex, setEditingFloorIndex] = useState(null);
  const [editingFloorName, setEditingFloorName] = useState('');

  useEffect(() => {
    fetchProject();
    const unsub = onSnapshot(
      query(collection(db, 'pins'), where('projectId', '==', projectId)),
      snap => {
        const loadedPins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPins(loadedPins);
        
        // Bildirimden gelen pin parametresini kontrol et
        const pinIdFromUrl = searchParams.get('pin');
        if (pinIdFromUrl && !selectedPin) {
          const targetPin = loadedPins.find(p => p.id === pinIdFromUrl);
          if (targetPin) {
            setSelectedPin(targetPin);
            setSearchParams({}, { replace: true }); // URL'den ?pin= parametresini temizle
          }
        }
      }
    );
    return () => unsub();
  }, [projectId]);

  useEffect(() => {
    // Proje sayfasındayken yeni bir bildirime tıklanırsa pini aç
    const pinIdFromUrl = searchParams.get('pin');
    if (pinIdFromUrl && pins.length > 0) {
      const targetPin = pins.find(p => p.id === pinIdFromUrl);
      if (targetPin) {
        setSelectedPin(targetPin);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, pins, setSearchParams]);

  async function fetchProject() {
    const snap = await getDoc(doc(db, 'projects', projectId));
    if (snap.exists()) {
      const data = { id: snap.id, ...snap.data() };
      setProject(data);
      setProjectInfo({ name: data.name, description: data.description, address: data.address, startDate: data.startDate, notes: data.notes || '' });
    }
    setLoading(false);
  }

  async function deleteFloorPlan(index, name) {
    if (!window.confirm(`"${name}" kat planını sildiğinizde bu plana ait TÜM PİNLER, MESAJLAR VE DOSYALAR geri döndürülemez şekilde silinecektir. Emin misiniz?`)) return;
    
    try {
      // Find all pins on this floor
      const qPins = query(collection(db, 'pins'), where('projectId', '==', projectId), where('floorIndex', '==', index));
      const pinsSnap = await getDocs(qPins);
      
      const batch = writeBatch(db);
      
      for (const pinDoc of pinsSnap.docs) {
        // Fetch and delete messages
        const qMessages = query(collection(db, 'messages'), where('pinId', '==', pinDoc.id));
        const messagesSnap = await getDocs(qMessages);
        messagesSnap.docs.forEach(m => batch.delete(m.ref));
        
        // Fetch and delete files
        const qFiles = query(collection(db, 'files'), where('pinId', '==', pinDoc.id));
        const filesSnap = await getDocs(qFiles);
        filesSnap.docs.forEach(f => batch.delete(f.ref));
        
        // Delete the pin itself
        batch.delete(pinDoc.ref);
      }
      
      // Commit the batch delete
      await batch.commit();

      // Update the floor plan array in the project
      const updatedPlans = project.floorPlans.filter((_, i) => i !== index);
      // We must also decrement floorIndex for pins on floors above this one to keep references valid!
      // This is necessary because array elements shift down.
      const qAllPins = query(collection(db, 'pins'), where('projectId', '==', projectId));
      const allPinsSnap = await getDocs(qAllPins);
      const shiftBatch = writeBatch(db);
      allPinsSnap.docs.forEach(p => {
        const pData = p.data();
        if (pData.floorIndex > index) {
          shiftBatch.update(p.ref, { floorIndex: pData.floorIndex - 1 });
        }
      });
      await shiftBatch.commit();
      
      await updateDoc(doc(db, 'projects', projectId), { floorPlans: updatedPlans });
      setActiveFloor(0);
      fetchProject();
    } catch (error) {
      console.error("Kat silinirken hata:", error);
      alert("Silme işlemi sırasında bir hata oluştu.");
    }
  }

  async function toggleArchiveFloorPlan(index, currentStatus) {
    if (!window.confirm(`Kat planını ${currentStatus ? 'arşivden çıkarmak' : 'arşivlemek'} istediğinize emin misiniz?`)) return;
    try {
      const updatedPlans = [...project.floorPlans];
      updatedPlans[index] = { ...updatedPlans[index], isArchived: !currentStatus };
      await updateDoc(doc(db, 'projects', projectId), { floorPlans: updatedPlans });
      if (!currentStatus && activeFloor === index) {
        setActiveFloor(0);
      }
      fetchProject();
    } catch (error) {
      console.error("Hata:", error);
      alert("İşlem sırasında bir hata oluştu.");
    }
  }

  async function renameFloorPlan(index, newName) {
    if (!newName.trim()) { setEditingFloorIndex(null); return; }
    const updatedPlans = project.floorPlans.map((fp, i) =>
      i === index ? { ...fp, name: newName.trim() } : fp
    );
    await updateDoc(doc(db, 'projects', projectId), { floorPlans: updatedPlans });
    setEditingFloorIndex(null);
    fetchProject();
  }

  async function uploadFloorPlan(e) {
    const file = e.target.files[0];
    if (!file) return;

    const isConfirm = window.confirm('Lütfen kalite kaybını önlemek için telefon ekran görüntüsü (screenshot) yerine doğrudan orijinal PDF veya yüksek çözünürlüklü imaj yükleyin. Devam edilsin mi?');
    if (!isConfirm) {
      e.target.value = '';
      return;
    }

    const planName = window.prompt('Bu kat planının adını girin (örn: Kat 1, Bahçe):');
    if (!planName) {
      e.target.value = '';
      return;
    }
    setUploadingPlan(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      let imageUrl = data.secure_url;
      if (file.type === 'application/pdf') {
        imageUrl = data.secure_url
          .replace('/upload/', '/upload/f_jpg,pg_1/')
          .replace(/\.pdf$/, '.jpg');
      }
      const updatedPlans = [...(project.floorPlans || []), { name: planName.trim(), imageUrl }];
      await updateDoc(doc(db, 'projects', projectId), { floorPlans: updatedPlans });
      fetchProject();
    } catch (err) { alert('Yükleme başarısız'); }
    setUploadingPlan(false);
    e.target.value = '';
  }

  async function uploadProjectFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingProjectFile(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      const fileUrl = data.secure_url;
      const updatedFiles = [...(project.projectFiles || []), { name: file.name, url: fileUrl }];
      await updateDoc(doc(db, 'projects', projectId), { projectFiles: updatedFiles });
      fetchProject();
    } catch (err) { alert('Dosya yükleme başarısız'); }
    setUploadingProjectFile(false);
    e.target.value = '';
  }

  function handleImageClick(e) {
    if (!canAddPin || !addingPin || newPinCoords) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setNewPinCoords({ x, y });
    e.stopPropagation();
  }

  const handlePinPointerDown = (e, pin) => {
    // Sadece taşıma modu aktifse sürüklemeye izin ver
    if (movingPinId === pin.id) {
      e.stopPropagation();
      setDraggingPin({ id: pin.id, x: pin.x, y: pin.y });
    }
  };

  const handlePointerMove = (e) => {
    if (!draggingPin) return;
    const rect = imageRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    if (!clientX) return;

    let x = ((clientX - rect.left) / rect.width) * 100;
    let y = ((clientY - rect.top) / rect.height) * 100;
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    setDraggingPin(prev => ({ ...prev, x, y }));
  };

  const handlePointerUp = async () => {
    if (draggingPin && draggingPin.x !== undefined) {
      await updateDoc(doc(db, 'pins', draggingPin.id), { x: draggingPin.x, y: draggingPin.y });
      setMovingPinId(null); // Taşıma modunu kapat
    }
    setDraggingPin(null);
  };

  async function savePin() {
    if (!newPinData.title || !newPinCoords) return;
      const docRef = await addDoc(collection(db, 'pins'), {
        ...newPinData,
        x: newPinCoords.x,
        y: newPinCoords.y,
        projectId,
        floorPlanIndex: activeFloor,
        status: 'açık',
        color: CATEGORY_COLORS[newPinData.category] || '#3b82f6',
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        assignee: newPinData.assignee || ''
      });

      // Bildirim gönder (Eğer birisi atandıysa ve atanan kişi ben değilsem)
      if (newPinData.assignee && newPinData.assignee !== userData?.name) {
        // Find assigned user's ID
        const membersSnapshot = await getDocs(query(collection(db, 'users'), where('name', '==', newPinData.assignee)));
        if (!membersSnapshot.empty) {
          const assignedUser = membersSnapshot.docs[0];
          await addDoc(collection(db, 'notifications'), {
            userId: assignedUser.id,
            projectId: projectId,
            type: 'assigned',
            message: `${userData?.name}, sana "${newPinData.title}" adında yeni bir görev (pin) atadı.`,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      }

      setAddingPin(false);
    setNewPinData({ title: '', category: 'genel', assignee: '' });
    setNewPinCoords(null);
  }

  async function saveProjectInfo() {
    await updateDoc(doc(db, 'projects', projectId), projectInfo);
    setEditingInfo(false);
    fetchProject();
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;
  if (!project) return <div className="loading">Proje bulunamadı.</div>;

  const userRoleInProject = project.memberRoles?.[currentUser?.uid] || 'viewer';
  const isManager = project.managerId === currentUser?.uid || userRoleInProject === 'manager' || userData?.isSuperAdmin;
  const canAddPin = isManager;
  const canManageTeam = isManager;
  const currentFloorPins = pins.filter(p => {
    if (p.floorPlanIndex !== activeFloor) return false;
    
    // Filtreleme
    if (pinFilter === 'open' && p.status !== 'açık') return false;
    if (pinFilter === 'resolved' && p.status !== 'çözüldü') return false;
    if (pinFilter === 'mine' && p.assignee !== userData?.name) return false;
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;

    // Arama
    if (pinSearch) {
      const search = pinSearch.toLowerCase();
      const titleMatch = p.title?.toLowerCase().includes(search);
      const assigneeMatch = p.assignee?.toLowerCase().includes(search);
      if (!titleMatch && !assigneeMatch) return false;
    }
    
    if (p.isArchived) return false;

    return true;
  });

  const archivedPins = pins.filter(p => p.isArchived);
  const archivedPlans = project?.floorPlans?.filter(fp => fp.isArchived) || [];

  const floorPlans = project.floorPlans || [];

  return (
    <div className="project-detail">
      <div className="detail-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'var(--bg-surface)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-card-hover)', border: 'none', cursor: 'pointer', transition: 'all 0.2s', color: 'var(--text-main)' }}
            className="back-btn-hover"
            title="Geri Dön"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="projects-top-left" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px' }} onClick={() => navigate('/')}>
            <img src="/logo.png" alt="Şanti Logo" style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>{project.name}</h1>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>{userData?.name} ({userData?.role})</p>
            </div>
          </div>
        </div>
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <NotificationsDropdown />
          <button className="btn-secondary" onClick={() => navigate('/profile')} style={{ borderRadius: '20px', padding: '8px 16px', fontWeight: 600 }}>Profilim</button>
        </div>
      </div>

      <div className="detail-tabs">
        <button className={activeTab === 'plan' ? 'tab active' : 'tab'} onClick={() => setActiveTab('plan')}>
          <Ruler size={16} style={{ marginRight: '6px' }} /> Kat Planı
        </button>
        <button className={activeTab === 'info' ? 'projects-tab active' : 'projects-tab'}
          onClick={() => setActiveTab('info')}>
          <Info size={16} style={{ marginRight: '6px' }} /> Proje Bilgileri
        </button>
        <button className={activeTab === 'team' ? 'tab active' : 'tab'} onClick={() => setActiveTab('team')}>
          <Users size={16} style={{ marginRight: '6px' }} /> Ekip
        </button>
        {isManager && (
          <button className={activeTab === 'archive' ? 'tab active' : 'tab'} onClick={() => setActiveTab('archive')}>
            <Archive size={16} style={{ marginRight: '6px' }} /> Arşiv
          </button>
        )}
      </div>

      {activeTab === 'plan' && (
        <div className="plan-view">
          <div className="floor-tabs" style={{ marginTop: 16 }}>
            {floorPlans.map((fp, i) => {
              if (fp.isArchived) return null;
              return (
              <div key={i} className="floor-tab-wrapper">
                <button className={activeFloor === i ? 'floor-tab active' : 'floor-tab'} onClick={() => setActiveFloor(i)} style={{ opacity: fp.isArchived ? 0.6 : 1, filter: fp.isArchived ? 'grayscale(100%)' : 'none' }}>
                  {editingFloorIndex === i ? (
                    <input
                      className="floor-tab-input"
                      value={editingFloorName}
                      onChange={e => setEditingFloorName(e.target.value)}
                      onBlur={() => renameFloorPlan(i, editingFloorName)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') renameFloorPlan(i, editingFloorName);
                        if (e.key === 'Escape') setEditingFloorIndex(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <span onDoubleClick={() => isManager && setEditingFloorIndex(i)}>
                      {fp.name} {fp.isArchived && '(Arşiv)'}
                    </span>
                  )}
                </button>
                {isManager && (
                  <div style={{ display: 'flex' }}>
                    <button className="floor-tab-delete" onClick={() => toggleArchiveFloorPlan(i, fp.isArchived)} style={{ color: '#4b5563', padding: '0 4px' }} title={fp.isArchived ? 'Arşivden Çıkar' : 'Arşivle'}>
                      📦
                    </button>
                    <button className="floor-tab-delete" onClick={() => deleteFloorPlan(i, fp.name)}>X</button>
                  </div>
                )}
              </div>
            )})}
          </div>

          <div className="plan-toolbar">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {isManager && project.floorPlans && project.floorPlans.length > 0 && (
                  <>
                    <button className="btn-primary desktop-new-pin-btn" onClick={() => setAddingPin(!addingPin)}>
                      {addingPin ? '✕ İptal' : '📍 Yeni Pin (Sorun/İş)'}
                    </button>
                    <button className="fab-button" onClick={() => setAddingPin(!addingPin)}>
                      {addingPin ? '✕' : '+'}
                    </button>
                  </>
                )}
              </div>
            {addingPin && (
              <div className="pin-form">
                {!newPinCoords ? (
                  <span className="pin-hint">👆 Plana tıklayarak konum seçin</span>
                ) : (
                  <>
                    <input placeholder="Pin başlığı *" value={newPinData.title}
                      onChange={e => setNewPinData({...newPinData, title: e.target.value})} />
                    <select value={newPinData.category}
                      onChange={e => {
                        const newCat = e.target.value;
                        setNewPinData({...newPinData, category: newCat, color: CATEGORY_COLORS[newCat]});
                      }}>
                      <option value="" disabled>İş Türü Seçin</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button className="btn-primary" onClick={savePin}>Kaydet</button>
                  </>
                )}
                <button className="btn-secondary" onClick={() => { setAddingPin(false); setNewPinCoords(null); }}>İptal</button>
              </div>
            )}
            {isManager && (
              <label className="btn-secondary" style={{ cursor: 'pointer' }}>
                {uploadingPlan ? 'Yükleniyor...' : '🗺️ Plan Yükle'}
                <input type="file" hidden accept="image/*,.pdf" onChange={uploadFloorPlan} />
              </label>
            )}
          </div>

          {floorPlans.length === 0 ? (
            <div className="empty-state">Henüz kat planı yüklenmemiş.</div>
          ) : (
            <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative' }}>
              <div style={{ display: 'flex', gap: 10, padding: '16px', alignItems: 'center', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <input 
                  placeholder="🔍 Pin Ara (Başlık veya Sorumlu)" 
                  value={pinSearch} 
                  onChange={e => setPinSearch(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                />
                <select 
                  value={categoryFilter} 
                  onChange={e => setCategoryFilter(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', width: 160, background: 'var(--bg-main)', color: 'var(--text-main)', textTransform: 'capitalize' }}
                >
                  <option value="all">Tüm İşler</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select 
                  value={pinFilter} 
                  onChange={e => setPinFilter(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', width: 200, background: 'var(--bg-main)', color: 'var(--text-main)' }}
                >
                  <option value="all">Tüm Durumlar</option>
                  <option value="open">🔴 Sadece Açıklar</option>
                  <option value="resolved">🟢 Çözülenler</option>
                  <option value="mine">👤 Bana Atananlar</option>
                </select>
              </div>

              <TransformWrapper
                initialScale={1}
                minScale={1}
                maxScale={10}
                limitToBounds={true}
                centerZoomedOut={true}
                disabled={addingPin && !newPinCoords}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    
                    {/* Lejant (Kategori Renkleri) */}
                    <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 100, background: 'var(--bg-main)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>İş Türleri</span>
                      {Object.entries(CATEGORY_COLORS).map(([cat, col]) => (
                        <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 14, height: 14, borderRadius: '50%', background: col }} />
                          <span style={{ fontSize: 13, color: 'var(--text-main)', textTransform: 'capitalize' }}>{cat}</span>
                        </div>
                      ))}
                    </div>

                    <div className="zoom-controls">
                      <button className="zoom-btn" onClick={() => zoomIn()}>+</button>
                      <button className="zoom-btn" onClick={() => zoomOut()}>-</button>
                      <button className="zoom-btn" onClick={() => resetTransform()}>⟲</button>
                    </div>
                    <TransformComponent wrapperStyle={{ width: "100%", height: "70vh", backgroundColor: "var(--bg-main)", cursor: (addingPin && !newPinCoords) ? 'crosshair' : 'grab' }}>
                      <div
                        className={`floor-plan-wrapper ${addingPin && !newPinCoords ? 'crosshair' : ''}`}
                        onClick={handleImageClick}
                        onMouseMove={handlePointerMove}
                        onMouseUp={handlePointerUp}
                        onMouseLeave={handlePointerUp}
                        onTouchMove={handlePointerMove}
                        onTouchEnd={handlePointerUp}
                        ref={imageRef}
                        style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}
                      >
                        <img src={floorPlans[activeFloor]?.imageUrl} alt="Kat Planı" draggable={false} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        {currentFloorPins.map(pin => {
                          const isDragging = draggingPin?.id === pin.id;
                          const currentX = isDragging ? draggingPin.x : pin.x;
                          const currentY = isDragging ? draggingPin.y : pin.y;
                          
                          return (
                            <div key={pin.id} className="pin-marker-custom"
                              style={{ 
                                left: `${currentX}%`, 
                                top: `${currentY}%`, 
                                background: pin.isArchived ? '#9ca3af' : (pin.color || CATEGORY_COLORS[pin.category] || PIN_COLORS[pin.status] || '#F59E0B'),
                                opacity: pin.isArchived ? 0.7 : 1,
                                filter: pin.isArchived ? 'grayscale(100%)' : 'none',
                                cursor: movingPinId === pin.id ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                                zIndex: isDragging ? 1000 : 10,
                                animation: movingPinId === pin.id && !isDragging ? 'pulse 1s infinite' : 'none',
                                boxShadow: movingPinId === pin.id ? '0 0 0 4px rgba(59,130,246,0.6)' : undefined
                              }}
                              onMouseDown={e => handlePinPointerDown(e, pin)}
                              onTouchStart={e => handlePinPointerDown(e, pin)}
                              onClick={e => { e.stopPropagation(); if (!movingPinId && !isDragging) setSelectedPin(pin); }}
                              onTouchEnd={e => { if (!movingPinId && !isDragging) { e.stopPropagation(); setSelectedPin(pin); } }}
                            >
                              <div className="pin-tooltip">
                                {pin.title}
                                {isManager && movingPinId !== pin.id && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setMovingPinId(pin.id); }}
                                    style={{ marginLeft: 8, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    ✥ Taşı
                                  </button>
                                )}
                                {movingPinId === pin.id && !isDragging && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setMovingPinId(null); }}
                                    style={{ marginLeft: 8, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    ✕ İptal
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {newPinCoords && (
                          <div className="pin-marker-custom" style={{ left: `${newPinCoords.x}%`, top: `${newPinCoords.y}%`, background: newPinData.color }}>
                            <div className="pin-tooltip">Yeni Pin</div>
                          </div>
                        )}
                      </div>
                    </TransformComponent>
                  </div>
                )}
              </TransformWrapper>
            </div>
          )}
        </div>
      )}

      {activeTab === 'archive' && isManager && (
        <div className="archive-view" style={{ padding: '24px', background: 'var(--bg-card)', minHeight: '60vh', borderRadius: '12px', marginTop: '16px' }}>
          <h2 style={{ fontSize: 18, marginBottom: 20 }}>📦 Arşivlenen İçerikler</h2>
          
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 16, color: 'var(--text-muted)', marginBottom: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>Arşivlenen Kat Planları</h3>
            {archivedPlans.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Arşivlenmiş kat planı bulunmuyor.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                {project.floorPlans.map((fp, i) => {
                  if (!fp.isArchived) return null;
                  return (
                    <div key={i} style={{ padding: 16, border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-main)', position: 'relative' }}>
                      <p style={{ fontWeight: 'bold', marginBottom: 8 }}>{fp.name}</p>
                      <button className="btn-secondary" onClick={() => toggleArchiveFloorPlan(i, fp.isArchived)} style={{ width: '100%' }}>Arşivden Çıkar</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h3 style={{ fontSize: 16, color: 'var(--text-muted)', marginBottom: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>Arşivlenen Pinler</h3>
            {archivedPins.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Arşivlenmiş pin bulunmuyor.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
                {archivedPins.map(pin => (
                  <div key={pin.id} style={{ padding: 16, border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-main)', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => setSelectedPin(pin)} className="archived-pin-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: pin.color || '#F59E0B' }} />
                      <span style={{ fontWeight: 'bold' }}>{pin.title}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pin.category} • Kat: {project.floorPlans[pin.floorIndex]?.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'info' && (
        <div className="info-view">
          {isManager && !editingInfo && (
            <button className="btn-primary" onClick={() => setEditingInfo(true)}>✏️ Düzenle</button>
          )}
          {editingInfo ? (
            <div className="info-form">
              <label>Proje Adı</label>
              <input value={projectInfo.name || ''} onChange={e => setProjectInfo({...projectInfo, name: e.target.value})} />
              <label>Açıklama</label>
              <input value={projectInfo.description || ''} onChange={e => setProjectInfo({...projectInfo, description: e.target.value})} />
              <label>Adres</label>
              <input value={projectInfo.address || ''} onChange={e => setProjectInfo({...projectInfo, address: e.target.value})} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label>Başlangıç Tarihi</label>
                  <input type="date" value={projectInfo.startDate || ''} onChange={e => setProjectInfo({...projectInfo, startDate: e.target.value})} />
                </div>
                <div>
                  <label>Hedef Bitiş</label>
                  <input type="date" value={projectInfo.endDate || ''} onChange={e => setProjectInfo({...projectInfo, endDate: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label>Durum</label>
                  <select value={projectInfo.status || 'devam ediyor'} onChange={e => setProjectInfo({...projectInfo, status: e.target.value})} style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-main)', border: '1.5px solid var(--border-color)', borderRadius: 8, color: 'var(--text-main)' }}>
                    <option value="planlama">🏗️ Planlama</option>
                    <option value="devam ediyor">🚧 Devam Ediyor</option>
                    <option value="duraklatıldı">⏸️ Duraklatıldı</option>
                    <option value="tamamlandı">✅ Tamamlandı</option>
                  </select>
                </div>
                <div>
                  <label>İlerleme Yüzdesi (%)</label>
                  <input type="number" min="0" max="100" value={projectInfo.progress || 0} onChange={e => setProjectInfo({...projectInfo, progress: Number(e.target.value)})} />
                </div>
              </div>
              <label>Genel Notlar</label>
              <textarea value={projectInfo.notes || ''} onChange={e => setProjectInfo({...projectInfo, notes: e.target.value})} rows={4} style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }} />
              
              <div className="dashboard-card" style={{ marginTop: 20, marginBottom: 20 }}>
                <div className="dashboard-card-title">📁 PROJE DOSYALARI (DWG, Render, PDF vs.)</div>
                {isManager && (
                  <label className="btn-secondary" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: 16 }}>
                    {uploadingProjectFile ? 'Yükleniyor...' : '➕ Yeni Dosya Yükle'}
                    <input type="file" hidden onChange={uploadProjectFile} />
                  </label>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(project.projectFiles || []).length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Henüz dosya yüklenmemiş.</p>
                  ) : (
                    project.projectFiles.map((f, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: 14, color: 'var(--text-main)', wordBreak: 'break-all' }}>{f.name}</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <a href={f.url} target="_blank" rel="noreferrer" className="btn-primary" style={{ padding: '6px 12px', textDecoration: 'none', fontSize: 12 }}>İndir</a>
                          {isManager && (
                            <button className="btn-danger" style={{ padding: '6px 12px', fontSize: 12 }} onClick={async () => {
                              if (window.confirm('Dosyayı silmek istediğinize emin misiniz?')) {
                                const updatedFiles = project.projectFiles.filter((_, idx) => idx !== i);
                                await updateDoc(doc(db, 'projects', projectId), { projectFiles: updatedFiles });
                                fetchProject();
                              }
                            }}>Sil</button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn-primary" onClick={saveProjectInfo}>Kaydet</button>
                <button className="btn-secondary" onClick={() => setEditingInfo(false)}>İptal</button>
              </div>
            </div>
          ) : (
            <div className="project-dashboard">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="dashboard-card">
                  <div className="dashboard-card-title">📊 PROJE İLERLEMESİ</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <span className={`status-label ${project.status?.toLowerCase().replace(' ', '') || 'devamediyor'}`}>{project.status?.toUpperCase() || 'DEVAM EDİYOR'}</span>
                    <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary-color)' }}>%{project.progress || 0}</span>
                  </div>
                  <div className="progress-container">
                    <div className="progress-fill" style={{ width: `${project.progress || 0}%` }}></div>
                  </div>
                </div>

                <div className="dashboard-card">
                  <div className="dashboard-card-title">📋 GENEL BİLGİLER</div>
                  <div className="dashboard-stat-row">
                    <span className="dashboard-stat-label">Açıklama</span>
                    <span className="dashboard-stat-value">{project.description || '-'}</span>
                  </div>
                  <div className="dashboard-stat-row">
                    <span className="dashboard-stat-label">Adres</span>
                    <span className="dashboard-stat-value">📍 {project.address || '-'}</span>
                  </div>
                </div>

                <div className="dashboard-card">
                  <div className="dashboard-card-title">📝 NOTLAR</div>
                  <p style={{ fontSize: 14, color: 'var(--text-main)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{project.notes || 'Henüz not eklenmemiş.'}</p>
                </div>

                <div className="dashboard-card">
                  <div className="dashboard-card-title">📁 PROJE DOSYALARI (DWG, Render, PDF vs.)</div>
                  {isManager && (
                    <label className="btn-secondary" style={{ cursor: 'pointer', display: 'inline-block', marginBottom: 16 }}>
                      {uploadingProjectFile ? 'Yükleniyor...' : '➕ Yeni Dosya Yükle'}
                      <input type="file" hidden onChange={uploadProjectFile} />
                    </label>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(project.projectFiles || []).length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Henüz dosya yüklenmemiş.</p>
                    ) : (
                      project.projectFiles.map((f, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: 14, color: 'var(--text-main)', wordBreak: 'break-all' }}>{f.name}</span>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <a href={f.url} target="_blank" rel="noreferrer" className="btn-primary" style={{ padding: '6px 12px', textDecoration: 'none', fontSize: 12 }}>İndir</a>
                            {isManager && (
                              <button className="btn-danger" style={{ padding: '6px 12px', fontSize: 12 }} onClick={async () => {
                                if (window.confirm('Dosyayı silmek istediğinize emin misiniz?')) {
                                  const updatedFiles = project.projectFiles.filter((_, idx) => idx !== i);
                                  await updateDoc(doc(db, 'projects', projectId), { projectFiles: updatedFiles });
                                  fetchProject();
                                }
                              }}>Sil</button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="dashboard-card">
                  <div className="dashboard-card-title">📅 ZAMAN ÇİZELGESİ</div>
                  <div className="timeline-row">
                    <div className="timeline-date">
                      <span>Başlangıç</span>
                      <span>{project.startDate || '-'}</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <div className="timeline-date" style={{ alignItems: 'flex-end' }}>
                      <span>Hedef Bitiş</span>
                      <span>{project.endDate || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'team' && <ProjectTeam projectId={projectId} isManager={canManageTeam} />}

      {selectedPin && (
        <PinDetailModal pin={selectedPin} projectId={projectId} isManager={isManager} onClose={() => setSelectedPin(null)} />
      )}
    </div>
  );
}