import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function PWAInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (standalone) setInstalled(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') setPromptEvent(null);
      return;
    }
    if (isIos) setShowIosHelp((value) => !value);
  }

  if (!promptEvent && !isIos) return null;

  return (
    <div className="pwa-install">
      <button className="btn secondary" type="button" onClick={() => void install()}>
        📲 ติดตั้งแอป
      </button>
      {showIosHelp && (
        <div className="pwa-install-help">
          iPhone/iPad: กดปุ่มแชร์ใน Safari → “เพิ่มไปยังหน้าจอโฮม”
        </div>
      )}
    </div>
  );
}
