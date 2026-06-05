import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Search, Settings, Plus, AlertTriangle } from 'lucide-react';
import NotificationsDropdown from '../components/NotificationsDropdown';

// Random placeholders for UI
const COVER_IMAGES = [
  'https://images.unsplash.com/photo-1541888086425-d81bb19240f5?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?auto=format&fit=crop&q=80&w=600',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=600'
];

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', address: '' });
  const [filter, setFilter] = useState('all'); // all, in-progress, planning, completed
  const [searchQuery, setSearchQuery] = useState('');
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const fetchProjects = useCallback(async () => {
    if (!currentUser) return;
    try {
      let snapshot;
      if (userData?.isSuperAdmin) {
        snapshot = await getDocs(collection(db, 'projects'));
      } else {
        const q = query(collection(db, 'projects'), where('memberIds', 'array-contains', currentUser.uid));
        snapshot = await getDocs(q);
      }
      
      const fetched = snapshot.docs.map((doc, i) => {
        const data = doc.data();
        let status = 'in-progress';
        if (data.status === 'planlama') status = 'planning';
        else if (data.status === 'tamamlandı') status = 'completed';

        return { 
          id: doc.id, 
          ...data,
          coverImage: data.coverImage || COVER_IMAGES[i % COVER_IMAGES.length],
          progress: data.progress || 0,
          openPins: data.openPins || 0, // In a real app, this would be queried from pins collection
          crewCount: data.memberIds ? data.memberIds.length : 1,
          status: status
        };
      });
      setProjects(fetched);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [currentUser, userData]);

  useEffect(() => {
    fetchProjects();
    if (searchParams.get('new') === 'true') {
      setShowNewProject(true);
      // Clean up URL parameter so it doesn't reopen on refresh
      setSearchParams({});
    }
  }, [fetchProjects, searchParams, setSearchParams]);

  async function createProject() {
    if (!newProject.name) return;
    await addDoc(collection(db, 'projects'), {
      ...newProject,
      managerId: currentUser.uid,
      memberIds: [currentUser.uid],
      createdAt: serverTimestamp(),
      floorPlans: [],
      isArchived: false,
      coverImage: COVER_IMAGES[Math.floor(Math.random() * COVER_IMAGES.length)]
    });
    setShowNewProject(false);
    setNewProject({ name: '', description: '', address: '' });
    fetchProjects();
  }

  // Formatting date like "Monday, October 23, 2023"
  const currentDate = new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const filteredProjects = projects.filter(p => {
    const matchesFilter = filter === 'all' || p.status === filter;
    const matchesSearch = (p.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) return <div className="loading">Yükleniyor...</div>;

  return (
    <div className="dashboard-container" style={{ padding: '24px 40px' }}>
      {/* Top Bar */}
      <div className="dashboard-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div className="search-bar" style={{ position: 'relative', width: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search projects..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}
          />
        </div>
        <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <NotificationsDropdown />
          <Settings size={20} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
          <div className="user-profile-sm" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {userData?.name ? userData.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{userData?.name}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{userData?.role || 'Project Manager'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="dashboard-header" style={{ marginBottom: '32px' }}>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: 'var(--primary-color)', letterSpacing: '0.05em' }}>WORKSPACE</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Active Sites</h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>{currentDate}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {(userData?.isSuperAdmin || true) && ( // Allowing all users to see the button for demo
              <button className="btn-primary" style={{ borderRadius: '20px', padding: '10px 20px' }} onClick={() => setShowNewProject(true)}>
                <Plus size={16} /> New Project
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-pills" style={{ display: 'flex', gap: '10px', marginBottom: '32px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button 
          className={`pill ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
          style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', background: filter === 'all' ? 'var(--primary-color)' : 'var(--bg-surface)', color: filter === 'all' ? '#fff' : 'var(--text-muted)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', border: filter === 'all' ? 'none' : '1px solid var(--border-color)' }}
        >
          All Projects ({projects.length})
        </button>
        <button 
          className={`pill ${filter === 'in-progress' ? 'active' : ''}`}
          onClick={() => setFilter('in-progress')}
          style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', background: filter === 'in-progress' ? 'var(--primary-color)' : 'var(--bg-surface)', color: filter === 'in-progress' ? '#fff' : 'var(--text-muted)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', border: filter === 'in-progress' ? 'none' : '1px solid var(--border-color)' }}
        >
          In Progress
        </button>
        <button 
          className={`pill ${filter === 'planning' ? 'active' : ''}`}
          onClick={() => setFilter('planning')}
          style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', background: filter === 'planning' ? 'var(--primary-color)' : 'var(--bg-surface)', color: filter === 'planning' ? '#fff' : 'var(--text-muted)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', border: filter === 'planning' ? 'none' : '1px solid var(--border-color)' }}
        >
          Planning
        </button>
        <button 
          className={`pill ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
          style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', background: filter === 'completed' ? 'var(--primary-color)' : 'var(--bg-surface)', color: filter === 'completed' ? '#fff' : 'var(--text-muted)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', border: filter === 'completed' ? 'none' : '1px solid var(--border-color)' }}
        >
          Completed
        </button>
      </div>

      {/* Grid */}
      <div className="stitch-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
        {filteredProjects.length === 0 ? (
          <div className="empty-state">No projects found.</div>
        ) : (
          filteredProjects.map(project => (
            <div key={project.id} className="stitch-card" style={{ background: 'var(--bg-surface)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.3s ease' }} onClick={() => navigate(`/project/${project.id}`)}>
              {/* Cover Image */}
              <div className="card-cover" style={{ height: '180px', position: 'relative', backgroundImage: `url(${project.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <div style={{ position: 'absolute', top: 12, left: 12, padding: '4px 10px', background: 'var(--primary-color)', color: '#fff', fontSize: '10px', fontWeight: 800, borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {project.status === 'in-progress' ? 'IN PROGRESS' : project.status === 'planning' ? 'PLANNING' : 'COMPLETED'}
                </div>
                {project.openPins > 50 && (
                  <div style={{ position: 'absolute', top: 12, right: 12, padding: '4px 10px', background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 800, borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={12} /> {project.openPins > 100 ? 'PRIORITY ALERT' : 'ALERTS'}
                  </div>
                )}
              </div>
              
              {/* Content */}
              <div className="card-body" style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 700 }}>{project.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '12px', marginBottom: '20px' }}>
                  <MapPin size={12} /> {project.address || 'Location not specified'}
                </div>

                {/* Progress */}
                <div className="progress-section" style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-main)' }}>Overall Progress</span>
                    <span style={{ color: 'var(--primary-color)' }}>{project.progress}%</span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--bg-main)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${project.progress}%`, background: 'var(--primary-color)', borderRadius: '2px' }}></div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ flex: 1, background: 'var(--bg-main)', padding: '12px', borderRadius: '12px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Open Pins</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>{project.openPins}</div>
                  </div>
                  <div style={{ flex: 1, background: 'var(--bg-main)', padding: '12px', borderRadius: '12px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Crew Count</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>{project.crewCount}</div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', padding: '10px', background: 'var(--bg-main)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                  View Site Details →
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Project Modal */}
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
    </div>
  );
}