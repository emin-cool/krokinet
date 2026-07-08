// Tek kaynak kategori / pin taksonomisi — MOBİL uygulamayla BİREBİR paylaşılır.
// (insaat-app-mobile/src/utils/categories.js ile aynı liste tutulmalıdır.)
//
// Pin'ler, iş programı görevleri ve çalışan ilgi grupları AYNI listeyi kullanır.
// Token (key) büyük harf Türkçe'dir; eşleştirme her zaman normCat ile harf-duyarsız
// yapılır; böylece eski küçük harf değerler ('yapısal' vb.) de doğru eşleşir.

export const CATEGORIES = [
  { key: 'MİMARİ',   color: '#8b5cf6' },
  { key: 'YAPISAL',  color: '#0891b2' },
  { key: 'ELEKTRİK', color: '#f59e0b' },
  { key: 'TESİSAT',  color: '#3b82f6' },
  { key: 'MEKANİK',  color: '#7c3aed' },
  { key: 'ZEMİN',    color: '#92400e' },
  { key: 'ÇATI',     color: '#64748b' },
  { key: 'İNŞAAT',   color: '#ef4444' },
  { key: 'GENEL',    color: '#10b981' },
];

// Kategori key listesi (UI döngüleri için kısayol)
export const CATEGORY_KEYS = CATEGORIES.map(c => c.key);

// Türkçe-duyarlı normalize: "elektrik" ↔ "ELEKTRİK", "yapısal" ↔ "YAPISAL"
export function normCat(s) {
  return (s || '').toString().trim().toLocaleUpperCase('tr');
}

// key → renk (eski küçük harf değerler toLocaleUpperCase ile aranır)
export function colorFor(key) {
  const norm = normCat(key);
  return CATEGORIES.find(c => c.key === norm)?.color || '#64748b';
}

// İki kategori değeri (harf/format farkı olsa da) aynı mı?
export function catEquals(a, b) {
  return normCat(a) === normCat(b);
}

// ── Pin durumları — MOBİL kaynak değerleri: OPEN / RESOLVED ──
export const PIN_STATUS = { OPEN: 'OPEN', RESOLVED: 'RESOLVED' };

// Eski web değerlerini ('açık' / 'çözüldü' / 'devam ediyor') kanonik değere çevirir.
// Bilinmeyen / boş değerler OPEN kabul edilir.
export function normStatus(s) {
  const v = (s || '').toString().trim().toLocaleLowerCase('tr');
  if (v === 'resolved' || v === 'çözüldü' || v === 'cozuldu' || v === 'tamamlandı' || v === 'tamamlandi') {
    return PIN_STATUS.RESOLVED;
  }
  return PIN_STATUS.OPEN; // açık, devam ediyor, open, '' → açık
}

export function isResolved(s) {
  return normStatus(s) === PIN_STATUS.RESOLVED;
}

export const STATUS_LABEL = { OPEN: 'Açık', RESOLVED: 'Çözüldü' };
export const STATUS_COLOR = { OPEN: '#ef4444', RESOLVED: '#22c55e' };
