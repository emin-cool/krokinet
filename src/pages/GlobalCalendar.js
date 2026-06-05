import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, ChevronRight, Video, MapPin, AlertTriangle } from 'lucide-react';

export default function GlobalCalendar() {
  const { userData } = useAuth();
  const [currentDate] = useState(new Date(2023, 9, 25)); // Hardcoded to match screenshot "October 25, 2023"

  const team = [
    { name: 'Marco Rossi', status: 'online', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=100' },
    { name: 'Sarah Jenkins', status: 'away', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100' },
    { name: 'David Chen', status: 'online', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=100' }
  ];

  return (
    <div className="calendar-page" style={{ padding: '32px 40px', height: '100%', overflowY: 'auto' }}>
      
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
            {userData?.name ? userData.name.charAt(0).toUpperCase() : 'P'}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px' }}>{userData?.name || 'Project Alpha'}</h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Site Manager</p>
          </div>
        </div>

        <div className="search-bar" style={{ position: 'relative', width: '300px' }}>
          <input 
            type="text" 
            placeholder="Search tasks, blueprints, team..." 
            style={{ width: '100%', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '32px' }}>
        
        {/* Left Column: Mini Calendar & Team */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Mini Calendar Card */}
          <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>October 2023</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}><ChevronLeft size={16} /></button>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}><ChevronRight size={16} /></button>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', fontWeight: 600 }}>
              <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', fontSize: '13px', fontWeight: 500 }}>
              {/* Dummy Calendar Grid for October 2023 */}
              <div style={{ color: 'var(--text-muted)' }}>24</div>
              <div style={{ color: 'var(--text-muted)' }}>25</div>
              <div style={{ color: 'var(--text-muted)' }}>26</div>
              <div style={{ color: 'var(--text-muted)' }}>27</div>
              <div style={{ color: 'var(--text-muted)' }}>28</div>
              <div style={{ color: 'var(--text-muted)' }}>29</div>
              <div style={{ color: 'var(--text-muted)' }}>30</div>
              
              {[...Array(23)].map((_, i) => <div key={i} style={{ padding: '4px' }}>{i + 1}</div>)}
              <div style={{ padding: '4px' }}>24</div>
              <div style={{ padding: '4px', background: 'var(--primary-color)', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 'auto' }}>25</div>
              {[...Array(6)].map((_, i) => <div key={i} style={{ padding: '4px' }}>{i + 26}</div>)}
            </div>
          </div>

          {/* Team Availability */}
          <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', flex: 1 }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>TEAM AVAILABILITY</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {team.map((member, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={member.avatar} alt={member.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{member.name}</span>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: member.status === 'online' ? '#22c55e' : '#eab308' }}></div>
                </div>
              ))}
            </div>
          </div>
          
        </div>

        {/* Right Column: Timeline */}
        <div style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em' }}>Wednesday,<br/>October 25</h1>
              <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>3 Tasks Scheduled Today</p>
            </div>
            <div style={{ display: 'flex', background: 'var(--bg-main)', borderRadius: '20px', padding: '4px' }}>
              <button style={{ padding: '6px 16px', border: 'none', borderRadius: '16px', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}>Week</button>
              <button style={{ padding: '6px 16px', border: 'none', borderRadius: '16px', background: 'var(--bg-surface)', color: 'var(--primary-color)', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>Month</button>
            </div>
          </div>

          {/* Timeline Items */}
          <div style={{ position: 'relative', paddingLeft: '40px' }}>
            {/* Vertical Line */}
            <div style={{ position: 'absolute', left: '11px', top: '24px', bottom: '0', width: '2px', background: 'var(--border-color)', zIndex: 0 }}></div>

            {/* Task 1 */}
            <div style={{ position: 'relative', marginBottom: '40px' }}>
              <div style={{ position: 'absolute', left: '-50px', top: '0', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', width: '35px', textAlign: 'right' }}>09:00 AM</div>
              <div style={{ position: 'absolute', left: '-33px', top: '0', width: '12px', height: '12px', borderRadius: '50%', border: '2px solid var(--primary-color)', background: 'var(--bg-surface)', zIndex: 1 }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Site Visit: Downtown Highrise</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    <MapPin size={12} /> 1200 Market Street
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ padding: '4px 8px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary-color)', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Site Inspection</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '150px' }}>
                      <div style={{ height: '4px', flex: 1, background: 'var(--bg-main)', borderRadius: '2px' }}>
                        <div style={{ height: '100%', width: '33%', background: 'var(--primary-color)', borderRadius: '2px' }}></div>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>33% Done</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex' }}>
                   <img src={team[0].avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid white' }} />
                   <img src={team[1].avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid white', marginLeft: '-8px' }} />
                </div>
              </div>
            </div>

            {/* Task 2 */}
            <div style={{ position: 'relative', marginBottom: '40px' }}>
              <div style={{ position: 'absolute', left: '-50px', top: '0', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', width: '35px', textAlign: 'right' }}>01:30 PM</div>
              <div style={{ position: 'absolute', left: '-33px', top: '0', width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #ef4444', background: 'var(--bg-surface)', zIndex: 1 }}></div>
              <div style={{ border: '1px solid #fee2e2', borderRadius: '12px', padding: '16px', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Concrete Pour: Westside Campus</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <MapPin size={12} /> Foundation Sector B
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Supervisor</div>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>Antonio Vega</div>
                  </div>
                </div>
                <div style={{ background: '#fef2f2', border: '1px dashed #fca5a5', padding: '12px', borderRadius: '8px', display: 'flex', gap: '8px', color: '#b91c1c', fontSize: '12px', fontWeight: 500 }}>
                  <AlertTriangle size={16} />
                  Requires secondary pump deployment before 02:00 PM.
                </div>
              </div>
            </div>

            {/* Task 3 */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '-50px', top: '0', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', width: '35px', textAlign: 'right' }}>04:00 PM</div>
              <div style={{ position: 'absolute', left: '-33px', top: '0', width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #f59e0b', background: 'var(--bg-surface)', zIndex: 1 }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                    <Video size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>Client Meeting</h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quarterly Review with Sterling Holdings</div>
                  </div>
                </div>
                <button className="btn-primary" style={{ padding: '8px 24px', borderRadius: '8px' }}>Join Call</button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
