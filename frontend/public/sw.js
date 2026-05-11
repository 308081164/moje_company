/* MOJE 轻量 Service Worker：满足 PWA 安装检测，接口走网络不缓存，避免鉴权与数据错乱 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      if (event.request.mode === 'navigate') {
        return new Response(
          '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>离线</title></head><body style="font-family:system-ui;padding:24px;text-align:center"><p>当前无网络，请连接后重试。</p><button onclick="location.reload()">刷新</button></body></html>',
          { headers: { 'Content-Type': 'text/html;charset=UTF-8' } }
        );
      }
      return Response.error();
    })
  );
});
