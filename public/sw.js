// Service Worker for Nelson-GPT PWA
const CACHE_NAME = 'nelson-gpt-v1.0.0';
const STATIC_CACHE = 'nelson-gpt-static-v1.0.0';

// Files to cache for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/api\/nelson/,
  /\/api\/memory/,
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Nelson-GPT SW: Install event');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('Nelson-GPT SW: Caching static files');
      return cache.addAll(STATIC_FILES);
    })
  );
  
  // Skip waiting and immediately take control
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('Nelson-GPT SW: Activate event');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
            console.log('Nelson-GPT SW: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch event - handle requests with cache strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }
  
  // Handle different types of requests
  if (request.destination === 'document') {
    // HTML documents - Network First with cache fallback
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache
          return caches.match(request)
            .then((response) => {
              return response || caches.match('/index.html');
            });
        })
    );
  } else if (request.destination === 'script' || request.destination === 'style') {
    // JS/CSS - Cache First
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
  } else if (API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    // API requests - Network First with cache fallback
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
  }
});

// Background sync for offline functionality
self.addEventListener('sync', (event) => {
  console.log('Nelson-GPT SW: Background sync', event.tag);
  
  if (event.tag === 'nelson-gpt-sync') {
    event.waitUntil(
      // Handle offline queue here
      syncOfflineActions()
    );
  }
});

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('Nelson-GPT SW: Push received', event);
  
  const options = {
    body: event.data ? event.data.text() : 'New medical update available',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Open Nelson-GPT',
        icon: '/icons/icon-96.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Nelson-GPT', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('Nelson-GPT SW: Notification click', event);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});

// Helper function for syncing offline actions
async function syncOfflineActions() {
  try {
    // Get offline actions from IndexedDB
    const offlineActions = await getOfflineActions();
    
    for (const action of offlineActions) {
      try {
        // Attempt to sync the action
        await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: action.body
        });
        
        // Remove from offline queue on success
        await removeOfflineAction(action.id);
      } catch (error) {
        console.log('Failed to sync action:', action.id, error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// IndexedDB helpers (simplified)
async function getOfflineActions() {
  // In a real implementation, this would use IndexedDB
  return [];
}

async function removeOfflineAction(id) {
  // In a real implementation, this would remove from IndexedDB
  return true;
}

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  console.log('Nelson-GPT SW: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});