/* Turns on offline use (sw.js). Service workers only run on a secure page,
   so this only tries over HTTPS or on this computer (localhost). */
"use strict";

(function () {
  const local = ["localhost", "127.0.0.1", "[::1]"].indexOf(location.hostname) !== -1;
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && !local) return;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {
      // Private mode or blocked storage: the app still works, just not offline.
    });
  });
})();
