import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import MarketPrices from './MarketPrices';
import BudgetCalculator from './BudgetCalculator';
import NotificationsDropdown from '../components/NotificationsDropdown';
import { Building, Building2, FolderKanban, TrendingUp, Calculator, MapPin, Plus } from 'lucide-react';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', address: '' });
  const [activeSection, setActiveSection] = useState('projects');
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { fetchProjects(); }, [currentUser, userData]);

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
      floorPlans: []
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
          <img src="/logo.png" alt="KrokiNet Logo" style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
          <div>
            <h1>KrokiNet</h1>
            <p>{userData?.name} ({userData?.role})</p>
          </div>
        </div>
        <div className="header-actions">
          <NotificationsDropdown />
          {userData?.isSuperAdmin && activeSection === 'projects' && (
            <button className="btn-primary" onClick={() => setShowNewProject(true)}>
              <Plus size={16} style={{ marginRight: '6px' }} /> Yeni Proje
            </button>
          )}
          <button className="btn-secondary" onClick={() => navigate('/profile')} style={{ marginRight: 8 }}>Profilim</button>
          <button className="btn-secondary" onClick={() => signOut(auth)}>Çıkış</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="projects-tabs">
        <button className={activeSection === 'projects' ? 'projects-tab active' : 'projects-tab'}
          onClick={() => setActiveSection('projects')}>
          <FolderKanban size={18} /> Projelerim
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

          <div className="projects-grid">
            {projects.length === 0 ? (
              <div className="empty-state">Henüz proje yok.</div>
            ) : (
              projects.map(project => (
                <div key={project.id} className="project-card"
                  onClick={() => navigate(`/project/${project.id}`)}>
                  <div className="project-icon" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                    <Building2 size={28} color="var(--primary-color)" />
                  </div>
                  <h3>{project.name}</h3>
                  <p>{project.description}</p>
                  {project.address && (
                    <span className="project-address" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={14} /> {project.address}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeSection === 'market' && <MarketPrices />}
      
      {activeSection === 'budget' && <BudgetCalculator />}
    </div>
  );
}