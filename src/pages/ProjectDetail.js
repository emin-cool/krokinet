/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, query, where, addDoc, serverTimestamp, onSnapshot, updateDoc, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import PinDetailModal from '../components/PinDetailModal';
import { colorFor, normCat, isResolved, PIN_STATUS, CATEGORY_KEYS } from '../utils/constants';

import ProjectGallery from '../components/ProjectGallery';
import ProjectTeam from '../components/ProjectTeam';
import ProjectSchedule from '../components/ProjectSchedule';
import NotificationsDropdown from '../components/NotificationsDropdown';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Building, Ruler, MessageSquare, Info, Users, MapPin, Archive, ArrowLeft, CalendarDays, Trash2, Plus, Search, Image as ImageIcon, Share2, Edit2, Calendar, AlignLeft, FileText, Download, MoreVertical, FolderPlus, Upload } from 'lucide-react';

const CATEGORIES = CATEGORY_KEYS; // Mobil ile paylaşılan tek kaynak kategori listesi

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
  const [viewMode, setViewMode] = useState('view'); // 'view' or 'edit'
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [newPinData, setNewPinData] = useState({ title: '', category: 'GENEL', color: colorFor('GENEL') });
  const [newPinCoords, setNewPinCoords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPlan, setUploadingPlan] = useState(false);
  const [uploadingProjectFile, setUploadingProjectFile] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [projectInfo, setProjectInfo] = useState({});
  const [editingFloorIndex, setEditingFloorIndex] = useState(null);
  const [editingFloorName, setEditingFloorName] = useState('');
  const [mapRotation, setMapRotation] = useState(0);
  const [activeFolder, setActiveFolder] = useState('Genel Dosyalar');

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
        
        // NOT: Pin ekleri artık ayrı 'files' koleksiyonunda değil, yukarıda
        // silinen 'messages' içinde tutuluyor (mobil ile ortak şema).
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
        const fallback = (project.floorPlans || []).findIndex((fp, i) => i !== index && !fp.isArchived);
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
      setActiveFolder(folderName.trim());
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
      if (!res.ok || data.error) { alert('Dosya yüklenemedi.'); setUploadingProjectFile(false); return; }
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
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (clientX == null) return;

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
        status: PIN_STATUS.OPEN,
        color: colorFor(newPinData.category),
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        assignee: newPinData.assignee || ''
      });

      if (newPinData.assignee && newPinData.assignee !== userData?.name) {
        const membersSnapshot = await getDocs(query(collection(db, 'publicProfiles'), where('name', '==', newPinData.assignee)));
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
      setNewPinData({ title: '', category: 'GENEL', color: colorFor('GENEL') });
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
    if (p.isArchived) return false;
    if (p.floorPlanIndex !== activeFloor) return false;
    if (selectedCategory !== 'All' && normCat(p.category) !== normCat(selectedCategory)) return false;

    // Filtreleme (durum karşılaştırması eski 'açık/çözüldü' ve yeni OPEN/RESOLVED ile uyumlu)
    if (pinFilter === 'open' && isResolved(p.status)) return false;
    if (pinFilter === 'resolved' && !isResolved(p.status)) return false;
    if (pinFilter === 'mine' && p.assignee !== userData?.name) return false;
    if (categoryFilter !== 'all' && normCat(p.category) !== normCat(categoryFilter)) return false;

    // Arama
    if (pinSearch) {
      const search = pinSearch.toLowerCase();
      const titleMatch = p.title?.toLowerCase().includes(search);
      const assigneeMatch = p.assignee?.toLowerCase().includes(search);
      if (!titleMatch && !assigneeMatch) return false;
    }

    return true;
  });

  const archivedPins = pins.filter(p => p.isArchived);
  const archivedPlans = project?.floorPlans?.filter(fp => fp.isArchived) || [];

  const floorPlans = project.floorPlans || [];

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', margin: 0, padding: 0, overflow: 'hidden' }}>
      {/* Top Header Removed per user request */}

      <div className="project-content-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div className="detail-tabs vertical-tabs" style={{ width: '220px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', padding: '24px 16px', gap: '12px', background: 'var(--bg-surface)' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '24px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-start' }}>
              <button 
                onClick={() => navigate('/')}
                style={{ background: '#1e1b4b', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: '8px', minWidth: '32px' }}
                title="Geri Dön"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#1e1b4b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {project.name}
                </h2>
              </div>
            </div>
          </div>
          <div className="sidebar-menus">
            <button className={`tab ${activeTab === 'plan' ? 'active' : ''}`} onClick={() => setActiveTab('plan')} style={{ justifyContent: 'flex-start', padding: '10px 16px' }} title="Kat Planı">
              <span style={{ marginRight: '12px', fontSize: '18px' }}>🗺️</span> Kat Planı
            </button>
            <button className={`tab ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')} style={{ justifyContent: 'flex-start', padding: '10px 16px' }} title="Proje Bilgileri">
              <span style={{ marginRight: '12px', fontSize: '18px' }}>ℹ️</span> Proje Bilgileri
            </button>
            <button className={`tab ${activeTab === 'team' ? 'active' : ''}`} onClick={() => setActiveTab('team')} style={{ justifyContent: 'flex-start', padding: '10px 16px' }} title="Ekip Üyeleri">
              <span style={{ marginRight: '12px', fontSize: '18px' }}>👥</span> Ekip Üyeleri
            </button>
            <button className={`tab ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => setActiveTab('schedule')} style={{ justifyContent: 'flex-start', padding: '10px 16px' }} title="Takvim">
              <span style={{ marginRight: '12px', fontSize: '18px' }}>📅</span> Takvim
            </button>
            {isManager && (
              <button className={`tab ${activeTab === 'archive' ? 'active' : ''}`} onClick={() => setActiveTab('archive')} style={{ justifyContent: 'flex-start', padding: '10px 16px' }} title="Arşiv">
                <span style={{ marginRight: '12px', fontSize: '18px' }}>📦</span> Arşiv
              </button>
            )}
            
            <div style={{ marginTop: '32px', marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', marginBottom: '4px', letterSpacing: '0.05em' }}>HIZLI İŞLEM</div>
              <button className="btn-primary" onClick={() => { 
                setActiveTab('plan'); 
                if (viewMode !== 'edit') {
                  setViewMode('edit');
                }
                setAddingPin(!addingPin); 
              }} style={{ width: '100%', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600, background: '#4f46e5', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }} title="Yeni Pin">
                <Plus size={18} />
                Yeni Pin
              </button>

              <label style={{ width: '100%', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600, background: '#fff', color: '#4f46e5', border: '1px solid #4f46e5', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.1)' }} title="Kat Planı Yükle">
                <ImageIcon size={18} />
                Kat Planı Yükle
                <input type="file" hidden onChange={uploadFloorPlan} accept="image/*,.pdf" />
              </label>
            </div>
          </div>
        </div>
        
        <div className="tab-content-area" style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>

      {activeTab === 'plan' && (
        <div className="plan-view">
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
                      setNewPinData({...newPinData, category: newCat, color: colorFor(newCat)});
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
            <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Henüz kat planı yüklenmemiş.</div>
          ) : (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: '#fff', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <select 
                    value={activeFloor} 
                    onChange={e => setActiveFloor(Number(e.target.value))}
                    style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e1b4b', border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', appearance: 'auto' }}
                  >
                    {floorPlans.map((fp, i) => {
                      if (fp.isArchived) return null;
                      return <option key={i} value={i}>{fp.name}</option>;
                    })}
                  </select>
                  <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }}></div>
                  <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '24px' }}>
                    <button onClick={() => { setViewMode('view'); setAddingPin(false); }} style={{ background: viewMode === 'view' ? '#4f46e5' : 'transparent', color: viewMode === 'view' ? '#fff' : '#64748b', border: 'none', borderRadius: '20px', padding: '4px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>View</button>
                    <button onClick={() => setViewMode('edit')} style={{ background: viewMode === 'edit' ? '#4f46e5' : 'transparent', color: viewMode === 'edit' ? '#fff' : '#64748b', border: 'none', borderRadius: '20px', padding: '4px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>Edit</button>
                  </div>
                </div>

                {/* Legend as Filter Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => setSelectedCategory('All')} 
                    style={{ padding: '6px 12px', borderRadius: '20px', border: selectedCategory === 'All' ? '2px solid #4f46e5' : '1px solid #e5e7eb', background: selectedCategory === 'All' ? '#eff6ff' : '#fff', color: selectedCategory === 'All' ? '#4f46e5' : '#6b7280', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    Tümü
                  </button>
                  {CATEGORIES.map(c => (
                    <button 
                      key={c}
                      onClick={() => setSelectedCategory(c)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', border: selectedCategory === c ? `2px solid ${colorFor(c)}` : '1px solid #e5e7eb', background: selectedCategory === c ? `${colorFor(c)}15` : '#fff', color: '#4b5563', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: colorFor(c) }}></span>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
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
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                    


                    <div className="zoom-controls" style={{ bottom: 24, right: 24, background: '#fff', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                      <button className="zoom-btn" onClick={() => zoomIn()}>+</button>
                      <button className="zoom-btn" onClick={() => zoomOut()}>-</button>
                      <button className="zoom-btn" onClick={() => resetTransform()}>⟲</button>
                      <button className="zoom-btn" onClick={() => setMapRotation(prev => (prev + 90) % 360)} title="Döndür">↻</button>
                    </div>
                    
                    <TransformComponent wrapperStyle={{ width: "100%", height: "100%", cursor: (addingPin && !newPinCoords && viewMode === 'edit') ? 'crosshair' : 'grab', backgroundColor: '#f8f9fa', backgroundImage: 'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)', backgroundSize: '20px 20px' }} contentStyle={{ width: "100%", height: "max-content" }}>
                      <div
                        className={`floor-plan-wrapper ${addingPin && !newPinCoords ? 'crosshair' : ''}`}
                        onClick={handleImageClick}
                        onMouseMove={handlePointerMove}
                        onMouseUp={handlePointerUp}
                        onMouseLeave={handlePointerUp}
                        onTouchMove={handlePointerMove}
                        onTouchEnd={handlePointerUp}
                        ref={imageRef}
                        style={{ position: 'relative', width: '100%', height: 'auto', transform: `rotate(${mapRotation}deg)`, transition: 'transform 0.3s ease' }}
                      >
                        <img src={floorPlans[activeFloor]?.imageUrl} alt="Kat Planı" draggable={false} style={{ display: 'block', width: '100%', height: 'auto' }} />
                        {currentFloorPins.map(pin => {
                          const isDragging = draggingPin?.id === pin.id;
                          const currentX = isDragging ? draggingPin.x : pin.x;
                          const currentY = isDragging ? draggingPin.y : pin.y;
                          
                          return (
                            <div key={pin.id} className="pin-marker-custom"
                              style={{ 
                                left: `${currentX}%`, 
                                top: `${currentY}%`, 
                                background: pin.isArchived ? '#9ca3af' : (pin.color || colorFor(pin.category)),
                                opacity: pin.isArchived ? 0.7 : 1,
                                filter: pin.isArchived ? 'grayscale(100%)' : 'none',
                                cursor: movingPinId === pin.id ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                                zIndex: isDragging ? 1000 : 10,
                                boxShadow: movingPinId === pin.id ? '0 0 0 4px rgba(59,130,246,0.6)' : '0 2px 8px rgba(0,0,0,0.3)',
                                transform: `translate(-50%, -50%) rotate(${-mapRotation}deg)`
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
                          <div className="pin-marker-custom" style={{ left: `${newPinCoords.x}%`, top: `${newPinCoords.y}%`, background: newPinData.color, transform: `translate(-50%, -50%) rotate(${-mapRotation}deg)` }}>
                            <div className="pin-tooltip">Yeni Pin</div>
                          </div>
                        )}
                      </div>
                    </TransformComponent>
                  </div>
                )}
              </TransformWrapper>
              </div>
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
        <div className="info-view" style={{ flex: 1, padding: '24px', background: '#f8f9fa', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
          
          {/* Top Breadcrumb & Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
                Projeler <span style={{ margin: '0 4px' }}>&gt;</span> <span style={{ color: '#4f46e5', fontWeight: 600 }}>{project.name}</span>
              </div>
              <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#111827' }}>Proje Detayları</h2>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Proje bağlantısı kopyalandı!');
                }}
                style={{ padding: '8px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', color: '#374151', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                <Share2 size={16} /> Paylaş
              </button>
              {isManager && (
                <button onClick={() => setEditingInfo(!editingInfo)} style={{ padding: '8px 16px', background: '#4f46e5', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <Edit2 size={16} /> Düzenle
                </button>
              )}
            </div>
          </div>

          {editingInfo ? (
            <div className="info-form" style={{ display: 'flex', flexDirection: 'column', gap: 16, background: '#fff', padding: 24, borderRadius: 16, border: '1px solid #e5e7eb' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#4b5563' }}>Proje Adı</label>
                <input style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#111827' }} value={projectInfo.name || ''} onChange={e => setProjectInfo({...projectInfo, name: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#4b5563' }}>Açık Adres</label>
                <textarea style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#111827' }} rows={2} value={projectInfo.address || ''} onChange={e => setProjectInfo({...projectInfo, address: e.target.value})} />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#4b5563' }}>Başlangıç Tarihi</label>
                  <input style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#111827' }} type="date" value={projectInfo.startDate || ''} onChange={e => setProjectInfo({...projectInfo, startDate: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#4b5563' }}>Hedef Bitiş</label>
                  <input style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#111827' }} type="date" value={projectInfo.endDate || ''} onChange={e => setProjectInfo({...projectInfo, endDate: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#4b5563' }}>Durum</label>
                  <select value={projectInfo.status || 'devam ediyor'} onChange={e => setProjectInfo({...projectInfo, status: e.target.value})} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#111827' }}>
                    <option value="planlama">🏗️ Planlama</option>
                    <option value="devam ediyor">🚧 Devam Ediyor</option>
                    <option value="duraklatıldı">⏸️ Duraklatıldı</option>
                    <option value="tamamlandı">✅ Tamamlandı</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#4b5563' }}>İlerleme Yüzdesi (%)</label>
                  <input style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#111827' }} type="number" min="0" max="100" value={projectInfo.progress || 0} onChange={e => setProjectInfo({...projectInfo, progress: Number(e.target.value)})} />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#4b5563' }}>Genel Notlar</label>
                <textarea style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#111827' }} value={projectInfo.notes || ''} onChange={e => setProjectInfo({...projectInfo, notes: e.target.value})} rows={4} />
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button className="btn-primary" onClick={saveProjectInfo} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#4f46e5', color: '#fff', fontWeight: 600, border: 'none' }}>Kaydet</button>
                <button className="btn-secondary" onClick={() => setEditingInfo(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#fff', color: '#4b5563', fontWeight: 600, border: '1px solid #d1d5db' }}>İptal</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              {/* Left Column */}
              <div style={{ flex: '1 1 0%', minWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Top Card: Status & Progress */}
                <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                      <h2 style={{ margin: '0 0 12px 0', fontSize: '24px', color: '#111827' }}>{project.name}</h2>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', background: '#e0f2fe', color: '#0284c7', borderRadius: '20px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0284c7' }} />
                        {(project.status || 'DEVAM EDİYOR').toUpperCase()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '40px', fontWeight: 800, color: '#4f46e5', lineHeight: 1 }}>%{project.progress || 0}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600, marginTop: '4px' }}>Tamamlanma Oranı</div>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#eef2ff', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${project.progress || 0}%`, height: '100%', background: '#4f46e5', borderRadius: '4px' }} />
                  </div>
                </div>

                {/* Middle Row: Adres and Tarihler */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                  <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                      <MapPin size={20} /> Adres
                    </h3>
                    <div style={{ color: '#374151', fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {project.address || 'Adres bilgisi girilmemiş.'}
                    </div>
                  </div>
                  <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                      <Calendar size={20} /> Tarihler
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6b7280' }}>Başlangıç:</span>
                        <span style={{ color: '#111827', fontWeight: 600 }}>{project.startDate ? new Date(project.startDate).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6b7280' }}>Bitiş (Hedef):</span>
                        <span style={{ color: '#111827', fontWeight: 600 }}>{project.endDate ? new Date(project.endDate).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Card: Notlar */}
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#d97706', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <AlignLeft size={20} /> Notlar
                  </h3>
                  <blockquote style={{ borderLeft: '4px solid #fcd34d', paddingLeft: '16px', color: '#4b5563', fontStyle: 'italic', margin: 0, fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    "{project.notes || 'Henüz not eklenmemiş.'}"
                  </blockquote>
                </div>
              </div>

              {/* Right Sidebar - Files (Drive Logic) */}
              <div style={{ flex: '0 0 420px', background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {activeFolder && (
                      <button onClick={() => setActiveFolder(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: '#e0e7ff', border: 'none', cursor: 'pointer', color: '#4f46e5' }} title="Geri Dön">
                        <ArrowLeft size={18} />
                      </button>
                    )}
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                      {activeFolder ? activeFolder : 'Proje Dosyaları'}
                    </h3>
                  </div>
                  <button onClick={() => setActiveTab('files')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#4f46e5' }}>
                    <MoreVertical size={20} />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                  {isManager && !activeFolder && (
                    <button onClick={createNewFolder} style={{ flex: 1, padding: '16px 8px', background: '#eef2ff', border: '1px dashed #a5b4fc', borderRadius: '12px', color: '#4f46e5', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <FolderPlus size={24} />
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>Yeni Klasör</span>
                    </button>
                  )}
                  {isManager && (
                    <label style={{ flex: 1, padding: '16px 8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '12px', color: '#1e293b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'background 0.2s' }}>
                      <Upload size={24} />
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>{uploadingProjectFile ? 'Yükleniyor...' : 'Dosya Yükle'}</span>
                      <input type="file" hidden onChange={uploadProjectFile} />
                    </label>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {!activeFolder ? (
                    // ROOT FOLDER VIEW
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* List Folders */}
                      {(project.projectFolders || []).map((folder, i) => {
                        const filesInFolder = (project.projectFiles || []).filter(f => f.folder === folder).length;
                        return (
                          <div key={i} onClick={() => setActiveFolder(folder)} style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }} className="folder-item-hover">
                            <div style={{ width: '48px', height: '48px', background: '#0ea5e9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                               <FolderPlus size={24} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{folder}</div>
                              <div style={{ fontSize: '11px', color: '#6b7280' }}>{filesInFolder} Dosya</div>
                            </div>
                            {isManager && (
                              <button onClick={(e) => { e.stopPropagation(); deleteFolder(folder); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px' }}>✕</button>
                            )}
                          </div>
                        );
                      })}
                      
                      {/* Default "Diğer Dosyalar" Folder for root files */}
                      <div 
                        onClick={() => setActiveFolder('Genel Dosyalar')}
                        style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                        className="folder-item-hover"
                      >
                        <div style={{ width: '48px', height: '48px', background: '#0ea5e9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                          <FolderPlus size={24} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Diğer Dosyalar</div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>Ana Dizin ({((project.projectFiles || []).filter(f => !f.folder || f.folder === 'Genel Dosyalar').length)})</div>
                        </div>
                      </div>

                      {/* Recent Files Preview */}
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', margin: '24px 0 12px 0', letterSpacing: '0.05em' }}>SON EKLENEN DOSYALAR</div>
                      {(project.projectFiles || []).slice(0, 3).map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#fee2e2', borderRadius: '12px', marginBottom: '8px' }}>
                          <div style={{ width: '36px', height: '36px', background: '#fecaca', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                            <FileText size={18} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{f.name}</div>
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>{f.folder || 'Ana Dizin'}</div>
                          </div>
                          <a href={f.url} target="_blank" rel="noreferrer" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#4b5563', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                            <Download size={18} />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // INSIDE FOLDER VIEW
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(() => {
                        const filesInCurrentFolder = (project.projectFiles || []).filter(f => f.folder === activeFolder || (!f.folder && activeFolder === 'Genel Dosyalar'));
                        if (filesInCurrentFolder.length === 0) {
                          return <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Bu klasörde henüz dosya yok.</div>;
                        }
                        return filesInCurrentFolder.map((f, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                            <div style={{ width: '36px', height: '36px', background: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                              <FileText size={18} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <a href={f.url} target="_blank" rel="noreferrer" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#4b5563', textDecoration: 'none', display: 'flex', alignItems: 'center', padding: '4px' }}>
                                <Download size={18} />
                              </a>
                              {isManager && (
                                <button onClick={() => {
                                  if (window.confirm('Dosyayı silmek istediğinize emin misiniz?')) {
                                    const updatedFiles = project.projectFiles.filter(pf => pf !== f);
                                    updateDoc(doc(db, 'projects', projectId), { projectFiles: updatedFiles }).then(() => fetchProject());
                                  }
                                }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
                
                <style>{`
                  .folder-item-hover:hover {
                    border-color: #bae6fd !important;
                    background-color: #f0f9ff !important;
                  }
                `}</style>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <ProjectSchedule project={project} projectId={projectId} fetchProject={fetchProject} isManager={isManager} />
      )}

      {activeTab === 'team' && <ProjectTeam projectId={projectId} isManager={canManageTeam} />}
      </div>
      </div>

      {selectedPin && (
        <PinDetailModal 
          pin={selectedPin} 
          pins={pins}
          setSelectedPin={setSelectedPin}
          projectId={projectId} 
          isManager={isManager} 
          onClose={() => setSelectedPin(null)} 
        />
      )}
    </div>
  );
}