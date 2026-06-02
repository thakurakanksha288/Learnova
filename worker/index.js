import { processSyncQueue } from "../services/syncQueue";

let csrfTokenCache = null; // { token: string, fetchedAt: number }
let csrfTokenPromise = null;
const CSRF_TOKEN_TTL_MS = 6 * 24 * 60 * 60 * 1000; // 6 days (1 day before cookie expiry)

function isUnsafeMethod(method) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes((method || "GET").toUpperCase());
}

function clearCsrfCache() {
  csrfTokenCache = null;
}

function isSameOriginApiUrl(url) {
  try {
    const parsedUrl = new URL(url, self.location.origin);
    return parsedUrl.origin === self.location.origin && parsedUrl.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

async function getCsrfToken() {
  if (csrfTokenCache) {
    // Check if cached token has expired (6 days TTL)
    if (Date.now() - csrfTokenCache.fetchedAt < CSRF_TOKEN_TTL_MS) {
      return csrfTokenCache.token;
    }
    // Token expired, clear cache and fetch fresh
    csrfTokenCache = null;
  }

  if (csrfTokenPromise) {
    return csrfTokenPromise;
  }

  csrfTokenPromise = fetch("/api/auth/csrf", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  })
  .then(async (response) => {
    if (!response.ok) {
      return null;
    }

    const data = await response.json().catch(() => null);
    const csrfToken = data?.csrfToken || null;
    if (csrfToken) {
      csrfTokenCache = { token: csrfToken, fetchedAt: Date.now() };
    }
    return csrfToken;
  })
    .catch(() => null)
    .finally(() => { csrfTokenPromise = null; });

  return csrfTokenPromise;
}

async function swFetchWithCsrf(url, options = {}) {
  const method = options.method || "GET";
  const headers = new Headers(options.headers || {});
  
  if (isUnsafeMethod(method) && isSameOriginApiUrl(url)) {
    if (!headers.has("x-csrf-token") && !headers.has("X-CSRF-Token")) {
      const token = await getCsrfToken();
      if (token) headers.set("X-CSRF-Token", token);
    }
  }
  
  return fetch(url, { ...options, headers });
}

async function handleSync() {
  const clients = await self.clients.matchAll();
  clients.forEach(c => c.postMessage({ type: "SYNC_PENDING_ACTIONS_START" }));
  
  const result = await processSyncQueue(swFetchWithCsrf);
  
  clients.forEach(c => c.postMessage({ 
    type: "SYNC_PENDING_ACTIONS_COMPLETE", 
    successCount: result.successCount, 
    failCount: result.failCount 
  }));
}

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-pending-actions") {
    event.waitUntil(handleSync().catch(err => console.error("[SW] Background sync failed:", err)));
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "TRIGGER_SYNC_PENDING_ACTIONS") {
    event.waitUntil(handleSync());
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match("/offline.html");
        return cached || new Response("You are offline", { headers: { "Content-Type": "text/html" } });
      })
    );
  }
});
