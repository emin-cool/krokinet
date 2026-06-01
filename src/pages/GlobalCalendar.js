/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'moment/locale/tr';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { Gantt, Task, EventOption, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Trash2, Download, LayoutGrid, CalendarDays, BarChartHorizontal, AlertCircle, Clock } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

moment.locale('tr');
const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

export default function GlobalCalendar() {
  const { userData, currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' or 'gantt'
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    startDate: '',
    startTime: '09:00',
    endDate: '',
    endTime: '10:00',
    color: '#3b82f6',
    description: '',
    dependencies: '' // ID of the task it depends on
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'calendar_events'), (snapshot) => {
      const loadedEvents = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          start: data.start ? new Date(data.start.toDate ? data.start.toDate() : data.start) : new Date(),
          end: data.end ? new Date(data.end.toDate ? data.end.toDate() : data.end) : new Date(),
          color: data.color || '#3b82f6',
          description: data.description || '',
          createdBy: data.createdBy,
          dependencies: data.dependencies || '',
          progress: data.progress || 0,
        };
      });
      setEvents(loadedEvents);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // --- Sidebar Logic ---
  const today = new Date();
  today.setHours(0,0,0,0);

  const upcomingTasks = events.filter(e => e.start >= today && e.start <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)).sort((a,b) => a.start - b.start);
  const delayedTasks = events.filter(e => e.end < today && e.progress < 100).sort((a,b) => b.end - a.end);
  const todayTasks = events.filter(e => e.start <= today && e.end >= today);

  // --- PDF Export ---
  const downloadPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(20);
    doc.text('Haftalik Is Programi Raporu', 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Tarih: ${moment().format('DD MMMM YYYY')}`, 14, 30);

    const tableData = events.sort((a,b) => a.start - b.start).map(e => [
      e.title,
      moment(e.start).format('DD MMM YYYY HH:mm'),
      moment(e.end).format('DD MMM YYYY HH:mm'),
      e.dependencies ? events.find(ev => ev.id === e.dependencies)?.title || '-' : '-',
      e.end < today && e.progress < 100 ? 'Gecikti' : 'Zamaninda'
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Is Kalemi', 'Baslangic', 'Bitis', 'Oncul Is', 'Durum']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save('Is_Programi_Raporu.pdf');
  };

  // --- Drag & Drop Handlers ---
  const moveEvent = async ({ event, start, end, isAllDay: droppedOnAllDaySlot = false }) => {
    if (!userData?.isSuperAdmin) return;
    
    // Calculate time diff to move dependencies
    const timeDiff = start.getTime() - event.start.getTime();
    
    const updatedEvent = {
      ...event,
      start,
      end,
      allDay: droppedOnAllDaySlot,
    };
    
    // Update immediately locally (optional for fast UI, but snapshot will catch it)
    await updateDoc(doc(db, 'calendar_events', event.id), {
      start: start.toISOString(),
      end: end.toISOString()
    });
    
    // Recursively move dependent tasks (Cascading Delay)
    if (timeDiff !== 0) {
      await cascadeDelay(event.id, timeDiff);
    }
  };

  const resizeEvent = async ({ event, start, end }) => {
    if (!userData?.isSuperAdmin) return;
    
    const timeDiff = end.getTime() - event.end.getTime();
    
    await updateDoc(doc(db, 'calendar_events', event.id), {
      start: start.toISOString(),
      end: end.toISOString()
    });
    
    // If the event is prolonged, push dependents forward (basic logic)
    if (timeDiff > 0) {
      await cascadeDelay(event.id, timeDiff);
    }
  };

  const cascadeDelay = async (parentId, timeDiffMs) => {
    // Find tasks that depend on this parentId
    const dependentTasks = events.filter(e => e.dependencies === parentId);
    for (const task of dependentTasks) {
      const newStart = new Date(task.start.getTime() + timeDiffMs);
      const newEnd = new Date(task.end.getTime() + timeDiffMs);
      
      await updateDoc(doc(db, 'calendar_events', task.id), {
        start: newStart.toISOString(),
        end: newEnd.toISOString()
      });
      // Recursion
      await cascadeDelay(task.id, timeDiffMs);
    }
  };
  
  // --- Gantt Chart Tasks ---
  const ganttTasks = events.map(e => ({
    start: e.start,
    end: e.end,
    name: e.title,
    id: e.id,
    type: 'task',
    progress: e.progress || 0,
    isDisabled: !userData?.isSuperAdmin,
    styles: { progressColor: e.color, progressSelectedColor: e.color },
    dependencies: e.dependencies ? [e.dependencies] : []
  }));

  const handleTaskChange = async (task) => {
    if (!userData?.isSuperAdmin) return;
    const timeDiff = task.start.getTime() - (events.find(e => e.id === task.id)?.start.getTime() || task.start.getTime());
    
    await updateDoc(doc(db, 'calendar_events', task.id), {
      start: task.start.toISOString(),
      end: task.end.toISOString(),
      progress: task.progress
    });

    if (timeDiff !== 0) {
      await cascadeDelay(task.id, timeDiff);
    }
  };

  // --- Normal CRUD Handlers ---
  const handleSelectSlot = ({ start, end }) => {
    if (!userData?.isSuperAdmin) return;
    
    const startDate = moment(start).format('YYYY-MM-DD');
    const endDate = moment(end).format('YYYY-MM-DD');
    const startTime = moment(start).format('HH:mm') === '00:00' ? '09:00' : moment(start).format('HH:mm');
    const endTime = moment(end).format('HH:mm') === '00:00' ? '10:00' : moment(end).format('HH:mm');

    setEditingEvent(null);
    setFormData({
      title: '', startDate, startTime,
      endDate: moment(end).isSame(start, 'day') ? endDate : moment(end).subtract(1, 'days').format('YYYY-MM-DD'),
      endTime, color: '#3b82f6', description: '', dependencies: ''
    });
    setShowModal(true);
  };

  const handleSelectEvent = (event) => {
    if (!userData?.isSuperAdmin) return;
    setEditingEvent(event);
    setFormData({
      title: event.title || event.name,
      startDate: moment(event.start).format('YYYY-MM-DD'),
      startTime: moment(event.start).format('HH:mm'),
      endDate: moment(event.end).format('YYYY-MM-DD'),
      endTime: moment(event.end).format('HH:mm'),
      color: event.color || event.styles?.progressColor || '#3b82f6',
      description: event.description || '',
      dependencies: event.dependencies && event.dependencies.length > 0 ? (Array.isArray(event.dependencies) ? event.dependencies[0] : event.dependencies) : ''
    });
    setShowModal(true);
  };

  const saveEvent = async () => {
    if (!formData.title || !formData.startDate || !formData.endDate) {
      alert('Lütfen başlık ve tarihleri doldurun.');
      return;
    }

    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);

    if (endDateTime < startDateTime) {
      alert('Bitiş tarihi başlangıç tarihinden önce olamaz.');
      return;
    }

    const eventData = {
      title: formData.title,
      start: startDateTime.toISOString(),
      end: endDateTime.toISOString(),
      color: formData.color,
      description: formData.description,
      dependencies: formData.dependencies,
      createdBy: currentUser.uid,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingEvent) {
        await updateDoc(doc(db, 'calendar_events', editingEvent.id), eventData);
        // Delay Check
        const oldStart = editingEvent.start;
        const timeDiff = startDateTime.getTime() - oldStart.getTime();
        if (timeDiff !== 0) {
          await cascadeDelay(editingEvent.id, timeDiff);
        }
      } else {
        await addDoc(collection(db, 'calendar_events'), {
          ...eventData,
          createdAt: new Date().toISOString(),
          progress: 0
        });
      }
      setShowModal(false);
    } catch (err) {
      console.error("Etkinlik kaydedilemedi:", err);
      alert("Hata oluştu.");
    }
  };

  const deleteEvent = async () => {
    if (!editingEvent) return;
    if (window.confirm("Bu etkinliği silmek istediğinize emin misiniz?")) {
      try {
        await deleteDoc(doc(db, 'calendar_events', editingEvent.id));
        setShowModal(false);
      } catch (err) {
        console.error("Silinemedi:", err);
      }
    }
  };

  const eventStyleGetter = (event) => ({
    style: {
      backgroundColor: event.color,
      borderRadius: '4px',
      opacity: 0.9,
      color: 'white',
      border: '0',
      display: 'block'
    }
  });

  if (loading) return <div className="loading">Takvim yükleniyor...</div>;

  return (
    <div style={{ padding: '24px', background: 'var(--bg-main)', minHeight: 'calc(100vh - 120px)' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CalendarDays size={32} color="var(--primary-color)"/> İş Programı & Gantt
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>Genel şantiye takvimi ve proje çizelgesi.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="btn-secondary" onClick={downloadPDF} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}>
            <Download size={18} /> Rapor İndir
          </button>
          
          <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => setActiveTab('calendar')}
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: activeTab === 'calendar' ? 'var(--primary-color)' : 'transparent', color: activeTab === 'calendar' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, transition: 'all 0.2s' }}
            >
              <LayoutGrid size={18} /> Takvim
            </button>
            <button 
              onClick={() => setActiveTab('gantt')}
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: activeTab === 'gantt' ? 'var(--primary-color)' : 'transparent', color: activeTab === 'gantt' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, transition: 'all 0.2s' }}
            >
              <BarChartHorizontal size={18} /> Gantt
            </button>
          </div>
          
          {userData?.isSuperAdmin && (
            <button className="btn-primary" onClick={() => handleSelectSlot({ start: new Date(), end: new Date() })} style={{ padding: '10px 16px' }}>
              ➕ Yeni İş
            </button>
          )}
        </div>
      </div>

      {/* GRID LAYOUT: 75% Left, 25% Right (Responsive setup via flex/grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', alignItems: 'start' }} className="calendar-grid-container">
        
        {/* LEFT COLUMN: Calendar / Gantt */}
        <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', height: '75vh', overflow: 'hidden', gridColumn: 'span 3' }} className="calendar-main-col">
          
          {activeTab === 'calendar' ? (
            <DnDCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%', color: 'var(--text-main)' }}
              selectable={userData?.isSuperAdmin}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              onEventDrop={moveEvent}
              onEventResize={resizeEvent}
              resizable={userData?.isSuperAdmin}
              eventPropGetter={eventStyleGetter}
              messages={{ next: "İleri", previous: "Geri", today: "Bugün", month: "Ay", week: "Hafta", day: "Gün", agenda: "Ajanda" }}
              popup
            />
          ) : (
            <div style={{ height: '100%', overflowY: 'auto' }}>
              {ganttTasks.length > 0 ? (
                <Gantt 
                  tasks={ganttTasks}
                  viewMode={ViewMode.Day}
                  onDateChange={handleTaskChange}
                  onProgressChange={handleTaskChange}
                  onDoubleClick={handleSelectEvent}
                  listCellWidth="155px"
                  columnWidth={60}
                />
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
                  Henüz iş eklenmemiş.
                </div>
              )}
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Sidebar (Notifications & Overviews) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', gridColumn: 'span 1' }} className="calendar-sidebar-col">
          
          {/* Geciken İşler */}
          <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid #ef444433', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={20} /> Geciken İşler
            </h3>
            {delayedTasks.length > 0 ? delayedTasks.map(t => (
              <div key={t.id} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '8px', borderLeft: `4px solid ${t.color}`, cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => handleSelectEvent(t)} className="hover-scale">
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>{t.title}</div>
                <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>Bitiş: {moment(t.end).format('DD MMM YYYY')}</div>
              </div>
            )) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Geciken iş yok. Harika!</p>
            )}
          </div>

          {/* Bugünün İşleri */}
          <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} color="var(--primary-color)"/> Bugünün İşleri
            </h3>
            {todayTasks.length > 0 ? todayTasks.map(t => (
              <div key={t.id} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '8px', borderLeft: `4px solid ${t.color}`, cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => handleSelectEvent(t)} className="hover-scale">
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>{t.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{moment(t.start).format('HH:mm')} - {moment(t.end).format('HH:mm')}</div>
              </div>
            )) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Bugün için planlanan iş yok.</p>
            )}
          </div>

          {/* Yaklaşan İşler */}
          <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarDays size={20} color="#f59e0b"/> Yaklaşan (7 Gün)
            </h3>
            {upcomingTasks.length > 0 ? upcomingTasks.slice(0, 5).map(t => (
              <div key={t.id} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '8px', borderLeft: `4px solid ${t.color}`, cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => handleSelectEvent(t)} className="hover-scale">
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>{t.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{moment(t.start).format('DD MMM')}</div>
              </div>
            )) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Yaklaşan iş bulunmuyor.</p>
            )}
          </div>

        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h2>{editingEvent ? 'İş Kalemi Düzenle' : 'Yeni İş Kalemi'}</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>İşin Adı</label>
                <input 
                  placeholder="Kalıp Çakılması, Beton Dökümü vb." 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Başlangıç</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} style={{ flex: 2 }}/>
                    <input type="time" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} style={{ flex: 1 }}/>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Bitiş</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} style={{ flex: 2 }}/>
                    <input type="time" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} style={{ flex: 1 }}/>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Öncül İş (Bağımlılık)</label>
                <select 
                  value={formData.dependencies} 
                  onChange={e => setFormData({...formData, dependencies: e.target.value})}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}
                >
                  <option value="">-- Bağımsız İş --</option>
                  {events.filter(e => e.id !== (editingEvent?.id)).map(e => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
                </select>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Öncül iş gecikirse, bu iş de otomatik olarak ileri kaydırılacaktır.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Etkinlik Rengi</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input type="color" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'none' }}/>
                  <span style={{ fontSize: '13px', color: 'var(--text-main)', opacity: 0.8 }}>Gantt ve takvimde gösterilecek renk</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Açıklama</label>
                <textarea 
                  placeholder="Detaylar..." 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  style={{ width: '100%', minHeight: '60px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)', resize: 'vertical' }}
                />
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '24px', justifyContent: 'space-between' }}>
              <div>
                {editingEvent && (
                  <button className="btn-danger" onClick={deleteEvent} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Trash2 size={16} /> Sil
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-secondary" onClick={() => setShowModal(false)}>İptal</button>
                <button className="btn-primary" onClick={saveEvent}>Kaydet</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
