import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { RefreshCw, DollarSign, Circle, Square, Triangle, Download, Search, Settings } from 'lucide-react';

export default function MarketPrices() {
  const { userData } = useAuth();
  const [calculator, setCalculator] = useState({ material: 'Bakır / kg', amount: 0 });
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString('tr-TR'));
  const [rates, setRates] = useState({ USD_TRY: 35.00, EUR_TRY: 38.00, EUR_USD: 1.08 });
  const [isFetching, setIsFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchExchangeRate = async () => {
    setIsFetching(true);
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await res.json();
      if (data && data.rates && data.rates.TRY && data.rates.EUR) {
        const usd_try = data.rates.TRY;
        const eur_try = usd_try / data.rates.EUR;
        setRates({
          USD_TRY: usd_try,
          EUR_TRY: eur_try,
          EUR_USD: 1 / data.rates.EUR
        });
        setLastUpdate(new Date().toLocaleTimeString('tr-TR'));
      }
    } catch (error) {
      console.error('Döviz kuru alınamadı', error);
    }
    setIsFetching(false);
  };

  useEffect(() => {
    fetchExchangeRate();
  }, []);

  const refreshData = () => {
    fetchExchangeRate();
  };

  const MATERIALS_DATA = {
    'Metaller': [
      { name: 'Bakır / kg', try: 11.85 * rates.USD_TRY, usd: 11.85, eur: 10.90, icon: 'O', color: '#d97706', bg: '#fffbeb' },
      { name: 'Alüminyum / kg', try: 3.85 * rates.USD_TRY, usd: 3.85, eur: 3.55, icon: 'S', color: '#8b5cf6', bg: '#f5f3ff' },
      { name: 'İnşaat Demiri / ton', try: 971.00 * rates.USD_TRY, usd: 971.00, eur: 890.00, icon: 'T', color: '#3b82f6', bg: '#eff6ff' }
    ],
    'Yapı Malzemeleri': [
      { name: 'Hazır Beton C25 / m³', try: 100.00 * rates.USD_TRY, usd: 100.00, icon: 'S', color: '#ef4444', bg: '#fee2e2' },
      { name: 'Hazır Beton C30 / m³', try: 108.00 * rates.USD_TRY, usd: 108.00, icon: 'S', color: '#ef4444', bg: '#fee2e2' },
      { name: 'Kum / m³', try: 21.40 * rates.USD_TRY, usd: 21.40, icon: 'O', color: '#f59e0b', bg: '#fef3c7' },
      { name: 'Çakıl / m³', try: 18.50 * rates.USD_TRY, usd: 18.50, icon: 'O', color: '#f59e0b', bg: '#fef3c7' },
      { name: 'Çimento (50 kg) / adet', try: 15.70 * rates.USD_TRY, usd: 15.70, icon: 'S', color: '#64748b', bg: '#f1f5f9' },
      { name: 'Tuğla (13.5) / 1000 adet', try: 314.00 * rates.USD_TRY, usd: 314.00, icon: 'S', color: '#ea580c', bg: '#ffedd5' },
      { name: 'Gazbeton / m³', try: 91.40 * rates.USD_TRY, usd: 91.40, icon: 'S', color: '#94a3b8', bg: '#f8fafc' },
    ],
    'Ahşap & İzolasyon': [
      { name: 'Çam Kereste / m³', try: 442.80 * rates.USD_TRY, usd: 442.80, icon: 'S', color: '#b45309', bg: '#fef3c7' },
      { name: 'OSB 3 Levha / adet', try: 19.40 * rates.USD_TRY, usd: 19.40, icon: 'S', color: '#b45309', bg: '#fef3c7' },
      { name: 'Plywood / adet', try: 41.40 * rates.USD_TRY, usd: 41.40, icon: 'S', color: '#b45309', bg: '#fef3c7' },
      { name: 'Taşyünü (5cm) / m²', try: 6.00 * rates.USD_TRY, usd: 6.00, icon: 'S', color: '#14b8a6', bg: '#ccfbf1' },
      { name: 'EPS Strafor / m²', try: 4.15 * rates.USD_TRY, usd: 4.15, icon: 'S', color: '#14b8a6', bg: '#ccfbf1' },
      { name: 'Alçıpan / adet', try: 5.30 * rates.USD_TRY, usd: 5.30, icon: 'S', color: '#94a3b8', bg: '#f8fafc' }
    ]
  };

  const calculateTotal = () => {
    if (calculator.amount <= 0) return '₺0.00';
    const selectedMaterial = Object.values(MATERIALS_DATA).flat().find(m => m.name === calculator.material);
    const price = selectedMaterial ? selectedMaterial.try : 0;
    return `₺${(calculator.amount * price).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getIcon = (type) => {
    if (type === 'O') return <Circle size={20} />;
    if (type === 'S') return <Square size={20} />;
    if (type === 'T') return <Triangle size={20} />;
    return <Square size={20} />;
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
          <Search size={18} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search materials..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 16px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}
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
        <button className="btn-primary" onClick={refreshData} disabled={isFetching} style={{ borderRadius: '12px', padding: '12px 24px', opacity: isFetching ? 0.7 : 1 }}>
          <RefreshCw size={16} style={{ marginRight: '8px', animation: isFetching ? 'spin 1s linear infinite' : 'none' }} /> 
          {isFetching ? 'Güncelleniyor...' : 'Canlı Verileri Yenile'}
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
                <div style={{ fontWeight: 700, color: 'var(--primary-color)' }}>₺{rates.USD_TRY.toFixed(2)}</div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#e0e7ff', color: '#4f46e5', fontWeight: 700, fontSize: '12px', padding: '4px 8px', borderRadius: '6px' }}>EU</div>
                  <span style={{ fontWeight: 600 }}>EUR / TRY</span>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--primary-color)' }}>₺{rates.EUR_TRY.toFixed(2)}</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#e0f2fe', color: '#0284c7', fontWeight: 700, fontSize: '12px', padding: '4px 8px', borderRadius: '6px' }}>€$</div>
                  <span style={{ fontWeight: 600 }}>EUR / USD</span>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--primary-color)' }}>${rates.EUR_USD.toFixed(4)}</div>
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
                {Object.values(MATERIALS_DATA).flat().map(m => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
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
          
          {Object.entries(MATERIALS_DATA).map(([category, items]) => {
            const filteredItems = items.filter(item => 
              item.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            
            if (filteredItems.length === 0) return null;

            return (
              <div key={category} style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                  <Settings size={20} color="var(--text-muted)" />
                  <h3 style={{ margin: 0, fontSize: '16px' }}>{category}</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {filteredItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ padding: '8px', background: item.bg, color: item.color, borderRadius: '8px' }}>
                          {getIcon(item.icon)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                        {item.usd && item.eur ? (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
                            <span style={{ fontWeight: 600 }}>${item.usd} | €{item.eur}</span>
                          </div>
                        ) : null}
                        <div style={{ fontWeight: 700, color: 'var(--primary-color)', fontSize: '16px' }}>
                          ₺{item.try.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

        </div>

      </div>
    </div>
  );
}