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

// Centralized category colors — D19, K7 fix
export const CATEGORY_COLORS = {
  'yapısal': '#ef4444',
  'elektrik': '#eab308',
  'tesisat': '#22c55e',
  'mekanik': '#f97316',
  'mimari': '#a855f7',
  'joker': '#ec4899',
  'genel': '#3b82f6',
};

export const PIN_COLORS = {
  'açık': '#ef4444',
  'devam ediyor': '#f59e0b',
  'çözüldü': '#22c55e',
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
