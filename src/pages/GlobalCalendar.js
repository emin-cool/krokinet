import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, ChevronRight, Search, Plus, Calendar as CalendarIcon, Clock, X, Trash2, MapPin } from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import './GlobalCalendar.css';

const EVENT_COLORS = [
  '#4f46e5', // indigo
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
];

export default function GlobalCalendar() {
  const { userData } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [projects, setProjects] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [viewMode, setViewMode] = useState('Month'); // 'Week' or 'Month'

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    startDate: '',
    endDate: '',
    color: EVENT_COLORS[0],
    isAllDay: false
  });

  useEffect(() => {
    // Projelerdeki görevler
    const q = query(collection(db, 'projects'));
    const unsub = onSnapshot(q, snap => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Bağımsız takvim etkinlikleri
    const eQ = query(collection(db, 'calendar_events'));
    const unsubE = onSnapshot(eQ, snap => {
      setCalendarEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsub();
      unsubE();
    };
  }, []);

  // Tüm etkinlikleri birleştir
  const allTasks = [...calendarEvents.map(e => ({...e, isGlobal: true}))];
  projects.forEach(proj => {
    if (proj.schedule && Array.isArray(proj.schedule)) {
      proj.schedule.forEach(task => {
        allTasks.push({ ...task, projectName: proj.name, projectId: proj.id, isGlobal: false, color: '#94a3b8' });
      });
    }
  });

  const changeDate = (days) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  };

  const changeMonth = (diff) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + diff, 1);
    setCurrentDate(newDate);
  };

  const openModal = (dateStr = null, event = null) => {
    if (event) {
      if (!event.isGlobal) {
        alert("Proje görevleri yalnızca proje sayfasından düzenlenebilir.");
        return;
      }
      setSelectedEvent(event);
      setFormData({
        title: event.title || '',
        startDate: event.startDate ? event.startDate.substring(0, 16) : '',
        endDate: event.endDate ? event.endDate.substring(0, 16) : '',
        color: event.color || EVENT_COLORS[0],
        isAllDay: event.isAllDay || false
      });
    } else {
      setSelectedEvent(null);
      // Create local ISO string properly adjusted for timezone
      const tzOffset = (new Date()).getTimezoneOffset() * 60000; // offset in milliseconds
      let d = dateStr ? new Date(dateStr) : new Date();
      if(dateStr) {
        d.setHours(12, 0, 0, 0); // Default to noon if clicking a day
      }
      const localISOTime = (new Date(d - tzOffset)).toISOString().slice(0, 16);
      
      setFormData({
        title: '',
        startDate: localISOTime,
        endDate: localISOTime,
        color: EVENT_COLORS[0],
        isAllDay: false
      });
    }
    setShowModal(true);
  };

  const saveEvent = async () => {
    if (!formData.title || !formData.startDate || !formData.endDate) {
      alert("Lütfen zorunlu alanları doldurun.");
      return;
    }
    try {
      const dataToSave = {
        title: formData.title,
        startDate: formData.startDate,
        endDate: formData.endDate,
        color: formData.color,
        isAllDay: formData.isAllDay
      };

      if (selectedEvent) {
        await updateDoc(doc(db, 'calendar_events', selectedEvent.id), dataToSave);
      } else {
        await addDoc(collection(db, 'calendar_events'), dataToSave);
      }
      setShowModal(false);
    } catch (error) {
      console.error("Hata:", error);
      alert("Etkinlik kaydedilirken bir hata oluştu.");
    }
  };

  const deleteEvent = async () => {
    if (!selectedEvent) return;
    if (!window.confirm("Bu etkinliği silmek istediğinize emin misiniz?")) return;
    try {
      await deleteDoc(doc(db, 'calendar_events', selectedEvent.id));
      setShowModal(false);
    } catch (error) {
      alert("Silme başarısız.");
    }
  };

  const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // --- MONTH VIEW LOGIC ---
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => {
    let day = new Date(year, month, 1).getDay(); // 0 is Sunday
    return day === 0 ? 6 : day - 1; // Make Monday 0, Sunday 6
  };

  const renderMonthGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month); // 0 (Mon) to 6 (Sun)
    
    const days = [];
    const prevMonthDays = getDaysInMonth(year, month - 1);
    
    // Prev Month padding
    for (let i = 0; i < firstDay; i++) {
      const d = prevMonthDays - firstDay + i + 1;
      const dateStr = `${month === 0 ? year - 1 : year}-${String(month === 0 ? 12 : month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, isCurrentMonth: false, dateStr });
    }
    
    // Current Month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ day: i, isCurrentMonth: true, isToday: i === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear(), dateStr });
    }
    
    // Next Month padding
    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const dateStr = `${month === 11 ? year + 1 : year}-${String(month === 11 ? 1 : month + 2).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ day: i, isCurrentMonth: false, dateStr });
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: '#e2e8f0', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cts', 'Paz'].map((dayName, idx) => (
          <div key={idx} style={{ background: '#f8fafc', padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
            {dayName}
          </div>
        ))}
        {days.map((d, idx) => {
          // Find tasks for this day
          const dayTasks = allTasks.filter(t => {
            if(!t.startDate) return false;
            const tStart = new Date(t.startDate);
            const tEnd = new Date(t.endDate);
            const cur = new Date(d.dateStr);
            tStart.setHours(0,0,0,0);
            tEnd.setHours(23,59,59,999);
            cur.setHours(12,0,0,0);
            return cur >= tStart && cur <= tEnd;
          });

          return (
            <div 
              key={idx} 
              onClick={() => openModal(d.dateStr)}
              style={{ 
                background: '#fff', 
                minHeight: '120px', 
                padding: '8px', 
                cursor: 'pointer',
                opacity: d.isCurrentMonth ? 1 : 0.5,
                transition: 'background 0.2s',
                ':hover': { background: '#f1f5f9' }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                <span style={{ 
                  width: '28px', height: '28px', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  borderRadius: '50%', 
                  background: d.isToday ? '#4f46e5' : 'transparent',
                  color: d.isToday ? '#fff' : (d.isCurrentMonth ? '#0f172a' : '#94a3b8'),
                  fontWeight: d.isToday ? 700 : 500,
                  fontSize: '13px'
                }}>
                  {d.day}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {dayTasks.slice(0, 4).map((task, tIdx) => (
                  <div 
                    key={tIdx} 
                    onClick={(e) => { e.stopPropagation(); openModal(null, task); }}
                    style={{ 
                      background: task.color || '#4f46e5', 
                      color: '#fff', 
                      fontSize: '11px', 
                      padding: '4px 6px', 
                      borderRadius: '4px', 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      fontWeight: 600,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}
                    title={task.title}
                  >
                    {task.isAllDay ? '' : new Date(task.startDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ' '}
                    {task.title}
                  </div>
                ))}
                {dayTasks.length > 4 && (
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, paddingLeft: '4px' }}>
                    +{dayTasks.length - 4} daha...
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // --- WEEK/DAY VIEW LOGIC ---
  const renderDayView = () => {
    const todayTasks = allTasks.filter(t => {
      if(!t.startDate) return false;
      const tStart = new Date(t.startDate);
      const tEnd = new Date(t.endDate);
      const cur = new Date(currentDate);
      tStart.setHours(0,0,0,0);
      tEnd.setHours(23,59,59,999);
      cur.setHours(12,0,0,0);
      return cur >= tStart && cur <= tEnd;
    }).sort((a,b) => new Date(a.startDate) - new Date(b.startDate));

    return (
      <div style={{ position: 'relative', paddingLeft: '48px', marginTop: '24px' }}>
        {todayTasks.length > 0 && (
          <div style={{ position: 'absolute', left: '12px', top: '24px', bottom: '24px', width: '2px', background: '#e2e8f0', zIndex: 0 }}></div>
        )}

        {todayTasks.length === 0 ? (
          <div 
            onClick={() => openModal(currentDate.toISOString())}
            style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontWeight: 500, border: '2px dashed #e2e8f0', borderRadius: '16px', cursor: 'pointer' }}
          >
            Bu gün için planlanmış bir görev bulunmuyor. Yeni eklemek için tıklayın.
          </div>
        ) : (
          todayTasks.map((task, idx) => {
            const startTime = new Date(task.startDate);
            const timeStr = task.isAllDay ? 'Tüm Gün' : `${startTime.getHours()}:${startTime.getMinutes().toString().padStart(2, '0')}`;
            const progress = task.progress || 0;
            const endStr = new Date(task.endDate).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

            return (
              <div 
                key={idx} 
                onClick={() => openModal(null, task)}
                style={{ position: 'relative', marginBottom: idx === todayTasks.length - 1 ? '0' : '48px', cursor: 'pointer' }}
              >
                <div style={{ position: 'absolute', left: '-68px', top: '-4px', fontSize: '12px', fontWeight: 700, color: '#0f172a', width: '46px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  <span style={{ color: task.color || '#4f46e5', fontSize: '16px' }}>O</span>{timeStr}
                </div>
                
                <div style={{ position: 'absolute', left: '-44px', top: '-2px', width: '12px', height: '12px', borderRadius: '50%', border: `2px solid ${task.color || '#4f46e5'}`, background: '#fff', zIndex: 1 }}></div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', transition: 'all 0.2s' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{task.title}</h3>
                    
                    {!task.isGlobal && task.projectName && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b', marginBottom: '16px', fontWeight: 500 }}>
                        <MapPin size={14} /> {task.projectName}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ padding: '6px 12px', background: `${task.color || '#4f46e5'}20`, color: task.color || '#4f46e5', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}>
                        {task.isGlobal ? 'Etkinlik' : (task.category || 'Genel')}
                      </span>
                      {!task.isGlobal && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '200px' }}>
                          <div style={{ height: '4px', flex: 1, background: '#e2e8f0', borderRadius: '2px' }}>
                            <div style={{ height: '100%', width: `${progress}%`, background: '#4f46e5', borderRadius: '2px' }}></div>
                          </div>
                          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>%{progress} Tamamlandı</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>Bitiş</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{endStr}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div className="calendar-page" style={{ padding: '32px', height: '100%', overflowY: 'auto', background: '#f8fafc', minHeight: '100vh' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold' }}>
            {userData?.name ? userData.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{userData?.name || 'Yönetici'}</h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{userData?.role || 'Şantiye Şefi'}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => openModal()} style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 24px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}>
            <Plus size={18} /> Yeni Görev
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'Month' ? '1fr' : '300px 1fr', gap: '32px' }}>
        
        {/* Left Column (Only for Week/Day view) */}
        {viewMode === 'Week' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: '#fff', padding: '24px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a', textTransform: 'capitalize' }}>
                  {currentDate.toLocaleString('tr-TR', { month: 'long', year: 'numeric' })}
                </h3>
                <div style={{ display: 'flex', gap: '12px', color: '#0f172a' }}>
                  <button onClick={() => changeDate(-30)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}><ChevronLeft size={20} /></button>
                  <button onClick={() => changeDate(30)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}><ChevronRight size={20} /></button>
                </div>
              </div>
              
              {/* Mini Calendar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '12px', color: '#64748b', marginBottom: '16px', fontWeight: 600 }}>
                <div>Pz</div><div>Pt</div><div>Sa</div><div>Ça</div><div>Pe</div><div>Cu</div><div>Ct</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '13px' }}>
                {Array.from({length: getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth())}, (_, i) => {
                  const isSelected = i + 1 === currentDate.getDate();
                  return (
                    <div 
                      key={i} 
                      onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1))}
                      style={{ cursor: 'pointer', background: isSelected ? '#4f46e5' : 'transparent', color: isSelected ? '#fff' : '#1e293b', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 'auto', fontWeight: isSelected ? 700 : 500 }}
                    >
                      {i + 1}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div style={{ background: '#fff', padding: '32px 40px', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', minHeight: '600px', position: 'relative' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
            <div>
              {viewMode === 'Week' ? (
                <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  {capitalize(currentDate.toLocaleDateString('tr-TR', { weekday: 'long' }))},<br/>
                  {currentDate.getDate()} {capitalize(currentDate.toLocaleDateString('tr-TR', { month: 'long' }))}
                </h1>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                    {capitalize(currentDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }))}
                  </h1>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => changeMonth(-1)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}><ChevronLeft size={20} /></button>
                    <button onClick={() => setCurrentDate(new Date())} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '0 16px', fontWeight: 600, cursor: 'pointer', color: '#475569' }}>Bugün</button>
                    <button onClick={() => changeMonth(1)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}><ChevronRight size={20} /></button>
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '30px', padding: '4px' }}>
              <button onClick={() => setViewMode('Week')} style={{ padding: '8px 20px', border: 'none', borderRadius: '30px', background: viewMode === 'Week' ? '#fff' : 'transparent', color: viewMode === 'Week' ? '#4f46e5' : '#64748b', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: viewMode === 'Week' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>Liste (Günlük)</button>
              <button onClick={() => setViewMode('Month')} style={{ padding: '8px 20px', border: 'none', borderRadius: '30px', background: viewMode === 'Month' ? '#fff' : 'transparent', color: viewMode === 'Month' ? '#4f46e5' : '#64748b', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: viewMode === 'Month' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>Izgara (Aylık)</button>
            </div>
          </div>

          {viewMode === 'Month' ? renderMonthGrid() : renderDayView()}
          
        </div>
      </div>
      
      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                {selectedEvent ? 'Görevi Düzenle' : 'Yeni Görev Ekle'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={24} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Görev Başlığı</label>
                <input 
                  type="text" 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  placeholder="Görev adı..."
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Başlangıç Zamanı</label>
                  <input 
                    type={formData.isAllDay ? "date" : "datetime-local"} 
                    value={formData.startDate} 
                    onChange={e => setFormData({...formData, startDate: e.target.value})} 
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Bitiş Zamanı</label>
                  <input 
                    type={formData.isAllDay ? "date" : "datetime-local"} 
                    value={formData.endDate} 
                    onChange={e => setFormData({...formData, endDate: e.target.value})} 
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.isAllDay} onChange={e => setFormData({...formData, isAllDay: e.target.checked})} style={{ width: '16px', height: '16px', accentColor: '#4f46e5' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>Tüm Gün Etkinliği</span>
              </label>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Renk Seçimi</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {EVENT_COLORS.map(c => (
                    <div 
                      key={c}
                      onClick={() => setFormData({...formData, color: c})}
                      style={{ 
                        width: '32px', height: '32px', borderRadius: '50%', background: c, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: formData.color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px' }}>
              {selectedEvent ? (
                <button onClick={deleteEvent} style={{ background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '12px', padding: '12px 16px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Trash2 size={16} /> Sil
                </button>
              ) : <div></div>}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setShowModal(false)} style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '12px', padding: '12px 24px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>İptal</button>
                <button onClick={saveEvent} style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 24px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>Kaydet</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
