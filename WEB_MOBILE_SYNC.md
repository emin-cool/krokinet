# Web ↔ Mobil Senkronizasyon Yol Haritası

İki uygulama (`insaat-app` = web, `insaat-app-mobile` = Expo/React Native) **aynı
Firebase projesine** bağlıdır: `insaat-app-70b06`. Ortak bir Firestore veritabanı
ve **tek bir güvenlik kuralı seti** paylaşırlar. Bu yüzden ikisinin veri modeli
uyumlu olmak zorundadır.

**Karar (2026):** Mobil sürüm daha yeni ve güvenli olduğu için **kaynak model =
mobil**. Web, mobilin modeline taşınır. Web ŞU AN CANLIDIR; bu yüzden:

> ⚠️ **`firebase deploy --only firestore:rules` en son ve yalnızca web kod göçü
> tamamlanıp test edildikten sonra çalıştırılır.** Mobilin katı kurallarını erken
> deploy etmek canlı web'i kırar (web'in kullandığı `files`, `groups`,
> `calendar_events`, `personal_calendar_events` koleksiyonları kurallarda tanımsız
> = reddedilir; `users` okuması sahibe kısıtlanır).

Web **kaynak kodu** değişiklikleri, siz web'i yeniden derleyip yayınlayana kadar
canlıyı ETKİLEMEZ. Kurallar deploy'u ise anında etkiler.

---

## Tespit edilen ayrışmalar

| Konu | Web (eski) | Mobil (kaynak) |
|---|---|---|
| Güvenlik kuralları | Gevşek (herkes çoğu şeyi okur/yazar) | Katı, ayrıntılı (yetki yükseltme engelleri) |
| Kullanıcı verisi | Her şey `users`, herkese okuma açık | `publicProfiles` (açık) + `users` (gizli) ayrımı |
| Ekip grupları | `groups` koleksiyonu | Proje içinde `memberMeta[uid].groups` + `memberRoles` |
| Dosyalar | `files` koleksiyonu | Proje içinde `projectFiles`/`folders` + `messages` |
| Takvim/plan | `calendar_events` + `personal_calendar_events` | `workSchedules` |
| Mesajlar | `projectId` bazlı | `pinId` + `projectId` bazlı |
| Pin kategorisi | küçük harf (`yapısal`), farklı set (`joker`) | BÜYÜK harf (`YAPISAL`), `ZEMİN/ÇATI/İNŞAAT` |
| Pin durumu | `açık` / `çözüldü` | `OPEN` / `RESOLVED` |
| Cloudinary | PinDetailModal `dfl7x5dud`, ProjectDetail `dcx4qribb` | tek hesap |

---

## Aşamalar

### ✅ Aşama 1 — Ortak kategori + pin durum taksonomisi (TAMAMLANDI)
- Yeni `src/utils/categories.js` (mobil `categories.js` ile birebir) + pin durum
  yardımcıları (`PIN_STATUS`, `normStatus`, `isResolved`).
- `constants.js` artık taksonomiyi buradan türetir; `CATEGORY_COLORS`/`PIN_COLORS`
  geriye dönük uyum için hem büyük hem küçük harf anahtar içerir.
- Güncellenen dosyalar: `ProjectDetail.js`, `PinDetailModal.js`, `ProjectSchedule.js`,
  `TaskBoard.js`, `TaskCard.js`.
- Web artık pin'i `status: 'OPEN'` + BÜYÜK harf kategori olarak YAZAR; durum/kategori
  okumaları eski değerlerle de uyumludur (`normCat` / `isResolved`).

### ✅ Aşama 2 — `users` → `publicProfiles` ayrımı (TAMAMLANDI)
- `AuthContext.js`: giriş-anı `publicProfiles` senkronizasyonu (mobil ile birebir) —
  mevcut kullanıcılar için otomatik geri-dolum (backfill).
- `Profile.js`: isim değişince `publicProfiles.name` de güncellenir.
- `PinDetailModal.js`: etiketleme (mention) listesi `publicProfiles`'tan okunur.
- `ProjectDetail.js`: assignee araması `publicProfiles`'tan yapılır.
- `ProjectTeam.js` / `TeamManagement.js`: hesap oluşturmada `publicProfiles` de yazılır,
  çıkarmada silinir (additive; kullanıcı-listesi OKUMALARI Aşama 3'te düzeltilecek).

> ⚠️ **Aşama 6 için kritik uyum notu:** Katı kurallarda `publicProfiles`/`users`
> OLUŞTURMA yetkisi, işlemi yapanın GLOBAL `users.role == 'manager'` (veya superadmin)
> olmasına bağlı (`isManagerSelf()`). Web'de "yönetici" kavramı PROJE-bazlı
> (`project.managerId` / `memberRoles[uid]=='manager'`), kullanıcının global `role`
> alanı farklı olabilir (grup adı, 'Yönetici' vb.). Kurallar deploy edilmeden ÖNCE
> web yöneticilerinin global `role`'ü mobil ile hizalanmalı (Aşama 3 kapsamında).

### ✅ Aşama 3 — `groups` → `memberMeta` modeli (TAMAMLANDI)
- Yeni `src/utils/teamAuth.js` (mobil `teamAuth.js` çalışan fonksiyonlarının portu):
  `createWorkerAccount` / `updateWorkerMeta` — `users` + `publicProfiles` + proje
  `memberIds`/`memberRoles`/`memberMeta` yazar. E-posta alanı `@santi.app` (mobil ile ortak).
- `src/components/ProjectTeam.js` tamamen yeniden yazıldı: üyeler `publicProfiles`'tan
  (memberIds ile), gruplar `memberMeta[uid].groups` (ortak kategori etiketleri),
  ekle/düzenle/çıkar akışı mobil `ProjectTeamTab` + `AddWorkerModal` ile aynı. Global
  `groups` koleksiyonu ve "mevcut kullanıcı ekle" akışı kaldırıldı.
- `src/pages/Login.js`: kullanıcı adı girişinde önce `@santi.app`, bulunamazsa
  `@insaat-app.com` (eski web hesapları) denenir → çapraz-uygulama giriş uyumu.
- **Not:** `src/pages/TeamManagement.js` hiçbir route'a bağlı DEĞİL (ölü kod) ve hâlâ eski
  `groups` modelini kullanıyor. Silinmesi önerilir (kapsam dışı bırakıldı).

> Kalan uyum riski (Aşama 6): Katı kuralda çalışan/profil OLUŞTURMA, işlemi yapanın
> global `users.role == 'manager'` olmasını ister. Web'de yeni çalışanların rolü doğru
> yazılıyor; ancak MEVCUT web yöneticilerinin global `role` alanı `'manager'` değilse,
> kural deploy'undan önce düzeltilmeli.

### ✅ Aşama 4 — `files` koleksiyonu + mesaj/pin şeması (TAMAMLANDI)
- Yeni `src/utils/media.js`: mesaj eki yardımcıları. Yeni/mobil `url` + `type`
  ('image'|'file'|'voice'|'text') VE eski web `fileUrl` + MIME formatını birlikte okur.
- `PinDetailModal.js`: ayrı `files` koleksiyonu KALDIRILDI. Pin ekleri (sohbet + "dosya")
  artık `messages`'a `url` + kanonik `type` ile yazılıyor (mobil ile aynı). Medya sekmesi
  ve sohbet görselleri `messages`'tan okunuyor; eski `fileUrl` mesajları da görünür.
- `ProjectGallery.js`: `url`/`fileUrl` ikisini de gösterir → mobilde yüklenen medya web'de görünür.
- `ProjectDetail.js`: kat planı silme cascade'inden `files` koleksiyonu sorgusu çıkarıldı.
- Proje-seviyesi dosyalar (`project.projectFiles`) web ve mobilde ZATEN aynı → değişiklik yok.
- Kurallarla uyum doğrulandı: mesaj create `userId == auth.uid`, pin create `createdBy == auth.uid`.

> Not: Cloudinary hesabı hâlâ tutarsız (web PinDetailModal `dfl7x5dud`, ProjectDetail
> `dcx4qribb`, mobil ayrı). URL'ler mutlak olduğu için çapraz görüntüleme ÇALIŞIR; yalnızca
> operasyonel dağınıklık. İstenirse tek hesaba indirilebilir (fonksiyonel engel değil).

### ✅ Aşama 5 — Takvim koleksiyonları (TAMAMLANDI — coexistence yaklaşımı)
**Karar:** `calendar_events` ve `personal_calendar_events` WEB'E ÖZGÜ (mobil hiç kullanmıyor;
mobil `workSchedules` kullanır — ayrı bir özellik). Web'in çalışan takvimini mobilin
modeline zorlamak yerine, ikisi aynı DB'de YAN YANA yaşar. Yapılanlar:
- `GlobalCalendar.js`: tüm `projects`'i dinlemek yerine yalnızca kullanıcının projeleri
  (üye + yönetici sorguları). Katı kural kapsamsız koleksiyon sorgusunu reddettiği için şart.
- `Projects.js` zaten kullanıcı-kapsamlı (`memberIds` array-contains / superadmin) — değişiklik yok.
- Aşama 6 kuralları: `calendar_events` → giriş-yapmış herkes (mevcut paylaşımlı davranış,
  regresyon yok); `personal_calendar_events` → sahibe kısıtlı (userId == auth.uid).
- `ProjectSchedule.js` çapraz-kullanıcı takvim senkronu zaten try/catch içinde → sahibe
  kısıtlı kural altında sessizce no-op olur, çekirdek görev kaydı etkilenmez.
- `workSchedules` (mobil) zaten katı kurallarda tanımlı; web bunu kullanmıyor.

### ✅ Aşama 6 — Birleşik `firestore.rules` (DEPLOY EDİLDİ)
**Durum (2026-07):** Canlıda ZATEN katı kurallar yürürlükteymiş. Deploy edilen birleşik
kuralın canlıdan TEK farkı iki ekleyici blok (`calendar_events` + `personal_calendar_events`)
olduğu API ile doğrulandı → risksiz. Migration gerekmedi (dry-run 0 değişiklik). Kurallar
`firebase deploy --only firestore:rules` ile yayınlandı; aktif ruleset `efd3d44f-...`.
Doğrulandı: iki takvim koleksiyonu canlıda, diğer tüm katı kurallar korunuyor.

**TEK KALAN ADIM:** Web'i Aşama 1–5 kod değişiklikleriyle yeniden yayınlayın (build + host).

---
#### (Referans) Hazırlık notları
- Birleşik kural yazıldı ve **iki repoda da BİREBİR AYNI**: `insaat-app/firestore.rules`
  ve `insaat-app-mobile/firestore.rules`. Mobilin katı kuralları + iki web koleksiyonu:
  `calendar_events` (giriş-yapmış herkes, paylaşımlı) ve `personal_calendar_events` (sahibe kısıtlı).
- Yapısal doğrulama tamam (parantez 34/34, 10 match bloğu).

> ⛔ **DEPLOY ETMEDİM. Canlı web'i etkileyeceği için yalnızca siz onaylayınca yapılmalı.**

**Deploy ÖNCESİ zorunlu kontrol listesi:**
1. **Web yöneticilerinin global rolü:** Katı kuralda çalışan/profil oluşturma
   `users.role == 'manager'` (veya superadmin) ister. Tek seferlik migration betiği
   HAZIR: `insaat-app-mobile/functions/migrate-manager-roles.js`. Herhangi bir projede
   yönetici olan herkesin global `role`'ünü 'manager' yapar (+ eksikse publicProfiles).
   Çalıştırma (functions/ klasöründen, admin kimliğiyle):
   `node migrate-manager-roles.js` (dry-run) → `node migrate-manager-roles.js --apply`.
   Bu adım kural deploy'undan ÖNCE yapılmalı (aksi halde web'de "Yeni Çalışan" reddedilir).
2. **publicProfiles geri-dolumu:** Aşama 2 ile her girişte otomatik dolar; yine de
   yalnızca-web kullanıcıları için bir kerelik toplu dolum düşünülebilir.
3. **Emülatör testleri:** `insaat-app-mobile/firestore-tests` süitini GÜNCEL birleşik
   kural dosyasıyla çalıştırın (JDK 21). Yeni iki koleksiyon için test eklemek iyi olur.
4. **Deploy komutu:** `firebase deploy --only firestore:rules`
   (proje: `insaat-app-70b06`).
5. Deploy sonrası: web'i yeni build ile yayınlayın (Aşama 1–5 kod değişiklikleri).

---

## Notlar
- Piyasa fiyatları (web `MarketPrices.js`, mobil `MarketScreen.js`) zaten büyük ölçüde
  uyumlu: ikisi de sabit `MATERIALS_DATA` + `exchangerate-api`. Web `backend/scraper.js`
  bağlı değil (atıl).
- Cloudinary hesap tutarsızlığı (Aşama 4 ile birlikte tek hesaba indirilmeli).
