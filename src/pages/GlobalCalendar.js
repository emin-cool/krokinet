/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'moment/locale/tr';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Trash2, CalendarDays, Clock, AlertCircle } from 'lucide-react';

moment.locale('tr');
const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

export default function GlobalCalendar() {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    startDate: '',
    startTime: '09:00',
    endDate: '',
    endTime: '10:00',
    color: '#a855f7',
    description: ''
  });

  useEffect(() => {
    if (!currentUser) return;
    
    // Yalnızca kullanıcının kendi kişisel randevuları/notları
    const q = query(
      collection(db, 'personal_calendar_events'),
      where('userId', '==', currentUser.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const loadedEvents = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          start: data.start?.toDate ? data.start.toDate() : new Date(data.start),
          end: data.end?.toDate ? data.end.toDate() : new Date(data.end),
          color: data.color || '#a855f7',
          description: data.description || '',
          userId: data.userId
        };
      });
      setEvents(loadedEvents);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser]);

  // --- Drag & Drop Handlers ---
  const moveEvent = async ({ event, start, end, isAllDay: droppedOnAllDaySlot = false }) => {
    try {
      await updateDoc(doc(db, 'personal_calendar_events', event.id), {
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: droppedOnAllDaySlot || false
      });
    } catch (err) {
      console.error(err);
      alert('Etkinlik güncellenemedi.');
    }
  };

  const resizeEvent = async ({ event, start, end }) => {
    try {
      await updateDoc(doc(db, 'personal_calendar_events', event.id), {
        start: start.toISOString(),
        end: end.toISOString()
      });
    } catch (err) {
      console.error(err);
      alert('Etkinlik güncellenemedi.');
    }
  };

  // --- Normal CRUD Handlers ---
  const handleSelectSlot = ({ start, end }) => {
    const startDate = moment(start).format('YYYY-MM-DD');
    const endDate = moment(end).format('YYYY-MM-DD');
    const startTime = moment(start).format('HH:mm') === '00:00' ? '09:00' : moment(start).format('HH:mm');
    const endTime = moment(end).format('HH:mm') === '00:00' ? '10:00' : moment(end).format('HH:mm');

    setEditingEvent(null);
    setFormData({
      title: '', startDate, startTime,
      endDate: moment(end).isSame(start, 'day') ? endDate : moment(end).subtract(1, 'days').format('YYYY-MM-DD'),
      endTime, color: '#a855f7', description: ''
    });
    setShowModal(true);
  };

  const handleSelectEvent = (event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      startDate: moment(event.start).format('YYYY-MM-DD'),
      startTime: moment(event.start).format('HH:mm'),
      endDate: moment(event.end).format('YYYY-MM-DD'),
      endTime: moment(event.end).format('HH:mm'),
      color: event.color || '#a855f7',
      description: event.description || ''
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
      userId: currentUser.uid,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingEvent) {
        await updateDoc(doc(db, 'personal_calendar_events', editingEvent.id), eventData);
      } else {
        await addDoc(collection(db, 'personal_calendar_events'), {
          ...eventData,
          createdAt: new Date().toISOString()
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
    if (window.confirm("Bu notu silmek istediğinize emin misiniz?")) {
      try {
        await deleteDoc(doc(db, 'personal_calendar_events', editingEvent.id));
        setShowModal(false);
      } catch (err) {
        console.error("Silinemedi:", err);
      }
    }
  };

  const eventStyleGetter = (event) => ({
    style: {
      backgroundColor: event.color,
      borderRadius: '6px',
      opacity: 0.9,
      color: 'white',
      border: '0',
      display: 'block',
      padding: '2px 6px'
    }
  });

  if (loading) return <div className="loading">Takvim yükleniyor...</div>;

  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
  const upcomingTasks = events.filter(e => e.start >= todayStart && e.start <= new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000)).sort((a,b) => a.start - b.start);
  const todayTasks = events.filter(e => e.start <= todayEnd && e.end >= todayStart);

  return (
    <div style={{ padding: '24px', background: 'var(--bg-main)', minHeight: 'calc(100vh - 120px)' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CalendarDays size={32} color="var(--primary-color)"/> Kişisel Takvim & Notlar
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>Yöneticinin özel hatırlatıcıları, toplantıları ve randevuları.</p>
        </div>
        
        <div>
          <button className="btn-primary" onClick={() => handleSelectSlot({ start: new Date(), end: new Date() })} style={{ padding: '10px 16px' }}>
            ➕ Yeni Etkinlik / Not
          </button>
        </div>
      </div>

      {/* GRID LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Calendar */}
        <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', height: '70vh', overflow: 'hidden', gridColumn: 'span 3' }}>
          <DnDCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%', color: 'var(--text-main)' }}
            selectable={true}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            onEventDrop={moveEvent}
            onEventResize={resizeEvent}
            resizable={true}
            eventPropGetter={eventStyleGetter}
            messages={{ next: "İleri", previous: "Geri", today: "Bugün", month: "Ay", week: "Hafta", day: "Gün", agenda: "Ajanda" }}
            popup
          />
        </div>

        {/* RIGHT COLUMN: Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', gridColumn: 'span 1' }}>
          <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} color="var(--primary-color)"/> Bugün
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
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h2>{editingEvent ? 'Notu Düzenle' : 'Yeni Not/Randevu'}</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Başlık</label>
                <input 
                  placeholder="Toplantı, Malzeme Alımı vb." 
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
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Etkinlik Rengi</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {['#3b82f6', '#ef4444', '#f59e0b', '#22c55e', '#a855f7', '#ec4899', '#6366f1', '#14b8a6'].map(color => (
                    <div 
                      key={color} 
                      onClick={() => setFormData({...formData, color})}
                      style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: color, cursor: 'pointer', border: formData.color === color ? '3px solid var(--text-main)' : '2px solid transparent', boxShadow: 'var(--shadow-sm)' }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Açıklama (Opsiyonel)</label>
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
