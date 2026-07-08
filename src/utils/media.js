// Mesaj eki (medya) yardımcıları — web/mobil ortak şema.
// MOBİL kaynak: mesajlarda `url` alanı + `type` ∈ {'text','image','file','voice'}.
// Eski WEB mesajları `fileUrl` alanı + `type` = MIME (örn. 'image/jpeg') kullanıyordu;
// bu yardımcılar her iki formatı da doğru okur.

// Ekin URL'i (yeni `url`, eski `fileUrl`)
export function msgUrl(m) {
  return (m && (m.url || m.fileUrl)) || null;
}

// Mesaj bir görsel mi? (yeni type==='image', eski MIME 'image/*', ya da uzantı)
export function isImageMsg(m) {
  if (!m) return false;
  if (m.type === 'image') return true;
  if (typeof m.type === 'string' && m.type.startsWith('image/')) return true;
  const u = msgUrl(m);
  return !!u && /\.(jpe?g|png|webp|gif|heic|bmp|svg)(\?|$)/i.test(u);
}

// Ekli (dosya/görsel) mesaj mı?
export function hasAttachment(m) {
  return !!msgUrl(m);
}

// Yükleme için kanonik tip: görselse 'image', değilse 'file'
export function attachmentType(fileOrMime) {
  const mime = typeof fileOrMime === 'string' ? fileOrMime : (fileOrMime?.type || '');
  return mime.startsWith('image/') ? 'image' : 'file';
}
