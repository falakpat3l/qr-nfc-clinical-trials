/* Service worker: keeps a copy of the app in the browser, so it still opens
   at a bedside or in an animal house with no signal, after one visit online.

   - Pages (HTML) are network-first: you get the newest version when there is
     signal, and the saved copy when there is none or it is too slow.
   - Everything else (scripts, styles, figures) comes from the saved copy at
     once, and is refreshed in the background for next time.
   - Only same-origin GET requests that came back 200 are ever saved.

   When you change any file in docs/, bump VERSION below. That makes every
   browser throw away its old copy and fetch the new files.
   If you add a new file the app needs, add it to FILES too. */
"use strict";

const VERSION = "v1";
const CACHE = "ctde-app-" + VERSION;
const PAGE_TIMEOUT_MS = 4000;   // weak signal: give up on the network after this

const FILES = [
  "./",
  "index.html",
  "app.html",
  "style.css",
  "sw-register.js",
  "codec.js",
  "vendor/qrcode-generator.js",
  "vendor/jsQR.js",
  "app/common.js",
  "app/generate.js",
  "app/scan.js",
  "app/nfc.js",
  "app/benchmark.js",
  "app/log.js",
  "app/main.js",
  "figures/fig1-user-acceptance.svg",
  "figures/fig2-capture-time.svg"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // "reload" skips the browser's own HTTP cache, so the saved copy is fresh.
      return cache.addAll(FILES.map(function (f) { return new Request(f, { cache: "reload" }); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf("ctde-app-") === 0 && k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Saves a response only if it is a normal, complete, same-origin answer.
function keep(request, response) {
  if (response && response.status === 200 && response.type === "basic") {
    const copy = response.clone();
    return caches.open(CACHE).then(function (cache) { return cache.put(request, copy); })
      .catch(function () {});   // storage full: carry on without saving
  }
  return Promise.resolve();
}

function isPage(request) {
  return request.mode === "navigate" ||
         (request.headers.get("accept") || "").indexOf("text/html") !== -1;
}

// Network first, with a time limit. Falls back to the saved copy.
function pageFirst(event) {
  const request = event.request;
  const fromNetwork = fetch(request);
  // Save the fresh page even if the saved copy was shown first.
  event.waitUntil(fromNetwork.then(function (r) { return keep(request, r); })
                             .catch(function () {}));
  const fromCache = function () {
    return caches.match(request, { ignoreSearch: true });
  };
  return new Promise(function (resolve) {
    let done = false;
    const finish = function (r) { if (!done && r) { done = true; resolve(r); } };
    const timer = setTimeout(function () {
      fromCache().then(finish);   // nothing saved yet: keep waiting for the network
    }, PAGE_TIMEOUT_MS);
    fromNetwork.then(function (response) {
      clearTimeout(timer);
      finish(response);
    }).catch(function () {
      clearTimeout(timer);
      fromCache().then(function (hit) { finish(hit || Response.error()); });
    });
  });
}

// Saved copy first, refreshed in the background.
function savedFirst(event) {
  const request = event.request;
  return caches.match(request).then(function (hit) {
    const update = fetch(request).then(function (response) {
      return keep(request, response).then(function () { return response; });
    });
    if (hit) {
      event.waitUntil(update.catch(function () {}));
      return hit;
    }
    return update;
  });
}

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(isPage(request) ? pageFirst(event) : savedFirst(event));
});
