import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BO_LUANG_BOUNDARY } from './boLuangBoundary';
import { useI18n } from './i18n';

type DeviceState = 'ONLINE' | 'OFFLINE' | 'SOS';

type TimelineItem = {
  id: string;
  at: Date;
  text: string;
};

const ROUTE: [number, number][] = [
  [18.1450, 98.3480],
  [18.1480, 98.3510],
  [18.1510, 98.3540],
  [18.1545, 98.3565],
  [18.1580, 98.3530],
  [18.1600, 98.3490],
  [18.1565, 98.3460],
  [18.1520, 98.3440],
];

const copy = {
  th: {
    title: 'Care Tracker Demo',
    subtitle: 'ระบบจำลองอุปกรณ์ติดตามแบบสายรัดข้อมือ',
    warning: 'โหมดทดลองเท่านั้น — ไม่ได้ติดตามบุคคลจริง และข้อมูลทั้งหมดจะหายเมื่อรีเฟรชหน้า',
    device: 'อุปกรณ์จำลอง',
    wearer: 'บุคคลจำลอง',
    wearerValue: 'DEMO PERSON A',
    battery: 'แบตเตอรี่',
    status: 'สถานะ',
    lastUpdate: 'อัปเดตล่าสุด',
    online: 'ออนไลน์',
    offline: 'ออฟไลน์',
    sos: 'SOS',
    map: 'ตำแหน่งจำลอง',
    timeline: 'เหตุการณ์จำลอง',
    move: '🚶 จำลองการเคลื่อนที่',
    sosButton: '🆘 จำลอง SOS',
    lowBattery: '🔋 จำลองแบตต่ำ',
    toggleOffline: '📡 จำลองออฟไลน์',
    backOnline: '📶 กลับมาออนไลน์',
    reset: '↺ รีเซ็ตการทดลอง',
    moved: 'อุปกรณ์ส่งตำแหน่งจำลองใหม่',
    sosEvent: 'ได้รับสัญญาณ SOS จำลอง',
    batteryEvent: 'แบตเตอรี่จำลองลดลงเหลือ 12%',
    offlineEvent: 'อุปกรณ์จำลองหยุดส่งข้อมูล',
    onlineEvent: 'อุปกรณ์จำลองกลับมาเชื่อมต่อ',
    resetEvent: 'เริ่มการทดลองใหม่',
    noRealData: 'ไม่มีการเชื่อม GPS จริง / SIM / Supabase ในหน้านี้',
  },
  en: {
    title: 'Care Tracker Demo',
    subtitle: 'Simulated wrist-worn tracking device',
    warning: 'DEMO ONLY — no real person is being tracked. All demo data resets when the page reloads.',
    device: 'Demo device',
    wearer: 'Simulated person',
    wearerValue: 'DEMO PERSON A',
    battery: 'Battery',
    status: 'Status',
    lastUpdate: 'Last update',
    online: 'Online',
    offline: 'Offline',
    sos: 'SOS',
    map: 'Simulated location',
    timeline: 'Demo timeline',
    move: '🚶 Simulate movement',
    sosButton: '🆘 Simulate SOS',
    lowBattery: '🔋 Simulate low battery',
    toggleOffline: '📡 Simulate offline',
    backOnline: '📶 Back online',
    reset: '↺ Reset demo',
    moved: 'Demo device sent a new simulated position',
    sosEvent: 'Simulated SOS signal received',
    batteryEvent: 'Simulated battery dropped to 12%',
    offlineEvent: 'Demo device stopped sending data',
    onlineEvent: 'Demo device came back online',
    resetEvent: 'Demo restarted',
    noRealData: 'No real GPS / SIM / Supabase connection is used on this page',
  },
  zh: {
    title: 'Care Tracker Demo',
    subtitle: '腕带式定位设备模拟系统',
    warning: '仅供演示 — 未追踪真实人员。刷新页面后所有模拟数据都会重置。',
    device: '模拟设备',
    wearer: '模拟人员',
    wearerValue: 'DEMO PERSON A',
    battery: '电量',
    status: '状态',
    lastUpdate: '最后更新',
    online: '在线',
    offline: '离线',
    sos: 'SOS',
    map: '模拟位置',
    timeline: '模拟事件记录',
    move: '🚶 模拟移动',
    sosButton: '🆘 模拟 SOS',
    lowBattery: '🔋 模拟低电量',
    toggleOffline: '📡 模拟离线',
    backOnline: '📶 恢复在线',
    reset: '↺ 重置演示',
    moved: '模拟设备发送了新的位置',
    sosEvent: '收到模拟 SOS 信号',
    batteryEvent: '模拟电量降至 12%',
    offlineEvent: '模拟设备停止发送数据',
    onlineEvent: '模拟设备恢复连接',
    resetEvent: '重新开始演示',
    noRealData: '本页面不连接真实 GPS / SIM / Supabase',
  },
} as const;

export default function CareTrackerDemo() {
  const { language, locale } = useI18n();
  const t = copy[language];

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  const [routeIndex, setRouteIndex] = useState(0);
  const [battery, setBattery] = useState(86);
  const [deviceState, setDeviceState] = useState<DeviceState>('ONLINE');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [history, setHistory] = useState<[number, number][]>([ROUTE[0]]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([
    { id: 'start', at: new Date(), text: copy[language].resetEvent },
  ]);

  const currentPoint = ROUTE[routeIndex];

  const stateLabel = useMemo(() => {
    if (deviceState === 'SOS') return t.sos;
    if (deviceState === 'OFFLINE') return t.offline;
    return t.online;
  }, [deviceState, t]);

  function pushEvent(text: string) {
    const now = new Date();
    setLastUpdate(now);
    setTimeline((items) => [
      { id: crypto.randomUUID(), at: now, text },
      ...items,
    ].slice(0, 10));
  }

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;

    const map = L.map(mapEl.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(ROUTE[0], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    L.polygon(BO_LUANG_BOUNDARY, {
      color: '#0f766e',
      weight: 2,
      fillOpacity: 0.04,
    }).addTo(map);

    const icon = L.divIcon({
      className: 'care-demo-marker',
      html: '<div class="care-demo-marker-dot">⌚</div>',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    markerRef.current = L.marker(ROUTE[0], { icon }).addTo(map);
    routeLayerRef.current = L.polyline([ROUTE[0]], {
      color: '#2563eb',
      weight: 4,
      opacity: 0.75,
    }).addTo(map);

    mapRef.current = map;

    window.setTimeout(() => map.invalidateSize(), 80);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    markerRef.current?.setLatLng(currentPoint);
    routeLayerRef.current?.setLatLngs(history);
    mapRef.current?.panTo(currentPoint, { animate: true });
  }, [currentPoint, history]);

  useEffect(() => {
    setTimeline((items) =>
      items.map((item, index) =>
        index === items.length - 1 && item.id === 'start'
          ? { ...item, text: t.resetEvent }
          : item,
      ),
    );
  }, [language, t.resetEvent]);

  function simulateMove() {
    if (deviceState === 'OFFLINE') return;
    const nextIndex = (routeIndex + 1) % ROUTE.length;
    const nextPoint = ROUTE[nextIndex];
    setRouteIndex(nextIndex);
    setHistory((points) => [...points, nextPoint].slice(-12));
    setBattery((value) => Math.max(5, value - 2));
    if (deviceState === 'SOS') setDeviceState('ONLINE');
    pushEvent(t.moved);
  }

  function simulateSos() {
    if (deviceState === 'OFFLINE') return;
    setDeviceState('SOS');
    pushEvent(t.sosEvent);
  }

  function simulateLowBattery() {
    setBattery(12);
    pushEvent(t.batteryEvent);
  }

  function toggleOffline() {
    if (deviceState === 'OFFLINE') {
      setDeviceState('ONLINE');
      pushEvent(t.onlineEvent);
    } else {
      setDeviceState('OFFLINE');
      pushEvent(t.offlineEvent);
    }
  }

  function resetDemo() {
    const now = new Date();
    setRouteIndex(0);
    setBattery(86);
    setDeviceState('ONLINE');
    setHistory([ROUTE[0]]);
    setLastUpdate(now);
    setTimeline([{ id: crypto.randomUUID(), at: now, text: t.resetEvent }]);
    mapRef.current?.setView(ROUTE[0], 14);
  }

  return (
    <section className="care-demo">
      <div className="care-demo-warning" role="note">
        <b>DEMO</b>
        <span>{t.warning}</span>
      </div>

      <div className="hero care-demo-hero">
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
        <small>{t.noRealData}</small>
      </div>

      <div className="care-demo-kpis">
        <div className="card">
          <div className="muted">{t.device}</div>
          <div className="care-demo-value">DEMO-TRACKER-001</div>
        </div>
        <div className="card">
          <div className="muted">{t.wearer}</div>
          <div className="care-demo-value">{t.wearerValue}</div>
        </div>
        <div className="card">
          <div className="muted">{t.battery}</div>
          <div className={battery <= 20 ? 'care-demo-value low-battery' : 'care-demo-value'}>{battery}%</div>
        </div>
        <div className="card">
          <div className="muted">{t.status}</div>
          <div className={`care-device-state ${deviceState.toLowerCase()}`}>{stateLabel}</div>
        </div>
      </div>

      <div className="card care-demo-controls">
        <div className="row">
          <button className="btn primary" type="button" onClick={simulateMove} disabled={deviceState === 'OFFLINE'}>
            {t.move}
          </button>
          <button className="btn danger" type="button" onClick={simulateSos} disabled={deviceState === 'OFFLINE'}>
            {t.sosButton}
          </button>
          <button className="btn secondary" type="button" onClick={simulateLowBattery}>
            {t.lowBattery}
          </button>
          <button className="btn secondary" type="button" onClick={toggleOffline}>
            {deviceState === 'OFFLINE' ? t.backOnline : t.toggleOffline}
          </button>
          <button className="btn secondary" type="button" onClick={resetDemo}>
            {t.reset}
          </button>
        </div>
        <div className="muted care-demo-last-update">
          {t.lastUpdate}: {lastUpdate.toLocaleString(locale)}
        </div>
      </div>

      <div className="care-demo-main-grid">
        <div className="card">
          <h2>{t.map}</h2>
          <div ref={mapEl} className="care-demo-map" aria-label={t.map} />
          <div className="muted care-demo-coordinate">
            {currentPoint[0].toFixed(6)}, {currentPoint[1].toFixed(6)}
          </div>
        </div>

        <div className="card">
          <h2>{t.timeline}</h2>
          <div className="care-demo-timeline" aria-live="polite">
            {timeline.map((item) => (
              <div className="care-demo-event" key={item.id}>
                <span className="care-demo-event-dot" />
                <div>
                  <b>{item.text}</b>
                  <div className="muted">{item.at.toLocaleTimeString(locale)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
