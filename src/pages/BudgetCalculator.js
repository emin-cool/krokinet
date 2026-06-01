/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MATERIALS } from '../utils/constants';

export default function BudgetCalculator() {
  const [livePrices, setLivePrices] = useState(null);
  const [budgetItems, setBudgetItems] = useState([]);
  const [newBudgetItem, setNewBudgetItem] = useState({ materialId: MATERIALS[0].id, quantity: 1 });
  const [reportName, setReportName] = useState('Genel Keşif Raporu');

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/market-prices/refresh`, { method: 'POST' })
      .then(res => res.json())
      .then(data => setLivePrices(data.data.materials))
      .catch(err => console.error("Fiyatlar çekilemedi", err));
  }, []);

  function addBudgetItem() {
    if (!newBudgetItem.quantity || newBudgetItem.quantity <= 0) return;
    const material = MATERIALS.find(m => m.id === newBudgetItem.materialId);
    const newItem = { id: Date.now().toString(), materialId: material.id, name: material.name, unit: material.unit, quantity: Number(newBudgetItem.quantity) };
    setBudgetItems([...budgetItems, newItem]);
    setNewBudgetItem({ materialId: MATERIALS[0].id, quantity: 1 });
  }

  function removeBudgetItem(id) {
    setBudgetItems(budgetItems.filter(item => item.id !== id));
  }

  function exportPDF() {
    const doc = new jsPDF();
    doc.text(reportName, 14, 15);
    doc.setFontSize(10);
    doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 22);

    const tableColumn = ["Malzeme", "Miktar", "Birim Fiyat (TL)", "Toplam (TL)"];
    const tableRows = [];
    let grandTotal = 0;

    budgetItems.forEach(item => {
      const price = livePrices ? livePrices[item.materialId] : 0;
      const total = price * item.quantity;
      grandTotal += total;
      tableRows.push([
        item.name,
        `${item.quantity} ${item.unit}`,
        price.toLocaleString('tr-TR', { minimumFractionDigits: 2 }),
        total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })
      ]);
    });

    tableRows.push(["", "", "GENEL TOPLAM:", grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
    });
    doc.save(`${reportName.replace(/\\s+/g, '_')}.pdf`);
  }

  return (
    <div className="budget-view" style={{ padding: '20px', backgroundColor: 'var(--bg-main)', minHeight: '80vh', color: 'var(--text-main)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
        <div>
          <h2 style={{ marginBottom: '10px' }}>💰 Canlı Keşif ve Bütçe Hesaplayıcı</h2>
          <input 
            type="text" 
            value={reportName} 
            onChange={(e) => setReportName(e.target.value)} 
            className="price-input"
            style={{ width: '300px', padding: '10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-main)', borderRadius: '4px', border: '1px solid var(--border-color)' }}
            placeholder="Rapor Adı (Örn: XYZ Projesi Keşfi)"
          />
        </div>
        <button className="btn-primary" onClick={exportPDF} disabled={!livePrices || budgetItems.length === 0}>📄 PDF Olarak İndir</button>
      </div>

      {!livePrices ? (
        <div className="loading">Canlı piyasa fiyatları yükleniyor...</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'flex-end', backgroundColor: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px' }}>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Malzeme</label>
              <select 
                className="price-input" 
                value={newBudgetItem.materialId} 
                onChange={e => setNewBudgetItem({...newBudgetItem, materialId: e.target.value})}
                style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                {MATERIALS.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.name} ({m.unit})</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Miktar</label>
              <input 
                type="number" 
                min="1"
                className="price-input" 
                value={newBudgetItem.quantity} 
                onChange={e => setNewBudgetItem({...newBudgetItem, quantity: e.target.value})}
                style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
            </div>
            <button className="btn-primary" onClick={addBudgetItem} style={{ height: '40px' }}>Ekle</button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>Malzeme</th>
                <th style={{ padding: '12px' }}>Miktar</th>
                <th style={{ padding: '12px' }}>Canlı Birim Fiyat (₺)</th>
                <th style={{ padding: '12px' }}>Toplam (₺)</th>
                <th style={{ padding: '12px' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {budgetItems.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Henüz keşif kalemi eklenmemiş.</td></tr>
              ) : (
                budgetItems.map(item => {
                  const price = livePrices[item.materialId] || 0;
                  const total = price * item.quantity;
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px' }}>{item.name}</td>
                      <td style={{ padding: '12px' }}>{item.quantity} {item.unit}</td>
                      <td style={{ padding: '12px' }}>₺ {price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '12px', color: 'var(--primary-color)', fontWeight: 'bold' }}>₺ {total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '12px' }}>
                        <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} onClick={() => removeBudgetItem(item.id)}>Sil</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {budgetItems.length > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: 'rgba(255, 171, 0, 0.1)' }}>
                  <td colSpan="3" style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold' }}>GENEL TOPLAM:</td>
                  <td colSpan="2" style={{ padding: '15px', fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '18px' }}>
                    ₺ {budgetItems.reduce((acc, item) => acc + ((livePrices[item.materialId] || 0) * item.quantity), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </>
      )}
    </div>
  );
}
