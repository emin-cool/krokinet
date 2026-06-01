/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import MarketPrices from './MarketPrices';
import BudgetCalculator from './BudgetCalculator';
import GlobalCalendar from './GlobalCalendar';
import NotificationsDropdown from '../components/NotificationsDropdown';
import { Building2, FolderKanban, TrendingUp, Calculator, MapPin, Plus, CalendarDays } from 'lucide-react';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', address: '' });
  const [activeSection, setActiveSection] = useState('projects');
  const [projectTab, setProjectTab] = useState('active');
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchProjects();
  }, [currentUser, userData]);

  async function fetchProjects() {
    if (!currentUser) return;
    try {
      let snapshot;
      if (userData?.isSuperAdmin) {
        snapshot = await getDocs(collection(db, 'projects'));
      } else {
        const q = query(collection(db, 'projects'), where('memberIds', 'array-contains', currentUser.uid));
        snapshot = await getDocs(q);
      }
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function createProject() {
    if (!newProject.name) return;
    await addDoc(collection(db, 'projects'), {
      ...newProject,
      managerId: currentUser.uid,
      memberIds: [currentUser.uid],
      createdAt: serverTimestamp(),
      floorPlans: [],
      isArchived: false
    });
    setShowNewProject(false);
    setNewProject({ name: '', description: '', address: '' });
    fetchProjects();
  }

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="projects-page">
      {/* Header */}
      <div className="projects-top-header">
        <div className="projects-top-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="app-logo-container" style={{ width: '56px', height: '56px' }}>
            <img src="/logo.png" alt="Yapı Chat Logo" />
          </div>
          <div>
            <h1 className="app-logo-text">Yapı Chat</h1>
            <p>{userData?.name} ({userData?.role})</p>
          </div>
        </div>
        <div className="header-actions">
          <NotificationsDropdown />
          {userData?.isSuperAdmin && activeSection === 'projects' && (
            <button className="btn-primary desktop-new-project-btn hide-on-mobile" onClick={() => setShowNewProject(true)}>
              <Plus size={16} style={{ marginRight: '6px' }} /> Yeni Proje
            </button>
          )}
          <button className="btn-secondary hide-on-mobile" onClick={() => navigate('/profile')} style={{ marginRight: 8 }}>Profilim</button>
          <button className="btn-secondary hide-on-mobile" onClick={() => signOut(auth)}>Çıkış</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="projects-tabs">
        <button className={activeSection === 'projects' ? 'projects-tab active' : 'projects-tab'}
          onClick={() => setActiveSection('projects')}>
          <FolderKanban size={18} /> Projelerim
        </button>
        <button className={activeSection === 'calendar' ? 'projects-tab active' : 'projects-tab'}
          onClick={() => setActiveSection('calendar')}>
          <CalendarDays size={18} /> İş Programı
        </button>
        <button className={activeSection === 'market' ? 'projects-tab active' : 'projects-tab'}
          onClick={() => setActiveSection('market')}>
          <TrendingUp size={18} /> Ham Madde Fiyatları
        </button>
        <button className={activeSection === 'budget' ? 'projects-tab active' : 'projects-tab'}
          onClick={() => setActiveSection('budget')}>
          <Calculator size={18} /> Keşif / Maliyet
        </button>
      </div>

      {/* Content */}
      {activeSection === 'projects' && (
        <div className="projects-content">
          {showNewProject && (
            <div className="modal-overlay">
              <div className="modal">
                <h2>Yeni Proje Oluştur</h2>
                <input placeholder="Proje Adı *" value={newProject.name}
                  onChange={e => setNewProject({...newProject, name: e.target.value})} />
                <input placeholder="Kısa Açıklama" value={newProject.description}
                  onChange={e => setNewProject({...newProject, description: e.target.value})} />
                <input placeholder="Adres" value={newProject.address}
                  onChange={e => setNewProject({...newProject, address: e.target.value})} />
                <div className="modal-actions">
                  <button className="btn-primary" onClick={createProject}>Oluştur</button>
                  <button className="btn-secondary" onClick={() => setShowNewProject(false)}>İptal</button>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tabs for Active vs Archived Projects */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <button 
              onClick={() => setProjectTab('active')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: projectTab === 'active' ? 600 : 400, color: projectTab === 'active' ? 'var(--primary-color)' : 'var(--text-muted)' }}
            >
              Aktif Projeler
            </button>
            <button 
              onClick={() => setProjectTab('archived')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: projectTab === 'archived' ? 600 : 400, color: projectTab === 'archived' ? 'var(--primary-color)' : 'var(--text-muted)' }}
            >
              Arşivlenenler
            </button>
          </div>

          <div className="projects-grid">
            {(projectTab === 'active' ? projects.filter(p => !p.isArchived) : projects.filter(p => p.isArchived)).length === 0 ? (
              <div className="empty-state">Henüz proje yok.</div>
            ) : (
              (projectTab === 'active' ? projects.filter(p => !p.isArchived) : projects.filter(p => p.isArchived)).map(project => (
                <div key={project.id} className="project-card" style={{ position: 'relative' }}
                  onClick={() => navigate(`/project/${project.id}`)}>
                  
                  {/* Archive Button */}
                  {(userData?.isSuperAdmin || project.managerId === currentUser.uid) && (
                    <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: '8px', zIndex: 10 }}>
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm(`Projeyi ${projectTab === 'active' ? 'arşivlemek' : 'aktif hale getirmek'} istediğinize emin misiniz?`)) {
                            await updateDoc(doc(db, 'projects', project.id), { isArchived: !project.isArchived });
                            fetchProjects();
                          }
                        }}
                        style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'var(--bg-card-hover)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'var(--transition-fast)' }}
                      >
                        {projectTab === 'active' ? 'Arşivle' : 'Geri Al'}
                      </button>
                      
                      {projectTab === 'archived' && (
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm("DİKKAT: Bu proje KALICI OLARAK silinecektir. Devam etmek istiyor musunuz?")) {
                              await deleteDoc(doc(db, 'projects', project.id));
                              fetchProjects();
                            }
                          }}
                          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'var(--transition-fast)' }}
                        >
                          Kalıcı Sil
                        </button>
                      )}
                    </div>
                  )}

                  <div className="project-icon" style={{ background: project.isArchived ? '#f3f4f6' : 'rgba(59, 130, 246, 0.1)' }}>
                    <Building2 size={28} color={project.isArchived ? '#9ca3af' : 'var(--primary-color)'} />
                  </div>
                  <div className="project-card-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: 0, marginBottom: '6px' }}>{project.name}</h3>
                    {project.description && <p style={{ margin: 0, marginBottom: '8px' }}>{project.description}</p>}
                    {project.address && (
                      <span className="project-address" style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                        <MapPin size={14} /> {project.address}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeSection === 'market' && <MarketPrices />}
      
      {activeSection === 'budget' && <BudgetCalculator />}

      {activeSection === 'calendar' && <GlobalCalendar />}
    </div>
  );
}