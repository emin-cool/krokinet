/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, addDoc, serverTimestamp, onSnapshot, updateDoc, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import PinDetailModal from '../components/PinDetailModal';
import { CATEGORY_COLORS, PIN_COLORS } from '../utils/constants';

import ProjectGallery from '../components/ProjectGallery';
import ProjectTeam from '../components/ProjectTeam';
import ProjectSchedule from '../components/ProjectSchedule';
import NotificationsDropdown from '../components/NotificationsDropdown';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Building, Ruler, MessageSquare, Info, Users, MapPin, Archive, ArrowLeft, CalendarDays, Trash2 } from 'lucide-react';

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
  const [mapRotation, setMapRotation] = useState(0);
  const [activeFolder, setActiveFolder] = useState(null);

  useEffect(() => {
    fetchProject();
    const unsub = onSnapshot(
      query(collection(db, 'pins'), where('projectId', '==', projectId)),
      snap => {
        const loadedPins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPins(loadedPins);
        setSelectedPin(prev => prev ? loadedPins.find(p => p.id === prev.id) || null : null);
        
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
      const qPins = query(collection(db, 'pins'), where('projectId', '==', projectId), where('floorPlanIndex', '==', index));
      const pinsSnap = await getDocs(qPins);
      
      let batch = writeBatch(db);
      let opCount = 0;
      
      for (const pinDoc of pinsSnap.docs) {
        const qMessages = query(collection(db, 'messages'), where('pinId', '==', pinDoc.id));
        const messagesSnap = await getDocs(qMessages);
        for (const m of messagesSnap.docs) {
          batch.delete(m.ref);
          opCount++;
          if (opCount >= 450) { await batch.commit(); batch = writeBatch(db); opCount = 0; }
        }
        
        const qFiles = query(collection(db, 'files'), where('pinId', '==', pinDoc.id));
        const filesSnap = await getDocs(qFiles);
        for (const f of filesSnap.docs) {
          batch.delete(f.ref);
          opCount++;
          if (opCount >= 450) { await batch.commit(); batch = writeBatch(db); opCount = 0; }
        }
        
        batch.delete(pinDoc.ref);
        opCount++;
        if (opCount >= 450) { await batch.commit(); batch = writeBatch(db); opCount = 0; }
      }
      
      if (opCount > 0) await batch.commit();

      // Update the floor plan array in the project
      const updatedPlans = project.floorPlans.filter((_, i) => i !== index);
      // We must also decrement floorIndex for pins on floors above this one to keep references valid!
      // This is necessary because array elements shift down.
      const qAllPins = query(collection(db, 'pins'), where('projectId', '==', projectId));
      const allPinsSnap = await getDocs(qAllPins);
      const shiftBatch = writeBatch(db);
      allPinsSnap.docs.forEach(p => {
        const pData = p.data();
        if (pData.floorPlanIndex > index) {
          shiftBatch.update(p.ref, { floorPlanIndex: pData.floorPlanIndex - 1 });
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
        const fallback = floorPlans.findIndex((fp, i) => i !== index && !fp.isArchived);
        setActiveFloor(fallback >= 0 ? fallback : 0);
      }
      fetchProject();
    } catch (error) {
      console.error("Hata:", error);
      alert("İşlem sırasında bir hata oluştu.");
    }
  }

  async function renameFloorPlan(index, newName) {
    if (!newName.trim()) { setEditingFloorIndex(null); return; }
    try {
      const updatedPlans = project.floorPlans.map((fp, i) =>
        i === index ? { ...fp, name: newName.trim() } : fp
      );
      await updateDoc(doc(db, 'projects', projectId), { floorPlans: updatedPlans });
      setEditingFloorIndex(null);
      fetchProject();
    } catch (err) {
      alert('Yeniden adlandırma başarısız.');
    }
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
      if (!res.ok || data.error) { alert('Dosya yüklenemedi.'); setUploadingPlan(false); return; }
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

  async function createNewFolder() {
    const folderName = window.prompt('Yeni klasör adı:');
    if (!folderName || !folderName.trim()) return;
    try {
      const updatedFolders = [...(project.projectFolders || []), folderName.trim()];
      await updateDoc(doc(db, 'projects', projectId), { projectFolders: updatedFolders });
      fetchProject();
    } catch (err) { alert('Klasör oluşturulamadı.'); }
  }

  async function deleteFolder(folderName) {
    const filesInFolder = (project.projectFiles || []).filter(f => f.folder === folderName);
    if (filesInFolder.length > 0) {
      alert(`Bu klasörün içinde ${filesInFolder.length} adet dosya var. Klasörü silmek için önce içindeki dosyaları silmelisiniz.`);
      return;
    }
    if (window.confirm(`"${folderName}" klasörünü silmek istediğinize emin misiniz?`)) {
      const updatedFolders = (project.projectFolders || []).filter(f => f !== folderName);
      await updateDoc(doc(db, 'projects', projectId), { projectFolders: updatedFolders });
      fetchProject();
    }
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
      const updatedFiles = [...(project.projectFiles || []), { name: file.name, url: fileUrl, folder: activeFolder }];
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
      try {
        await updateDoc(doc(db, 'pins', draggingPin.id), { x: draggingPin.x, y: draggingPin.y });
      } catch (err) {
        alert('Pin konumu güncellenemedi.');
      }
      setMovingPinId(null);
    }
    setDraggingPin(null);
  };

  async function savePin() {
    if (!newPinData.title || !newPinCoords) return;
    try {
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

      if (newPinData.assignee && newPinData.assignee !== userData?.name) {
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
    } catch (err) {
      alert('Pin kaydedilirken hata oluştu: ' + err.message);
    }
  }

  async function saveProjectInfo() {
    try {
      await updateDoc(doc(db, 'projects', projectId), projectInfo);
      setEditingInfo(false);
      fetchProject();
    } catch (err) {
      alert('Bilgiler kaydedilirken hata oluştu.');
      return;
    }
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
          <div className="projects-top-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="app-logo-container" style={{ width: '56px', height: '56px' }}>
              <img src="/logo.png" alt="Yapı Chat Logo" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{project.name}</h1>
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
        <button className={activeTab === 'info' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('info')}>
          <Info size={16} style={{ marginRight: '6px' }} /> Proje Bilgileri
        </button>
        <button className={activeTab === 'schedule' ? 'tab active' : 'tab'} onClick={() => setActiveTab('schedule')}>
          <CalendarDays size={16} style={{ marginRight: '6px' }} /> İş Programı
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
            {isManager && (
              <>
                <button className="btn-primary desktop-new-pin-btn" onClick={() => setAddingPin(!addingPin)} style={{ padding: '6px 14px', fontSize: 12, borderRadius: 8 }}>
                  {addingPin ? '✕' : '📍 Pin'}
                </button>
                <button className="fab-button" onClick={() => setAddingPin(!addingPin)}>
                  {addingPin ? '✕' : '+'}
                </button>
                <label style={{ padding: '6px 14px', fontSize: 12, borderRadius: 8, cursor: 'pointer', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }} className="hide-on-mobile">
                  {uploadingPlan ? '...' : '🗺️ Plan'}
                  <input type="file" hidden accept="image/*,.pdf" onChange={uploadFloorPlan} />
                </label>
              </>
            )}
          </div>

          {addingPin && (
            <div className="pin-form" style={{ margin: '0 0 12px 0' }}>
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

          {floorPlans.length === 0 ? (
            <div className="empty-state">Henüz kat planı yüklenmemiş.</div>
          ) : (
            <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative' }}>
              <div style={{ display: 'flex', gap: 8, padding: '10px 16px', alignItems: 'center', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button 
                    onClick={() => { const el = document.getElementById('pin-search-input'); if(el) { el.style.display = el.style.display === 'none' ? 'block' : 'none'; if(el.style.display === 'block') el.focus(); } }}
                    style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Pin Ara"
                  >🔍</button>
                  <input 
                    id="pin-search-input"
                    placeholder="Ara..." 
                    value={pinSearch} 
                    onChange={e => setPinSearch(e.target.value)}
                    style={{ display: pinSearch ? 'block' : 'none', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', width: 120, fontSize: 13 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, flex: 1, WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none', scrollbarWidth: 'none' }} className="hide-scrollbar">
                  <button 
                    onClick={() => setCategoryFilter('all')}
                    style={{ padding: '5px 14px', borderRadius: 20, border: categoryFilter === 'all' ? '2px solid #3b82f6' : '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', transition: '0.2s', opacity: categoryFilter === 'all' ? 1 : 0.6 }}
                  >
                    Genel
                  </button>
                  {CATEGORIES.map(c => (
                    <button 
                      key={c}
                      onClick={() => setCategoryFilter(c)}
                      style={{ padding: '5px 14px', borderRadius: 20, border: categoryFilter === c ? `2px solid ${CATEGORY_COLORS[c]}` : `1px solid ${CATEGORY_COLORS[c]}40`, background: `${CATEGORY_COLORS[c]}20`, color: CATEGORY_COLORS[c], fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', transition: '0.2s', textTransform: 'capitalize', opacity: categoryFilter === c ? 1 : 0.6 }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <TransformWrapper
                initialScale={1}
                minScale={1}
                maxScale={10}
                limitToBounds={true}
                centerZoomedOut={true}
                disabled={addingPin && !newPinCoords}
                pinch={{ disabled: true }}
                wheel={{ disabled: true }}
                doubleClick={{ disabled: true }}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    
                    {/* Lejant (Kategori Renkleri) kaldırıldı - Üstteki butonlar yerine geçiyor */}

                    <div className="zoom-controls">
                      <button className="zoom-btn" onClick={() => zoomIn()}>+</button>
                      <button className="zoom-btn" onClick={() => zoomOut()}>-</button>
                      <button className="zoom-btn" onClick={() => resetTransform()}>⟲</button>
                      <button className="zoom-btn" onClick={() => setMapRotation(prev => (prev + 90) % 360)} title="Döndür">↻</button>
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
                        style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', transform: `rotate(${mapRotation}deg)`, transition: 'transform 0.3s ease' }}
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
                                boxShadow: movingPinId === pin.id ? '0 0 0 4px rgba(59,130,246,0.6)' : undefined,
                                transform: `translate(-50%, -100%) rotate(${-45 - mapRotation}deg)`
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
                          <div className="pin-marker-custom" style={{ left: `${newPinCoords.x}%`, top: `${newPinCoords.y}%`, background: newPinData.color, transform: `translate(-50%, -100%) rotate(${-45 - mapRotation}deg)` }}>
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
                    <div key={i} style={{ padding: 16, border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-main)', position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <p style={{ fontWeight: 'bold', margin: 0 }}>{fp.name}</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-secondary" onClick={() => toggleArchiveFloorPlan(i, fp.isArchived)} style={{ flex: 1, fontSize: 13 }}>Arşivden Çıkar</button>
                        <button onClick={() => deleteFloorPlan(i)} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 6, padding: '0 8px', cursor: 'pointer' }} title="Kalıcı Sil">
                          <Trash2 size={16} />
                        </button>
                      </div>
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
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pin.category} • Kat: {project.floorPlans[pin.floorPlanIndex]?.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'info' && (
        <div className="info-view" style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ margin: 0, color: 'var(--text-main)' }}>Proje Detayları</h2>
            {isManager && !editingInfo && (
              <button className="btn-secondary" onClick={() => setEditingInfo(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                ✏️ Düzenle
              </button>
            )}
          </div>

          {editingInfo ? (
            <div className="info-form" style={{ display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--bg-card)', padding: 24, borderRadius: 12, border: '1px solid var(--border-color)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-muted)' }}>Proje Adı</label>
                <input style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }} value={projectInfo.name || ''} onChange={e => setProjectInfo({...projectInfo, name: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-muted)' }}>Kısa Açıklama</label>
                <input style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }} value={projectInfo.description || ''} onChange={e => setProjectInfo({...projectInfo, description: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-muted)' }}>Açık Adres</label>
                <textarea style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }} rows={2} value={projectInfo.address || ''} onChange={e => setProjectInfo({...projectInfo, address: e.target.value})} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-muted)' }}>Başlangıç Tarihi</label>
                  <input style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }} type="date" value={projectInfo.startDate || ''} onChange={e => setProjectInfo({...projectInfo, startDate: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-muted)' }}>Hedef Bitiş</label>
                  <input style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }} type="date" value={projectInfo.endDate || ''} onChange={e => setProjectInfo({...projectInfo, endDate: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-muted)' }}>Durum</label>
                  <select value={projectInfo.status || 'devam ediyor'} onChange={e => setProjectInfo({...projectInfo, status: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }}>
                    <option value="planlama">🏗️ Planlama</option>
                    <option value="devam ediyor">🚧 Devam Ediyor</option>
                    <option value="duraklatıldı">⏸️ Duraklatıldı</option>
                    <option value="tamamlandı">✅ Tamamlandı</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-muted)' }}>İlerleme Yüzdesi (%)</label>
                  <input style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }} type="number" min="0" max="100" value={projectInfo.progress || 0} onChange={e => setProjectInfo({...projectInfo, progress: Number(e.target.value)})} />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--text-muted)' }}>Genel Notlar</label>
                <textarea style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }} value={projectInfo.notes || ''} onChange={e => setProjectInfo({...projectInfo, notes: e.target.value})} rows={4} />
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button className="btn-primary" onClick={saveProjectInfo} style={{ flex: 1 }}>Kaydet</button>
                <button className="btn-secondary" onClick={() => setEditingInfo(false)} style={{ flex: 1 }}>İptal</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Progress and Status Card */}
              <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span className={`status-label ${project.status?.toLowerCase().replace(' ', '') || 'devamediyor'}`} style={{ fontSize: 13, padding: '4px 12px', borderRadius: 20 }}>
                    {project.status?.toUpperCase() || 'DEVAM EDİYOR'}
                  </span>
                  <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary-color)' }}>%{project.progress || 0}</span>
                </div>
                <div style={{ width: '100%', height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${project.progress || 0}%`, height: '100%', background: 'var(--primary-gradient)', borderRadius: 4, transition: 'all 0.5s ease-out' }} />
                </div>
                <p style={{ marginTop: 16, color: 'var(--text-main)', fontSize: 16, lineHeight: 1.5 }}>{project.description || 'Proje açıklaması girilmemiş.'}</p>
              </div>

              {/* Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>📍</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Adres</div>
                  <div style={{ marginTop: 4, color: 'var(--text-main)', fontWeight: 500 }}>{project.address || 'Belirtilmemiş'}</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>📅</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tarihler</div>
                  <div style={{ marginTop: 4, color: 'var(--text-main)', fontWeight: 500 }}>
                    {project.startDate || '-'} <br/> {project.endDate ? `Hedef: ${project.endDate}` : ''}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>📝</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notlar</div>
                  <div style={{ marginTop: 4, color: 'var(--text-main)', fontSize: 13, maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {project.notes || 'Not yok.'}
                  </div>
                </div>
              </div>

              {/* DRIVE FOLDER SYSTEM */}
              <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 24 }}>📁</span>
                    <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Proje Dosyaları</h3>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 12 }}>
                    {!activeFolder ? (
                       isManager && (
                         <button onClick={createNewFolder} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 13, borderRadius: 8 }}>
                           ➕ Yeni Klasör
                         </button>
                       )
                    ) : (
                       isManager && (
                         <label className="btn-primary" style={{ padding: '6px 12px', fontSize: 13, borderRadius: 8, cursor: 'pointer' }}>
                           {uploadingProjectFile ? 'Yükleniyor...' : '📄 Dosya Yükle'}
                           <input type="file" hidden onChange={uploadProjectFile} />
                         </label>
                       )
                    )}
                  </div>
                </div>
                
                <div style={{ padding: 24 }}>
                  {!activeFolder ? (
                    // KÖK DİZİN (KLASÖRLER)
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
                        {/* Tüm projelerde varsayılan 'Genel' klasörü gibi davranacak ana alan */}
                        <div 
                          onClick={() => setActiveFolder('Genel Dosyalar')}
                          style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 20, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                          className="folder-card"
                        >
                          <div style={{ fontSize: 40, marginBottom: 8 }}>📁</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>Genel Dosyalar</div>
                        </div>

                        {(project.projectFolders || []).map((folder, i) => (
                          <div key={i} style={{ position: 'relative' }}>
                            <div 
                              onClick={() => setActiveFolder(folder)}
                              style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 20, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                              className="folder-card"
                            >
                              <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>{folder}</div>
                            </div>
                            {isManager && (
                              <button 
                                onClick={() => deleteFolder(folder)}
                                style={{ position: 'absolute', top: -8, right: -8, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                                title="Klasörü Sil"
                              >✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    // KLASÖR İÇİ (DOSYALAR)
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: '1px dashed var(--border-color)' }}>
                        <button onClick={() => setActiveFolder(null)} style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, padding: 0 }}>
                          <ArrowLeft size={16} /> Klasörler
                        </button>
                        <span style={{ color: 'var(--text-muted)' }}>/</span>
                        <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{activeFolder}</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(() => {
                          const filesInView = (project.projectFiles || []).filter(f => 
                            (activeFolder === 'Genel Dosyalar' && (!f.folder || f.folder === 'Genel Dosyalar')) || 
                            f.folder === activeFolder
                          );

                          if (filesInView.length === 0) {
                            return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Bu klasör boş.</div>;
                          }

                          return filesInView.map((f, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
                                <span style={{ fontSize: 20 }}>📄</span>
                                <span style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }} title={f.name}>{f.name}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <a href={f.url} target="_blank" rel="noreferrer" className="btn-primary" style={{ padding: '6px 16px', textDecoration: 'none', fontSize: 12, borderRadius: 6 }}>Aç</a>
                                {isManager && (
                                  <button className="btn-danger" style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6 }} onClick={async () => {
                                    if (window.confirm('Dosyayı silmek istediğinize emin misiniz?')) {
                                      const updatedFiles = project.projectFiles.filter(pf => pf.url !== f.url);
                                      await updateDoc(doc(db, 'projects', projectId), { projectFiles: updatedFiles });
                                      fetchProject();
                                    }
                                  }}>Sil</button>
                                )}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <ProjectSchedule project={project} projectId={projectId} fetchProject={fetchProject} isManager={isManager} />
      )}

      {activeTab === 'team' && <ProjectTeam projectId={projectId} isManager={canManageTeam} />}

      {selectedPin && (
        <PinDetailModal pin={selectedPin} projectId={projectId} isManager={isManager} onClose={() => setSelectedPin(null)} />
      )}
    </div>
  );
}