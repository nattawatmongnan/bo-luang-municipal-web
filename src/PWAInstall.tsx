import { useEffect, useMemo, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function detectDevice() {
  const ua = navigator.userAgent.toLowerCase();
  const ios = /iphone|ipad|ipod/.test(ua);
  const android = /android/.test(ua);
  const safari = ios && /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
  return { ios, android, safari };
}

export default function PWAInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [status, setStatus] = useState('');
  const device = useMemo(() => detectDevice(), []);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator &&
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

    setInstalled(standalone);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setStatus('');
    };

    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setShowHelp(false);
      setStatus('ติดตั้งแอปเรียบร้อยแล้ว');
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (installed) return;

    if (promptEvent) {
      setStatus('กำลังเปิดหน้าติดตั้ง…');
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setStatus('กำลังติดตั้งแอป…');
        setPromptEvent(null);
      } else {
        setStatus('ยกเลิกการติดตั้งแล้ว คุณสามารถกดติดตั้งใหม่ภายหลังได้');
      }
      return;
    }

    setShowHelp(true);
    setStatus('');
  }

  const helpText = device.ios
    ? device.safari
      ? 'iPhone/iPad: กดปุ่มแชร์ใน Safari → “เพิ่มไปยังหน้าจอโฮม”'
      : 'iPhone/iPad: เปิดเว็บนี้ด้วย Safari → กดแชร์ → “เพิ่มไปยังหน้าจอโฮม”'
    : device.android
      ? 'Android: เปิดด้วย Chrome → เมนู ⋮ → “ติดตั้งแอป” หรือ “เพิ่มไปยังหน้าจอหลัก”'
      : 'หากเบราว์เซอร์ไม่แสดงหน้าติดตั้งอัตโนมัติ ให้เปิดเมนูของเบราว์เซอร์แล้วเลือก “ติดตั้งแอป” หรือ “เพิ่มไปยังหน้าจอหลัก”';

  return (
    <div className="pwa-install" aria-live="polite">
      {installed ? (
        <span className="pwa-installed">✓ แอปนี้ติดตั้งแล้ว</span>
      ) : (
        <button className="btn secondary" type="button" onClick={() => void install()}>
          📲 ติดตั้งแอป
        </button>
      )}
      {status && <div className="pwa-install-status">{status}</div>}
      {showHelp && !installed && <div className="pwa-install-help">{helpText}</div>}
    </div>
  );
}
