import { useState, useEffect } from 'react';

export interface PWAInstallPrompt {
  prompt: () => Promise<void>;
  outcome: 'accepted' | 'dismissed' | null;
}

export function usePWA() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<PWAInstallPrompt | null>(null);

  useEffect(() => {
    // Check if app is already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSInstalled = (navigator as any).standalone === true;
      setIsInstalled(isStandalone || isIOSInstalled);
    };

    checkInstalled();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkInstalled);

    // Handle install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const customEvent = e as any;
      
      setIsInstallable(true);
      setInstallPrompt({
        prompt: async () => {
          customEvent.prompt();
          const choiceResult = await customEvent.userChoice;
          setInstallPrompt(prev => prev ? {
            ...prev,
            outcome: choiceResult.outcome
          } : null);
          
          if (choiceResult.outcome === 'accepted') {
            setIsInstalled(true);
          }
          setIsInstallable(false);
        },
        outcome: null
      });
    };

    // Handle successful app install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      console.log('Nelson-GPT installed successfully');
    };

    // Handle online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isInstallable,
    isInstalled,
    isOnline,
    installPrompt,
    install: installPrompt?.prompt
  };
}

// Hook for managing offline functionality
export function useOfflineStorage() {
  const [offlineData, setOfflineData] = useState<any[]>([]);
  
  useEffect(() => {
    // Load offline data from IndexedDB or localStorage
    const loadOfflineData = () => {
      try {
        const stored = localStorage.getItem('nelson-gpt-offline');
        if (stored) {
          setOfflineData(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Failed to load offline data:', error);
      }
    };

    loadOfflineData();
  }, []);

  const addOfflineData = (data: any) => {
    const newData = [...offlineData, { ...data, timestamp: Date.now() }];
    setOfflineData(newData);
    localStorage.setItem('nelson-gpt-offline', JSON.stringify(newData));
  };

  const clearOfflineData = () => {
    setOfflineData([]);
    localStorage.removeItem('nelson-gpt-offline');
  };

  return {
    offlineData,
    addOfflineData,
    clearOfflineData
  };
}

// Hook for push notifications
export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('Notification' in window && 'serviceWorker' in navigator);
    if (isSupported) {
      setPermission(Notification.permission);
    }
  }, [isSupported]);

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  };

  const showNotification = (title: string, options?: NotificationOptions) => {
    if (permission !== 'granted') return;

    const notification = new Notification(title, {
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      ...options
    });

    return notification;
  };

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    canNotify: permission === 'granted'
  };
}