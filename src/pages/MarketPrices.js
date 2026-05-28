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
            
            <div className="rates-grid">
              <div className="rate-card">
                <div className="rate-top">
                  <span className="rate-flag">🇺🇸</span>
                  <span className="rate-code">USD</span>
                </div>
                <div className="rate-value">{rates.usd_try ? `₺${rates.usd_try.toFixed(2)}` : '—'}</div>
                <div className="rate-label">Amerikan Doları</div>
              </div>
              <div className="rate-card">
                <div className="rate-top">
                  <span className="rate-flag">🇪🇺</span>
                  <span className="rate-code">EUR</span>
                </div>
                <div className="rate-value">{rates.eur_try ? `₺${rates.eur_try.toFixed(2)}` : '—'}</div>
                <div className="rate-label">Euro</div>
              </div>
              <div className="rate-card">
                <div className="rate-top">
                  <span className="rate-flag">💶</span>
                  <span className="rate-code">EUR/USD</span>
                </div>
                <div className="rate-value">{rates.usd_eur ? `$${(1 / rates.usd_eur).toFixed(4)}` : '—'}</div>
                <div className="rate-label">1 Euro kaç Dolar</div>
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
                <div className="materials-grid">
                  {sectionMaterials.map(material => {
                    const data = materials[material.id];
                    const price = data; // Backend doğrudan sayısal değer dönüyor
                    return (
                      <div key={material.id} className="material-card">
                        <div className="material-header">
                          <span className="material-emoji">{material.emoji}</span>
                          <div>
                            <div className="material-name">{material.name}</div>
                            <div className="material-unit">/ {material.unit}</div>
                          </div>
                        </div>

                        <div className="material-prices">
                          {price ? (
                            <>
                              <div className="price-try">₺{Number(price).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                              <div className="price-foreign">
                                {toUSD(price) && <span className="price-usd">$ {toUSD(price)}</span>}
                                {toEUR(price) && <span className="price-eur">€ {toEUR(price)}</span>}
                              </div>
                              <div className="price-by">
                                🤖 {lastUpdate ? `Güncelleme: ${lastUpdate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : 'Sistem (Canlı Kur)'}
                              </div>
                            </>
                          ) : (
                            <div className="price-empty">Fiyat alınamadı</div>
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