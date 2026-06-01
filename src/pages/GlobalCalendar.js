/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/tr';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Trash2 } from 'lucide-react';

moment.locale('tr');
const localizer = momentLocalizer(moment);

const EVENT_COLORS = [
  { label: 'Mavi (Genel)', value: '#3b82f6' },
  { label: 'Kırmızı (Acil/Önemli)', value: '#ef4444' },
  { label: 'Yeşil (Tamamlandı)', value: '#22c55e' },
  { label: 'Turuncu (Toplantı)', value: '#f97316' },
  { label: 'Mor (Tasarım/Mimari)', value: '#8b5cf6' },
];

export default function GlobalCalendar() {
  const { userData, currentUser } = useAuth();
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
    color: '#3b82f6',
    description: ''
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
          createdBy: data.createdBy
        };
      });
      setEvents(loadedEvents);
      setLoading(false);
    }, (error) => {
      console.error("Takvim verileri çekilirken hata oluştu:", error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleSelectSlot = ({ start, end }) => {
    if (!userData?.isSuperAdmin) return;
    
    // Set up form with selected dates
    const startDate = moment(start).format('YYYY-MM-DD');
    const endDate = moment(end).format('YYYY-MM-DD');
    // Default to 1-hour block if it's the same day and no time selected
    const startTime = moment(start).format('HH:mm') === '00:00' ? '09:00' : moment(start).format('HH:mm');
    const endTime = moment(end).format('HH:mm') === '00:00' ? '10:00' : moment(end).format('HH:mm');

    setEditingEvent(null);
    setFormData({
      title: '',
      startDate,
      startTime,
      endDate: moment(end).isSame(start, 'day') ? endDate : moment(end).subtract(1, 'days').format('YYYY-MM-DD'), // react-big-calendar end is exclusive
      endTime,
      color: '#3b82f6',
      description: ''
    });
    setShowModal(true);
  };

  const handleSelectEvent = (event) => {
    if (!userData?.isSuperAdmin) return;
    setEditingEvent(event);
    setFormData({
      title: event.title,
      startDate: moment(event.start).format('YYYY-MM-DD'),
      startTime: moment(event.start).format('HH:mm'),
      endDate: moment(event.end).format('YYYY-MM-DD'),
      endTime: moment(event.end).format('HH:mm'),
      color: event.color,
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
      createdBy: currentUser.uid,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingEvent) {
        await updateDoc(doc(db, 'calendar_events', editingEvent.id), eventData);
      } else {
        await addDoc(collection(db, 'calendar_events'), {
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
    if (window.confirm("Bu etkinliği silmek istediğinize emin misiniz?")) {
      try {
        await deleteDoc(doc(db, 'calendar_events', editingEvent.id));
        setShowModal(false);
      } catch (err) {
        console.error("Silinemedi:", err);
      }
    }
  };

  const eventStyleGetter = (event) => {
    return {
      style: {
        backgroundColor: event.color,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: '0',
        display: 'block'
      }
    };
  };

  if (loading) return <div className="loading">Takvim yükleniyor...</div>;

  return (
    <div style={{ padding: '24px', background: 'var(--bg-main)', minHeight: 'calc(100vh - 120px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>📅 İş Programı / Takvim</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>Genel şantiye takvimi ve iş programı.</p>
        </div>
        {userData?.isSuperAdmin && (
          <button className="btn-primary" onClick={() => handleSelectSlot({ start: new Date(), end: new Date() })}>
            ➕ Yeni Etkinlik
          </button>
        )}
      </div>

      <div style={{ height: '75vh', background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%', color: 'var(--text-main)' }}
          selectable={userData?.isSuperAdmin}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventStyleGetter}
          messages={{
            next: "İleri",
            previous: "Geri",
            today: "Bugün",
            month: "Ay",
            week: "Hafta",
            day: "Gün",
            agenda: "Ajanda",
            date: "Tarih",
            time: "Saat",
            event: "Etkinlik",
            noEventsInRange: "Bu aralıkta etkinlik yok."
          }}
          popup
        />
      </div>

      {showModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal">
            <h2>{editingEvent ? 'Etkinliği Düzenle' : 'Yeni Etkinlik'}</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Etkinlik Başlığı</label>
                <input 
                  placeholder="Başlık girin..." 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Başlangıç</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="date" 
                      value={formData.startDate} 
                      onChange={e => setFormData({...formData, startDate: e.target.value})} 
                      style={{ flex: 2 }}
                    />
                    <input 
                      type="time" 
                      value={formData.startTime} 
                      onChange={e => setFormData({...formData, startTime: e.target.value})} 
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Bitiş</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="date" 
                      value={formData.endDate} 
                      onChange={e => setFormData({...formData, endDate: e.target.value})} 
                      style={{ flex: 2 }}
                    />
                    <input 
                      type="time" 
                      value={formData.endTime} 
                      onChange={e => setFormData({...formData, endTime: e.target.value})} 
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Etkinlik Rengi</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {EVENT_COLORS.map(c => (
                    <button 
                      key={c.value}
                      onClick={() => setFormData({...formData, color: c.value})}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '20px',
                        border: formData.color === c.value ? '2px solid var(--text-main)' : '2px solid transparent',
                        backgroundColor: c.value,
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 4, color: 'var(--text-muted)' }}>Açıklama (İsteğe bağlı)</label>
                <textarea 
                  placeholder="Detaylı açıklama..." 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  style={{ width: '100%', minHeight: '80px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-main)', resize: 'vertical' }}
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
