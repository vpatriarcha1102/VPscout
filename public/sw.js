// Versão do cache — sempre que este arquivo mudar (o número abaixo), o
// navegador troca o service worker e limpa o cache antigo automaticamente.
// Sobe esse número toda vez que publicar uma correção importante, se
// quiser forçar os celulares a pegarem a versão nova imediatamente.
const CACHE = "vpscouts-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Apaga qualquer cache de uma versão anterior — evita ficar servindo
      // HTML/JS velho depois de um novo deploy.
      caches.keys().then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
      self.clients.claim(),
    ])
  );
});

// Estratégia: sempre tenta a rede primeiro (sem usar o cache HTTP do
// navegador, pra garantir que pega o build mais recente do Netlify), só
// cai pro cache local se estiver de fato offline.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
