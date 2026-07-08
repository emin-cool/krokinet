// Kategori / pin taksonomisi MOBİL ile paylaşılan tek kaynaktan gelir (./categories.js).
import { CATEGORIES, STATUS_COLOR } from './categories';

export const MATERIALS = [
  { id: 'bakir', name: 'Bakır', unit: 'kg', category: 'metal', emoji: '🔶' },
  { id: 'aluminyum', name: 'Alüminyum', unit: 'kg', category: 'metal', emoji: '⬜' },
  { id: 'insaat-demiri', name: 'İnşaat Demiri', unit: 'ton', category: 'metal', emoji: '⚙️' },
  { id: 'celik-profil', name: 'Çelik Profil', unit: 'ton', category: 'metal', emoji: '🔩' },
  { id: 'hazir-beton', name: 'Hazır Beton C25', unit: 'm³', category: 'yapi', emoji: '🧱' },
  { id: 'cimento', name: 'Çimento (50kg)', unit: 'çuval', category: 'yapi', emoji: '🏗️' },
  { id: 'kum', name: 'Kum', unit: 'm³', category: 'yapi', emoji: '🟡' },
  { id: 'cakil', name: 'Çakıl', unit: 'm³', category: 'yapi', emoji: '⚫' },
  { id: 'kereste', name: 'Kereste', unit: 'm³', category: 'ahsap', emoji: '🪵' },
  { id: 'pvc-boru', name: 'PVC Boru (100mm)', unit: 'm', category: 'tesisat', emoji: '🔵' },
  { id: 'demir-boru', name: 'Demir Boru', unit: 'm', category: 'tesisat', emoji: '⬛' },
  { id: 'cam', name: 'Cam (4mm)', unit: 'm²', category: 'yapi', emoji: '🪟' },
];

export const SECTIONS = [
  { key: 'metal', title: '⚙️ Metaller' },
  { key: 'yapi', title: '🧱 Yapı Malzemeleri' },
  { key: 'ahsap', title: '🪵 Ahşap' },
  { key: 'tesisat', title: '🔵 Tesisat' },
];

// ── Kategori / pin taksonomisi artık MOBİL ile paylaşılan tek kaynaktan gelir ──
// (bkz. ./categories.js). Aşağıdaki eski dışa aktarımlar YALNIZCA geriye dönük
// uyum içindir; yeni kod doğrudan colorFor()/normCat()/isResolved() kullanmalı.

// Ortak taksonomi yardımcılarını buradan da erişilebilir kıl (tek import noktası)
export {
  CATEGORIES, CATEGORY_KEYS, normCat, colorFor, catEquals,
  PIN_STATUS, normStatus, isResolved, STATUS_LABEL, STATUS_COLOR,
} from './categories';

// Geriye dönük uyum: eski kod CATEGORY_COLORS[key] ile erişiyor. Hem kanonik
// (büyük harf) hem eski (küçük harf) anahtarları içerecek şekilde türetilir.
export const CATEGORY_COLORS = CATEGORIES.reduce((acc, c) => {
  acc[c.key] = c.color;
  acc[c.key.toLocaleLowerCase('tr')] = c.color;
  return acc;
}, { joker: '#ec4899' }); // 'joker': mobilde yok, eski web verisinde kalmış olabilir

// Geriye dönük uyum: eski pin durum → renk eşlemesi (hem eski hem kanonik).
export const PIN_COLORS = {
  'açık': STATUS_COLOR.OPEN,
  'devam ediyor': '#f59e0b',
  'çözüldü': STATUS_COLOR.RESOLVED,
  OPEN: STATUS_COLOR.OPEN,
  RESOLVED: STATUS_COLOR.RESOLVED,
};

// Strong password generator — Y1 fix
export function generateStrongPassword(length = 14) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (v) => chars[v % chars.length]).join('');
}

// Unique ID generator — O21, D20 fix
export function generateUniqueId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}
