const CACHE_NAME = "wanderline-shell-garden-v18-brand-refresh";

const FEELING_FIRST_ASSETS = [
  "style-guide/feeling-first/the-last-tree/thumbnail.webp",
];

const STYLE_GUIDE_THUMBNAILS = [
  "realism",
  "cartoon",
  "architectural",
  "watercolor",
  "anime-environment",
].map((style) => `style-guide/japanese-seaside-town/${style}/thumbnail.png`);

const COASTAL_STAIRWAY_THUMBNAILS = [
  "style-guide/coastal-stairway/base-thumbnail.png",
  ...[
    "realism",
    "cartoon",
    "architectural",
    "watercolor",
    "anime-environment",
  ].map((style) => `style-guide/coastal-stairway/${style}/thumbnail.png`),
];

const ASTRONAUT_THUMBNAILS = [
  "style-guide/astronaut/base-thumbnail.png",
  ...[
    "realism",
    "cartoon",
    "architectural",
    "watercolor",
    "anime-environment",
  ].map((style) => `style-guide/astronaut/${style}/thumbnail.png`),
];

const CAMPER_VAN_THUMBNAILS = [
  "realism",
  "cartoon",
  "architectural",
  "watercolor",
  "anime-environment",
].map((style) => `style-guide/camper-van/${style}/thumbnail.png`);

const BOUQUET_THUMBNAILS = [
  "realism",
  "cartoon",
  "architectural",
  "watercolor",
  "anime-environment",
].map((style) => `style-guide/bouquet/${style}/thumbnail.png`);

function inScope(path) {
  return new URL(path, self.registration.scope).href;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([
      inScope("./"),
      inScope("index.html"),
      inScope("manifest.webmanifest"),
      inScope("icons/drawcoach.svg"),
      inScope("icons/drawcoach-180.png"),
      ...FEELING_FIRST_ASSETS.map(inScope),
      ...STYLE_GUIDE_THUMBNAILS.map(inScope),
      ...COASTAL_STAIRWAY_THUMBNAILS.map(inScope),
      ...ASTRONAUT_THUMBNAILS.map(inScope),
      ...CAMPER_VAN_THUMBNAILS.map(inScope),
      ...BOUQUET_THUMBNAILS.map(inScope),
    ])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const isDevelopmentModule = url.pathname.includes("/src/")
    || url.pathname.includes("/@vite/")
    || url.pathname.includes("/@react-refresh")
    || url.pathname.includes("/node_modules/.vite/");
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.includes("/api/") || url.pathname.includes("/sketches/") || isDevelopmentModule) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match(inScope("index.html"))) || Response.error()));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  })));
});
