import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { RefreshCw, DollarSign, Euro, Circle, Square, Triangle, Download, Search, Settings } from 'lucide-react';
import NotificationsDropdown from '../components/NotificationsDropdown';

export default function MarketPrices() {
  const { userData } = useAuth();
  const [calculator, setCalculator] = useState({ material: 'Bakır (kg)', amount: 0 });
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString('tr-TR'));

  const refreshData = () => {
    setLastUpdate(new Date().toLocaleTimeString('tr-TR'));
  };

  const calculateTotal = () => {
    if (calculator.amount <= 0) return '₺0.00';
    let price = 0;
    if (calculator.material.includes('Bakır')) price = 384.21;
    if (calculator.material.includes('Demiri')) price = 27.12;
    if (calculator.material.includes('Beton')) price = 2938.08;
    return `₺${(calculator.amount * price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="market-page" style={{ padding: '32px 40px', height: '100%', overflowY: 'auto' }}>
      
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
            placeholder="Search materials..." 
            style={{ width: '100%', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}
          />
        </div>
      </div>

      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', color: 'var(--primary-color)' }}>
               <DollarSign size={24} />
            </div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em' }}>Piyasa Verileri</h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', maxWidth: '500px' }}>
            Döviz kurları ve inşaat malzeme fiyatları anlık küresel verilere göre hesaplanmaktadır. Proje bütçenizi gerçek zamanlı piyasa hareketlerine göre optimize edin.
          </p>
        </div>
        <button className="btn-primary" onClick={refreshData} style={{ borderRadius: '12px', padding: '12px 24px' }}>
          <RefreshCw size={16} style={{ marginRight: '8px' }} /> Canlı Verileri Yenile
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Döviz Kurları */}
          <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={20} color="var(--text-muted)" />
                <h3 style={{ margin: 0, fontSize: '16px' }}>Döviz Kurları</h3>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
                <div>SON GÜNCELLEME:</div>
                <div style={{ fontWeight: 600 }}>{lastUpdate}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#e0e7ff', color: '#4f46e5', fontWeight: 700, fontSize: '12px', padding: '4px 8px', borderRadius: '6px' }}>US</div>
                  <span style={{ fontWeight: 600 }}>USD / TRY</span>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--primary-color)' }}>₺34.04</div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#e0e7ff', color: '#4f46e5', fontWeight: 700, fontSize: '12px', padding: '4px 8px', borderRadius: '6px' }}>EU</div>
                  <span style={{ fontWeight: 600 }}>EUR / TRY</span>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--primary-color)' }}>₺37.50</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#e0f2fe', color: '#0284c7', fontWeight: 700, fontSize: '12px', padding: '4px 8px', borderRadius: '6px' }}>€$</div>
                  <span style={{ fontWeight: 600 }}>EUR / USD</span>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--primary-color)' }}>$1.1021</div>
              </div>
            </div>
          </div>

          {/* Calculator */}
          <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <Square size={20} color="#b45309" />
              <h3 style={{ margin: 0, fontSize: '16px' }}>Hızlı Maliyet Hesaplayıcı</h3>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Malzeme Seçin</label>
              <select 
                value={calculator.material}
                onChange={e => setCalculator({...calculator, material: e.target.value})}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}
              >
                <option>Bakır (kg)</option>
                <option>İnşaat Demiri (ton)</option>
                <option>Hazır Beton (m³)</option>
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Miktar</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input 
                  type="number" 
                  value={calculator.amount}
                  onChange={e => setCalculator({...calculator, amount: Number(e.target.value)})}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}
                />
                <button className="btn-primary" style={{ borderRadius: '8px', padding: '0 24px' }}>Ekle</button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: '1px solid var(--border-color)', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Tahmini Toplam</span>
              <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary-color)' }}>{calculateTotal()}</span>
            </div>

            <button style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--primary-color)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
              <Download size={16} /> PDF Olarak İndir
            </button>
          </div>

        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Metaller */}
          <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <Settings size={20} color="var(--text-muted)" />
              <h3 style={{ margin: 0, fontSize: '16px' }}>Metaller</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '8px', background: '#fffbeb', color: '#d97706', borderRadius: '8px' }}><Circle size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 600 }}>Bakır / kg</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
                    Küresel Ortalama<br/><span style={{ fontWeight: 600 }}>$8.35 | €7.18</span>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--primary-color)', fontSize: '16px' }}>₺384,21</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '8px', background: '#f5f3ff', color: '#8b5cf6', borderRadius: '8px' }}><Square size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 600 }}>Alüminyum / kg</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
                    <span style={{ fontWeight: 600 }}>$2.36 | €2.03</span>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--primary-color)', fontSize: '16px' }}>₺108,48</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '8px', background: '#eff6ff', color: '#3b82f6', borderRadius: '8px' }}><Triangle size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 600 }}>İnşaat Demiri / ton</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
                    <span style={{ fontWeight: 600 }}>$589.13 | €506.97</span>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--primary-color)', fontSize: '16px' }}>₺27.120,76</div>
                </div>
              </div>
            </div>
          </div>

          {/* Yapı Malzemeleri */}
          <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
              <Settings size={20} color="var(--text-muted)" />
              <h3 style={{ margin: 0, fontSize: '16px' }}>Yapı Malzemeleri</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '8px', background: '#fee2e2', color: '#ef4444', borderRadius: '8px' }}><Square size={20} /></div>
                  <div style={{ fontWeight: 600 }}>Hazır Beton C25 / m³</div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--primary-color)', fontSize: '16px' }}>₺2.938,08</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '8px', background: '#fef3c7', color: '#f59e0b', borderRadius: '8px' }}><Circle size={20} /></div>
                  <div style={{ fontWeight: 600 }}>Kum / m³</div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--primary-color)', fontSize: '16px' }}>₺542,42</div>
              </div>
              
              {/* Trend Analizi Chart Placeholder */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>
                  <span>Fiyat Trend Analizi (Son 30 Gün)</span>
                  <span style={{ color: 'var(--primary-color)' }}>Trend: +4.2%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px' }}>
                  {[30, 40, 35, 50, 45, 60, 55, 70, 80].map((h, i) => (
                    <div key={i} style={{ flex: 1, background: i === 8 ? 'var(--primary-color)' : 'rgba(99, 102, 241, 0.3)', height: `${h}%`, borderRadius: '4px 4px 0 0' }}></div>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}