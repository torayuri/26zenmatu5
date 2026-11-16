// 同じサイト内のファイル(index.html等)は「ネット優先」：
//   オンラインなら常に最新版を取得し、オフライン時だけキャッシュを使う。
// 外部CDNのライブラリは「キャッシュ優先」：バージョン固定なので変わらない。
const CACHE = 'tangocho-v2';
const CDN_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      cache.addAll(['./index.html', './manifest.json', './icon.svg']).catch(() => {});
      return Promise.allSettled(CDN_URLS.map(url => cache.add(url)));
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // ネット優先（HTTPキャッシュも迂回して必ずサーバーに確認）
    e.respondWith(
      fetch(req, { cache: 'no-cache' }).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() =>
        caches.match(req, { ignoreSearch: true }).then(c => c || caches.match('./index.html'))
      )
    );
    return;
  }

  if (CDN_URLS.includes(req.url)) {
    // キャッシュ優先
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }))
    );
  }
  // それ以外(Firebase通信など)はSWを通さずそのまま
});
