// Ekip/çalışan hesap işlemleri — MOBİL `teamAuth.js` ile aynı veri modeli.
// Çalışanlar `users` + `publicProfiles` dokümanı olarak açılır; proje üyeliği
// proje dokümanındaki memberIds / memberRoles / memberMeta üzerinden tutulur
// (eski `groups` koleksiyonu ARTIK KULLANILMAZ).
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth, getAuth, inMemoryPersistence,
  createUserWithEmailAndPassword, signOut,
} from 'firebase/auth';
import {
  doc, setDoc, updateDoc, arrayUnion, serverTimestamp,
  collection, query, where, getDocs, deleteField,
} from 'firebase/firestore';
import { db, auth, firebaseConfig } from '../firebase';

// Çalışan e-postaları bu alan adıyla üretilir; giriş ekranı kullanıcı adının
// sonuna bunu ekler. MOBİL ile AYNI olmalı (çapraz giriş için).
export const EMAIL_DOMAIN = 'santi.app';

// Eski web sürümünde çalışanlar @insaat-app.com ile açılıyordu; giriş ekranı
// geriye dönük uyum için bu alan adını da dener.
export const LEGACY_EMAIL_DOMAIN = 'insaat-app.com';

// Türkçe karakterleri sadeleştirip birleşik kullanıcı adı üretir: "Abdullah Emin" → "abdullahemin"
export function slugifyName(s) {
  const map = { ç:'c', ğ:'g', ı:'i', i:'i', İ:'i', ö:'o', ş:'s', ü:'u' };
  return (s || '')
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, m => map[m.toLowerCase()] || m)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Kullanıcı adı çakışmasını çözer: abdullahemin → abdullahemin2 → ...
async function uniqueUsername(base) {
  let candidate = base;
  let n = 1;
  while (n < 100) {
    // publicProfiles'tan sorgula: users artık yalnızca sahibi tarafından okunabilir
    const snap = await getDocs(query(collection(db, 'publicProfiles'), where('username', '==', candidate)));
    if (snap.empty) return candidate;
    n += 1;
    candidate = `${base}${n}`;
  }
  return `${base}${Date.now().toString().slice(-4)}`;
}

// İkincil Firebase app: yöneticinin oturumunu bozmadan hesap açar
function getSecondaryAuth() {
  const existing = getApps().find(a => a.name === 'Secondary');
  const secApp = existing || initializeApp(firebaseConfig, 'Secondary');
  try {
    return initializeAuth(secApp, { persistence: inMemoryPersistence });
  } catch {
    return getAuth(secApp);
  }
}

async function writePublicProfile(uid, fields) {
  try {
    await setDoc(doc(db, 'publicProfiles', uid), fields, { merge: true });
  } catch (e) {
    console.warn('publicProfiles yazılamadı:', e.message);
  }
}

/**
 * Yeni çalışan hesabı oluşturur. Yöneticinin oturumu kapanmaz (ikincil app).
 * MOBİL createWorkerAccount ile aynı yazımlar.
 */
export async function createWorkerAccount({
  projectId, name, surname, mahlas, title, role, groups, password,
}) {
  const base = slugifyName(`${name}${surname}`);
  if (!base) throw new Error('Geçerli bir ad soyad girin.');
  if (!password || password.length < 6) throw new Error('Şifre en az 6 karakter olmalı.');

  const username = await uniqueUsername(base);
  const email = `${username}@${EMAIL_DOMAIN}`;

  const secAuth = getSecondaryAuth();
  const cred = await createUserWithEmailAndPassword(secAuth, email, password);
  const uid = cred.user.uid;

  const fullName = `${name} ${surname}`.trim();

  await setDoc(doc(db, 'users', uid), {
    name: fullName,
    email,
    username,
    mahlas: mahlas || '',
    role,
    mustChangePassword: true,
    createdAt: serverTimestamp(),
  });

  await writePublicProfile(uid, { name: fullName, mahlas: mahlas || '', role, username, profilePic: '' });

  await updateDoc(doc(db, 'projects', projectId), {
    memberIds: arrayUnion(uid),
    [`memberRoles.${uid}`]: role,
    [`memberMeta.${uid}`]: {
      mahlas: mahlas || '',
      title: title || '',
      groups: groups || [],
      username,
    },
    defaultMemberPassword: deleteField(), // eski düz-metin ortak şifreyi temizle
  });

  try { await signOut(secAuth); } catch {}

  return { uid, username, email };
}

/**
 * Mevcut çalışanın proje-içi bilgilerini günceller (kullanıcı adı sabit kalır).
 */
export async function updateWorkerMeta({ projectId, uid, mahlas, title, role, groups }) {
  await updateDoc(doc(db, 'projects', projectId), {
    [`memberRoles.${uid}`]: role,
    [`memberMeta.${uid}.mahlas`]: mahlas || '',
    [`memberMeta.${uid}.title`]: title || '',
    [`memberMeta.${uid}.groups`]: groups || [],
  });
  try {
    await updateDoc(doc(db, 'users', uid), { mahlas: mahlas || '' });
  } catch {}
  await writePublicProfile(uid, { mahlas: mahlas || '' });
}
