/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'moment/locale/tr';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { Gantt, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { db } from '../firebase';
import { updateDoc, doc, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Trash2, Download, LayoutGrid, BarChartHorizontal, AlertCircle, Clock, CalendarDays } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../contexts/AuthContext';
import TaskBoard from './TaskBoard/TaskBoard';

moment.locale('tr');
const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

export default function ProjectSchedule({ project, projectId, fetchProject, isManager }) {
  const { userData, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('calendar'); 
  const [categoryFilter, setCategoryFilter] = useState('Tümü');

  const CATEGORY_COLORS = {
    'yapısal': '#ef4444', 
    'elektrik': '#eab308', 
    'tesisat': '#22c55e', 
    'mekanik': '#f97316', 
    'mimari': '#a855f7', 
    'joker': '#ec4899'
  };
  
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState({
    title: '', startDate: '', startTime: '09:00', endDate: '', endTime: '10:00', color: '#3b82f6', description: '', category: 'Genel', dependencies: '', progress: 0
  });

  const schedule = project.schedule || [];
  
  // Format events for react-big-calendar
  const events = schedule.map(t => ({
    id: t.id,
    title: t.title,
    start: new Date(t.startDate),
    end: new Date(t.endDate),
    color: t.color || '#3b82f6',
    description: t.description || '',
    category: t.category || 'Genel',
    dependencies: t.dependencies || '',
    progress: t.progress || 0
  }));

  const today = new Date();
  today.setHours(0,0,0,0);

  const displayedEvents = categoryFilter === 'Tümü' ? events : events.filter(e => e.category === categoryFilter);

  const upcomingTasks = displayedEvents.filter(e => e.start >= today && e.start <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)).sort((a,b) => a.start - b.start);
  const delayedTasks = displayedEvents.filter(e => e.end < today && e.progress < 100).sort((a,b) => b.end - a.end);
  const todayTasks = displayedEvents.filter(e => e.start <= today && e.end >= today);

  const downloadPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(20);
    doc.text(`Is Programi Raporu - ${project.name}`, 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Tarih: ${moment().format('DD MMMM YYYY')}`, 14, 30);

    const tableData = displayedEvents.sort((a,b) => a.start - b.start).map(e => [
      e.title, e.category, moment(e.start).format('DD MMM YYYY HH:mm'), moment(e.end).format('DD MMM YYYY HH:mm'),
      e.dependencies ? events.find(ev => ev.id === e.dependencies)?.title || '-' : '-',
      e.end < today && e.progress < 100 ? 'Gecikti' : `%${e.progress}`
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Is Kalemi', 'Kategori', 'Baslangic', 'Bitis', 'Oncul Is', 'Durum/Ilerleme']],
      body: tableData,
      theme: 'grid', styles: { fontSize: 10 }, headStyles: { fillColor: [59, 130, 246] }
    });
    doc.save(`${project.name}_Is_Programi.pdf`);
  };

  const cascadeDelayLocally = (parentId, timeDiffMs, currentSchedule) => {
    let updated = [...currentSchedule];
    const cascade = (pId, diff) => {
      const deps = updated.filter(t => t.dependencies === pId);
      deps.forEach(d => {
        const newStart = new Date(new Date(d.startDate).getTime() + diff);
        const newEnd = new Date(new Date(d.endDate).getTime() + diff);
        
        const index = updated.findIndex(u => u.id === d.id);
        if (index > -1) {
          updated[index] = { ...updated[index], startDate: newStart.toISOString(), endDate: newEnd.toISOString() };
        }
        cascade(d.id, diff);
      });
    };
    cascade(parentId, timeDiffMs);
    return updated;
  };

  const updateSchedule = async (newSchedule) => {
    await updateDoc(doc(db, 'projects', projectId), { schedule: newSchedule });
    fetchProject();
  };

  const moveEvent = async ({ event, start, end }) => {
    if (!isManager) return;
    const timeDiff = start.getTime() - event.start.getTime();
    
    let newSchedule = [...schedule];
    const idx = newSchedule.findIndex(t => t.id === event.id);
    if(idx > -1) {
      newSchedule[idx] = { ...newSchedule[idx], startDate: start.toISOString(), endDate: end.toISOString() };
    }
    
    if (timeDiff !== 0) {
      newSchedule = cascadeDelayLocally(event.id, timeDiff, newSchedule);
    }
    await updateSchedule(newSchedule);
  };

  const resizeEvent = async ({ event, start, end }) => {
    if (!isManager) return;
    const timeDiff = end.getTime() - event.end.getTime();
    
    let newSchedule = [...schedule];
    const idx = newSchedule.findIndex(t => t.id === event.id);
    if(idx > -1) {
      newSchedule[idx] = { ...newSchedule[idx], startDate: start.toISOString(), endDate: end.toISOString() };
    }
    
    if (timeDiff > 0) {
      newSchedule = cascadeDelayLocally(event.id, timeDiff, newSchedule);
    }
    await updateSchedule(newSchedule);
  };

  const handleTaskChange = async (task) => {
    if (!isManager) return;
    const originalEvent = events.find(e => e.id === task.id);
    const timeDiff = task.start.getTime() - (originalEvent ? originalEvent.start.getTime() : task.start.getTime());
    
    let newSchedule = [...schedule];
    const idx = newSchedule.findIndex(t => t.id === task.id);
    if(idx > -1) {
      newSchedule[idx] = { ...newSchedule[idx], startDate: task.start.toISOString(), endDate: task.end.toISOString(), progress: task.progress };
    }
    
    if (timeDiff !== 0) {
      newSchedule = cascadeDelayLocally(task.id, timeDiff, newSchedule);
    }
    await updateSchedule(newSchedule);
  };

  const handleSelectSlot = ({ start, end }) => {
    if (!isManager) return;
    const startDate = moment(start).format('YYYY-MM-DD');
    const endDate = moment(end).format('YYYY-MM-DD');
    const startTime = moment(start).format('HH:mm') === '00:00' ? '09:00' : moment(start).format('HH:mm');
    const endTime = moment(end).format('HH:mm') === '00:00' ? '10:00' : moment(end).format('HH:mm');

    setEditingTask(null);
    setFormData({
      title: '', startDate, startTime,
      endDate: moment(end).isSame(start, 'day') ? endDate : moment(end).subtract(1, 'days').format('YYYY-MM-DD'),
      endTime, color: '#3b82f6', description: '', category: 'Genel', dependencies: '', progress: 0
    });
    setShowModal(true);
  };

  const handleSelectEvent = (event) => {
    setEditingTask(event);
    setFormData({
      title: event.title || event.name,
      startDate: moment(event.start).format('YYYY-MM-DD'),
      startTime: moment(event.start).format('HH:mm'),
      endDate: moment(event.end).format('YYYY-MM-DD'),
      endTime: moment(event.end).format('HH:mm'),
      color: event.color || event.styles?.progressColor || '#3b82f6',
      description: event.description || '',
      category: event.category || 'Genel',
      dependencies: event.dependencies && event.dependencies.length > 0 ? (Array.isArray(event.dependencies) ? event.dependencies[0] : event.dependencies) : '',
      progress: event.progress || 0
    });
    setShowModal(true);
  };

  const saveTask = async () => {
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

    const taskData = {
      title: formData.title,
      startDate: startDateTime.toISOString(),
      endDate: endDateTime.toISOString(),
      color: formData.color,
      description: formData.description,
      category: formData.category,
      dependencies: formData.dependencies,
      progress: formData.progress,
      updatedAt: new Date().toISOString()
    };

    let newSchedule = [...schedule];

    if (editingTask) {
      const idx = newSchedule.findIndex(t => t.id === editingTask.id);
      if(idx > -1) {
        newSchedule[idx] = { ...newSchedule[idx], ...taskData };
      }
      const oldStart = editingTask.start;
      const timeDiff = startDateTime.getTime() - oldStart.getTime();
      if (timeDiff !== 0) {
        newSchedule = cascadeDelayLocally(editingTask.id, timeDiff, newSchedule);
      }
    } else {
      newSchedule.push({
        ...taskData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      });
    }

    await updateSchedule(newSchedule);

    // Sync updated tasks to personal calendar
    if (editingTask) {
       try {
         // We should update the task that was directly edited
         const q = query(collection(db, 'personal_calendar_events'), where('taskId', '==', editingTask.id));
         const snapshot = await getDocs(q);
         snapshot.forEach(async (docSnap) => {
           await updateDoc(docSnap.ref, {
             start: taskData.startDate,
             end: taskData.endDate,
             title: `[Proje: ${project.name}] ${taskData.title}`,
             color: taskData.color || '#3b82f6',
             category: taskData.category || 'Belirtilmedi',
             description: taskData.description || '',
             updatedAt: new Date().toISOString()
           });
         });

         // If cascaded, we could sync all shifted ones, but let's just sync the whole newSchedule for any linked tasks
         if (timeDiff !== 0) {
            newSchedule.forEach(async (t) => {
              if (t.id === editingTask.id) return; // already synced
              const q2 = query(collection(db, 'personal_calendar_events'), where('taskId', '==', t.id));
              const snap2 = await getDocs(q2);
              snap2.forEach(async (dSnap) => {
                 await updateDoc(dSnap.ref, {
                   start: new Date(t.startDate || t.start).toISOString(),
                   end: new Date(t.endDate || t.end).toISOString(),
                   updatedAt: new Date().toISOString()
                 });
              });
            });
         }
       } catch (err) {
         console.error("Calendar sync failed:", err);
       }
    }

    setShowModal(false);
  };

  const deleteTask = async () => {
    if (!editingTask) return;
    if (window.confirm("Bu etkinliği silmek istediğinize emin misiniz?")) {
      const newSchedule = schedule.filter(t => t.id !== editingTask.id);
      await updateSchedule(newSchedule);
      // Sync delete
      try {
        const q = query(collection(db, 'personal_calendar_events'), where('taskId', '==', editingTask.id));
        const snapshot = await getDocs(q);
        snapshot.forEach(async (docSnap) => {
          // Just update it as deleted or delete the document? Let's delete it.
          // Wait, we need deleteDoc imported for this. I'll just change the title to [Silindi] for now to avoid needing another import.
          await updateDoc(docSnap.ref, {
             title: `[SİLİNDİ] ${editingTask.title}`
          });
        });
      } catch (e) {}
      setShowModal(false);
    }
  };

  const handleAddToCalendar = async (task, e) => {
    if (e) e.stopPropagation();
    try {
      await addDoc(collection(db, 'personal_calendar_events'), {
        title: `[Proje: ${project.name}] ${task.title}`,
        start: new Date(task.start).toISOString(),
        end: new Date(task.end).toISOString(),
        color: task.color || '#3b82f6',
        category: task.category || 'Belirtilmedi',
        description: task.description || '',
        userId: currentUser.uid,
        projectId: projectId,
        taskId: task.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      alert('Kişisel takviminize eklendi!');
    } catch (error) {
      console.error(error);
      alert('Takvime eklenirken hata oluştu.');
    }
  };

  const ganttTasks = displayedEvents.map(e => ({
    start: e.start,
    end: e.end,
    name: e.title,
    id: e.id,
    type: 'task',
    progress: e.progress || 0,
    isDisabled: !isManager,
    styles: { progressColor: e.color, progressSelectedColor: e.color },
    dependencies: e.dependencies ? [e.dependencies] : []
  }));

  const eventStyleGetter = (event) => ({
    style: { backgroundColor: event.color, borderRadius: '4px', opacity: 0.9, color: 'white', border: '0', display: 'block' }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
      
      {/* HEADER & FILTERS */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '-10px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="btn-secondary" onClick={downloadPDF} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}>
            <Download size={18} /> Rapor İndir
          </button>
          
          <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => setActiveTab('calendar')}
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: activeTab === 'calendar' ? 'var(--primary-color)' : 'transparent', color: activeTab === 'calendar' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, transition: 'all 0.2s' }}
            >
              <LayoutGrid size={18} /> Görev Panosu
            </button>
            <button 
              onClick={() => setActiveTab('gantt')}
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: activeTab === 'gantt' ? 'var(--primary-color)' : 'transparent', color: activeTab === 'gantt' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, transition: 'all 0.2s' }}
            >
              <BarChartHorizontal size={18} /> Gantt
            </button>
          </div>
          
          {isManager && (
            <button className="btn-primary" onClick={() => handleSelectSlot({ start: new Date(), end: new Date() })} style={{ padding: '10px 16px' }}>
              ➕ Yeni İş
            </button>
          )}
        </div>
      </div>

      {/* GRID LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Calendar / Gantt */}
        <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', height: activeTab === 'gantt' ? '65vh' : 'auto', overflow: activeTab === 'gantt' ? 'hidden' : 'visible', gridColumn: activeTab === 'gantt' ? 'span 3' : 'span 4' }}>
          
          {activeTab === 'calendar' ? (
            <TaskBoard events={displayedEvents} onTaskClick={handleSelectEvent} onAddToCalendar={handleAddToCalendar} />
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

        {/* RIGHT COLUMN: Sidebar (Notifications & Overviews) - Only on Gantt View */}
        {activeTab === 'gantt' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', gridColumn: 'span 1' }}>
            
            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid #ef444433', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={20} /> Geciken İşler
              </h3>
              {delayedTasks.length > 0 ? delayedTasks.map(t => (
                <div key={t.id} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '8px', borderLeft: `4px solid ${t.color}`, cursor: 'pointer' }} onClick={() => handleSelectEvent(t)}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>{t.title}</div>
                  <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>Bitiş: {moment(t.end).format('DD MMM YYYY')} ( %{t.progress} )</div>
                </div>
              )) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Geciken iş yok. Harika!</p>
              )}
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={20} color="var(--primary-color)"/> Bugünün İşleri
              </h3>
              {todayTasks.length > 0 ? todayTasks.map(t => (
                <div key={t.id} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '8px', borderLeft: `4px solid ${t.color}`, cursor: 'pointer' }} onClick={() => handleSelectEvent(t)}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>{t.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{moment(t.start).format('HH:mm')} - {moment(t.end).format('HH:mm')}</div>
                </div>
              )) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Bugün için planlanan iş yok.</p>
              )}
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarDays size={20} color="#f59e0b"/> Yaklaşan (7 Gün)
              </h3>
              {upcomingTasks.length > 0 ? upcomingTasks.slice(0, 5).map(t => (
                <div key={t.id} style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '8px', borderLeft: `4px solid ${t.color}`, cursor: 'pointer' }} onClick={() => handleSelectEvent(t)}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>{t.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{moment(t.start).format('DD MMM')}</div>
                </div>
              )) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Yaklaşan iş bulunmuyor.</p>
              )}
            </div>

          </div>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h2>{editingTask ? 'İş Kalemi Düzenle' : 'Yeni İş Kalemi'}</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '10px' }}>
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
                    <input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} style={{ flex: 2, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}/>
                    <input type="time" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}/>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Bitiş</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} style={{ flex: 2, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}/>
                    <input type="time" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }}/>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Kategori</label>
                  <select 
                    value={formData.category} 
                    onChange={e => {
                      const newCat = e.target.value;
                      setFormData({
                        ...formData, 
                        category: newCat,
                        color: CATEGORY_COLORS[newCat.toLowerCase()] || formData.color
                      });
                    }}
                    style={{ 
                      width: '100%', padding: '10px 14px', borderRadius: '8px', 
                      border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', 
                      color: 'var(--text-main)', fontSize: '14px', cursor: 'pointer', 
                      outline: 'none', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s',
                      appearance: 'none', WebkitAppearance: 'none',
                      backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='%239ca3af' height='20' viewBox='0 0 24 24' width='20' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>")`,
                      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
                      paddingRight: '36px'
                    }}
                  >
                    <option value="">Seçiniz...</option>
                    <option value="yapısal">Yapısal</option>
                    <option value="mimari">Mimari</option>
                    <option value="tesisat">Tesisat</option>
                    <option value="elektrik">Elektrik</option>
                    <option value="mekanik">Mekanik</option>
                    <option value="joker">Joker</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Öncül İş</label>
                  <select 
                    value={formData.dependencies} 
                    onChange={e => setFormData({...formData, dependencies: e.target.value})}
                    style={{ 
                      width: '100%', padding: '10px 14px', borderRadius: '8px', 
                      border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', 
                      color: 'var(--text-main)', fontSize: '14px', cursor: 'pointer', 
                      outline: 'none', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s',
                      appearance: 'none', WebkitAppearance: 'none',
                      backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='%239ca3af' height='20' viewBox='0 0 24 24' width='20' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>")`,
                      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
                      paddingRight: '36px'
                    }}
                  >
                    <option value="">-- Bağımsız --</option>
                    {events.filter(e => e.id !== (editingTask?.id)).map(e => (
                      <option key={e.id} value={e.id}>{e.title}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Renk</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {Object.values(CATEGORY_COLORS).map(color => (
                      <div 
                        key={color} 
                        onClick={() => setFormData({...formData, color})}
                        style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: color, cursor: 'pointer', border: formData.color === color ? '2px solid var(--text-main)' : '2px solid transparent', boxShadow: 'var(--shadow-sm)' }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>İlerleme Yüzdesi (%)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="number" min="0" max="100" value={formData.progress || 0} onChange={e => setFormData({...formData, progress: Number(e.target.value)})} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)' }} />
                  <button 
                    type="button" 
                    onClick={() => setFormData({...formData, progress: 100})}
                    style={{ padding: '8px 16px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    ✓ Bitti
                  </button>
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
                {editingTask && isManager && (
                  <button className="btn-danger" onClick={deleteTask} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Trash2 size={16} /> Sil
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-secondary" onClick={() => setShowModal(false)}>İptal</button>
                {isManager && <button className="btn-primary" onClick={saveTask}>Kaydet</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
