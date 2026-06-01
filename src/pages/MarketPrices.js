import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { MATERIALS, SECTIONS } from '../utils/constants';

// Base USD prices for simulation (realistic approximate market values)
const MATERIALS_BASE_USD = {
  'bakir': 8.50,          // $8.50 / kg
  'aluminyum': 2.40,      // $2.40 / kg
  'insaat-demiri': 600,   // $600 / ton
  'celik-profil': 750,    // $750 / ton
  'hazir-beton': 65,      // $65 / m³
  'cimento': 5.50,        // $5.50 / çuval
  'kum': 12,              // $12 / m³
  'cakil': 14,            // $14 / m³
  'kereste': 250,         // $250 / m³
  'pvc-boru': 4.20,       // $4.20 / m
  'demir-boru': 15,       // $15 / m
  'cam': 18               // $18 / m²
};

export default function MarketPrices() {
  const [rates, setRates] = useState({ usd_try: null, eur_try: null, usd_eur: null });
  const [materials, setMaterials] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [calcMaterial, setCalcMaterial] = useState(MATERIALS[0].id);
  const [calcQuantity, setCalcQuantity] = useState(1);

  useEffect(() => {
    fetchLiveMarketData();
  }, []);

  async function fetchLiveMarketData() {
    setLoading(true);
    try {
      // Node.js Backend API'sine (Scraper Servisi) istek at
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/market-prices/refresh`, {
        method: 'POST'
      });
      const result = await res.json();
      
      if (result.success && result.data) {
        setRates(result.data.rates);
        setMaterials(result.data.materials);
        setLastUpdate(new Date(result.data.lastUpdated));
      } else {
        throw new Error("Backend veri sağlayamadı.");
      }
    } catch (err) {
      console.error('Piyasa verileri çekilemedi:', err);
      alert("Piyasa verileri güncellenirken sunucuya erişilemedi. Lütfen Backend (Node.js) sunucusunun çalıştığından emin olun.");
    }
    setLoading(false);
  }

  function toUSD(priceTRY) {
    if (!priceTRY || !rates.usd_try) return null;
    return (priceTRY / rates.usd_try).toFixed(2);
  }

  function toEUR(priceTRY) {
    if (!priceTRY || !rates.eur_try) return null;
    return (priceTRY / rates.eur_try).toFixed(2);
  }

  return (
    <div className="market-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>📈 Piyasa Verileri</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Döviz kurları ve inşaat malzeme fiyatları anlık küresel verilere göre hesaplanmaktadır.</p>
        </div>
        <button className="btn-primary" onClick={fetchLiveMarketData} disabled={loading} style={{ padding: '12px 20px' }}>
          {loading ? 'Güncelleniyor...' : '🔄 Canlı Verileri Yenile'}
        </button>
      </div>

      {loading && !lastUpdate ? (
        <div className="loading">Piyasa verileri yükleniyor...</div>
      ) : (
        <>
          {/* Döviz Kurları */}
          <div className="market-section">
            <div className="market-section-header">
              <h2>💱 Döviz Kurları</h2>
              {lastUpdate && <span className="market-note">Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')}</span>}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 20 }}>🇺🇸</span><span style={{ fontSize: 14, fontWeight: 600 }}>USD / TRY</span></div>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-color)' }}>{rates.usd_try ? `₺${rates.usd_try.toFixed(2)}` : '—'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 20 }}>🇪🇺</span><span style={{ fontSize: 14, fontWeight: 600 }}>EUR / TRY</span></div>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-color)' }}>{rates.eur_try ? `₺${rates.eur_try.toFixed(2)}` : '—'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 20 }}>💶</span><span style={{ fontSize: 14, fontWeight: 600 }}>EUR / USD</span></div>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-color)' }}>{rates.usd_eur ? `$${(1 / rates.usd_eur).toFixed(4)}` : '—'}</span>
              </div>
            </div>
          </div>

          {/* Hızlı Hesaplayıcı */}
          <div className="market-section" style={{ backgroundColor: 'rgba(255, 171, 0, 0.05)', border: '1px solid rgba(255, 171, 0, 0.2)' }}>
            <div className="market-section-header">
              <h2>🧮 Hızlı Maliyet Hesaplayıcı</h2>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: '16px' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Malzeme Seçin</label>
                <select 
                  value={calcMaterial} 
                  onChange={e => setCalcMaterial(e.target.value)}
                  style={{ width: '100%', padding: '12px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none' }}
                >
                  {MATERIALS.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.name} ({m.unit})</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Miktar</label>
                <input 
                  type="number" 
                  value={calcQuantity} 
                  onChange={e => setCalcQuantity(Number(e.target.value) || 0)}
                  min="0"
                  style={{ width: '100%', padding: '12px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none' }}
                />
              </div>
              <div style={{ flex: '2 1 300px', backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Toplam Maliyet</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                    ₺{materials[calcMaterial] ? (materials[calcMaterial] * calcQuantity).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                    $ {toUSD(materials[calcMaterial] ? materials[calcMaterial] * calcQuantity : 0)}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                    € {toEUR(materials[calcMaterial] ? materials[calcMaterial] * calcQuantity : 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Malzeme Fiyatları */}
          {SECTIONS.map(section => {
            const sectionMaterials = MATERIALS.filter(m => m.category === section.key);
            return (
              <div key={section.key} className="market-section">
                <div className="market-section-header">
                  <h2>{section.title}</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {sectionMaterials.map(material => {
                    const data = materials[material.id];
                    const price = data;
                    return (
                      <div key={material.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                          <span style={{ fontSize: 20 }}>{material.emoji}</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>{material.name}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/ {material.unit}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                          {price ? (
                            <>
                              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary-color)' }}>₺{Number(price).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{toUSD(price) && `$ ${toUSD(price)}`}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{toEUR(price) && `€ ${toEUR(price)}`}</span>
                            </>
                          ) : (
                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}