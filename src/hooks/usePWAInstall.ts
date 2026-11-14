import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isEmbeddedFrame, setIsEmbeddedFrame] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSwFn, setUpdateSwFn] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const checkStandalone = () => {
      const standaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches;
      const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(Boolean(standaloneMedia || iosStandalone));
    };

    checkStandalone();

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    setIsAndroid(/android/.test(ua));

    try {
      setIsEmbeddedFrame(window.self !== window.top);
    } catch {
      setIsEmbeddedFrame(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const mediaQuery = window.matchMedia?.('(display-mode: standalone)');
    const handleDisplayChange = () => checkStandalone();

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery?.addEventListener?.('change', handleDisplayChange);

    // Register Service Worker via vite-plugin-pwa
    try {
      const updateSW = registerSW({
        immediate: true,
        onOfflineReady() {
          setOfflineReady(true);
        },
        onNeedRefresh() {
          setNeedRefresh(true);
        },
        onRegisteredSW(_swUrl, registration) {
          if (registration?.active) {
            setOfflineReady(true);
          }
        }
      });
      setUpdateSwFn(() => updateSW);
    } catch {
      // Service worker unavailable in restricted contexts
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => setOfflineReady(true))
        .catch(() => undefined);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery?.removeEventListener?.('change', handleDisplayChange);
    };
  }, []);

  const install = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return 'accepted';
    }
    return 'dismissed';
  };

  const applyUpdate = async () => {
    if (updateSwFn) {
      await updateSwFn(true);
    }
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    isEmbeddedFrame,
    offlineReady,
    needRefresh,
    install,
    applyUpdate
  };
}
