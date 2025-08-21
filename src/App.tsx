import { useEffect } from 'react';
import ChatInterface from '@/components/ChatInterface';

export default function App() {
  useEffect(() => {
    // Register service worker for PWA functionality
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Nelson-GPT SW registered: ', registration);
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New content available, reload
                    if (confirm('New version available! Reload to update?')) {
                      window.location.reload();
                    }
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.log('Nelson-GPT SW registration failed: ', error);
          });
      });
    }

    // Handle install prompt
    let deferredPrompt: any;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      
      // Show install banner after 30 seconds
      setTimeout(() => {
        if (deferredPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
          const installBanner = document.createElement('div');
          installBanner.innerHTML = `
            <div style="
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              background: #2563eb;
              color: white;
              padding: 12px;
              text-align: center;
              z-index: 1000;
              font-family: system-ui;
            ">
              <span>Install Nelson-GPT for a better experience!</span>
              <button id="install-btn" style="
                background: white;
                color: #2563eb;
                border: none;
                padding: 4px 12px;
                border-radius: 4px;
                margin-left: 10px;
                cursor: pointer;
              ">Install</button>
              <button id="dismiss-btn" style="
                background: transparent;
                color: white;
                border: 1px solid white;
                padding: 4px 12px;
                border-radius: 4px;
                margin-left: 10px;
                cursor: pointer;
              ">Later</button>
            </div>
          `;
          
          document.body.appendChild(installBanner);
          
          document.getElementById('install-btn')?.addEventListener('click', () => {
            if (deferredPrompt) {
              deferredPrompt.prompt();
              deferredPrompt.userChoice.then(() => {
                deferredPrompt = null;
                installBanner.remove();
              });
            }
          });
          
          document.getElementById('dismiss-btn')?.addEventListener('click', () => {
            installBanner.remove();
          });
        }
      }, 30000);
    });
  }, []);

  return (
    <div className="h-screen bg-background">
      <ChatInterface />
    </div>
  );
}
