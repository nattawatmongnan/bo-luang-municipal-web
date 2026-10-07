import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BO_LUANG_BOUNDARY } from './boLuangBoundary';
import { useI18n } from './i18n';
import { supabase } from './lib/supabase';

type DeviceState = 'ONLINE' | 'OFFLINE' | 'SOS';

type TimelineItem = {
  id: string;
  at: Date;
  text: string;
};

type MedicationSlot = 'MORNING' | 'NOON' | 'EVENING';
type MedicationState = 'WAITING' | 'DUE' | 'TAKEN' | 'OVERDUE';

const MEDICATION_SCHEDULE: { slot: MedicationSlot; time: string }[] = [
  { slot: 'MORNING', time: '08:00' },
  { slot: 'NOON', time: '12:00' },
  { slot: 'EVENING', time: '18:00' },
];

const DEMO_HOMELESS_POINT: [number, number] = [18.1540, 98.3515];

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
    geofence: '🚧 จำลองออกนอกพื้นที่ปลอดภัย',
    safeZone: 'พื้นที่ปลอดภัยจำลอง',
    offlineCountdown: 'จะแจ้งเตือนออฟไลน์ใน',
    seconds: 'วินาที',
    geofenceEvent: 'ออกนอกพื้นที่ปลอดภัยจำลอง',
    offlineAlertEvent: 'ไม่พบสัญญาณครบ 15 วินาที — แจ้งเตือนออฟไลน์จำลอง',
    reset: '↺ รีเซ็ตการทดลอง',
    moved: 'อุปกรณ์ส่งตำแหน่งจำลองใหม่',
    sosEvent: 'ได้รับสัญญาณ SOS จำลอง',
    batteryEvent: 'แบตเตอรี่จำลองลดลงเหลือ 12%',
    offlineEvent: 'อุปกรณ์จำลองหยุดส่งข้อมูล',
    onlineEvent: 'อุปกรณ์จำลองกลับมาเชื่อมต่อ',
    resetEvent: 'เริ่มการทดลองใหม่',
    noRealData: 'ไม่มีการเชื่อม GPS หรือ SIM จริง แต่เหตุการณ์จำลองจะถูกบันทึกเข้า Supabase',
    syncIdle: 'พร้อมบันทึกเหตุการณ์เข้า Supabase',
    syncSaving: 'กำลังบันทึกเข้า Supabase…',
    syncSaved: 'บันทึกเหตุการณ์เข้า Supabase แล้ว',
    syncFailed: 'บันทึกเข้า Supabase ไม่สำเร็จ',
    syncRate: 'ทดลองถี่เกินไป กรุณารอสักครู่',
    medicationTitle: '💊 ระบบเตือนรับยา (DEMO)',
    medicationHelp: 'เป็นการจำลองเวลาเท่านั้น ไม่ใช่คำสั่งการใช้ยาจริง ตารางยาจริงต้องมาจากแพทย์ ผู้ดูแล หรือข้อมูลที่ได้รับการยืนยัน',
    morning: 'รอบเช้า',
    noon: 'รอบกลางวัน',
    evening: 'รอบเย็น',
    waiting: 'รอเวลา',
    due: 'ถึงเวลาแล้ว',
    taken: 'ยืนยันรับยาแล้ว',
    overdue: 'เลยเวลาแล้ว',
    simulateDue: '⏰ จำลองถึงเวลา',
    confirmTaken: '✅ ยืนยันรับยาแล้ว',
    simulateOverdue: '⚠️ จำลองเลยเวลา',
    autoOverdue: 'ถ้ายังไม่ยืนยัน ภายใน 20 วินาที DEMO จะเปลี่ยนเป็นเลยเวลาอัตโนมัติ',
    medicationDueEvent: 'ถึงเวลารับยารอบจำลอง',
    medicationTakenEvent: 'ยืนยันรับยารอบจำลองแล้ว',
    medicationOverdueEvent: 'เลยเวลารับยารอบจำลอง — แจ้งเจ้าหน้าที่',
    todayProgress: 'สถานะรอบยาวันนี้',
    nextMedication: 'รอบถัดไป',
    disabilityPin: 'จุดผู้พิการจำลอง',
    homelessPin: 'จุดคนไร้บ้านจำลอง',
    homelessPerson: 'บุคคลไร้บ้านจำลอง',
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
    geofence: '🚧 Simulate leaving safe zone',
    safeZone: 'Simulated safe zone',
    offlineCountdown: 'Offline alert in',
    seconds: 'seconds',
    geofenceEvent: 'Left the simulated safe zone',
    offlineAlertEvent: 'No signal for 15 seconds — simulated offline alert',
    reset: '↺ Reset demo',
    moved: 'Demo device sent a new simulated position',
    sosEvent: 'Simulated SOS signal received',
    batteryEvent: 'Simulated battery dropped to 12%',
    offlineEvent: 'Demo device stopped sending data',
    onlineEvent: 'Demo device came back online',
    resetEvent: 'Demo restarted',
    noRealData: 'No real GPS or SIM is used; simulated events are saved to Supabase',
    syncIdle: 'Ready to save demo events to Supabase',
    syncSaving: 'Saving to Supabase…',
    syncSaved: 'Demo event saved to Supabase',
    syncFailed: 'Could not save the demo event to Supabase',
    syncRate: 'Too many demo events. Please wait a moment.',
    medicationTitle: '💊 Medication Reminder (DEMO)',
    medicationHelp: 'Simulation only. This is not medical dosing advice. Real schedules must come from a clinician, caregiver, or verified instructions.',
    morning: 'Morning',
    noon: 'Noon',
    evening: 'Evening',
    waiting: 'Waiting',
    due: 'Due now',
    taken: 'Confirmed',
    overdue: 'Overdue',
    simulateDue: '⏰ Simulate due time',
    confirmTaken: '✅ Confirm taken',
    simulateOverdue: '⚠️ Simulate overdue',
    autoOverdue: 'If not confirmed within 20 seconds, the DEMO automatically marks it overdue.',
    medicationDueEvent: 'Simulated medication reminder is due',
    medicationTakenEvent: 'Simulated medication was confirmed',
    medicationOverdueEvent: 'Simulated medication reminder is overdue — staff alerted',
    todayProgress: 'Today’s reminder progress',
    nextMedication: 'Next reminder',
    disabilityPin: 'Simulated disability point',
    homelessPin: 'Simulated homeless-person point',
    homelessPerson: 'Simulated homeless person',
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
    geofence: '🚧 模拟离开安全区域',
    safeZone: '模拟安全区域',
    offlineCountdown: '离线警报倒计时',
    seconds: '秒',
    geofenceEvent: '已离开模拟安全区域',
    offlineAlertEvent: '15 秒未收到信号 — 模拟离线警报',
    reset: '↺ 重置演示',
    moved: '模拟设备发送了新的位置',
    sosEvent: '收到模拟 SOS 信号',
    batteryEvent: '模拟电量降至 12%',
    offlineEvent: '模拟设备停止发送数据',
    onlineEvent: '模拟设备恢复连接',
    resetEvent: '重新开始演示',
    noRealData: '本页面不连接真实 GPS 或 SIM；模拟事件会保存到 Supabase',
    syncIdle: '已准备将模拟事件保存到 Supabase',
    syncSaving: '正在保存到 Supabase…',
    syncSaved: '模拟事件已保存到 Supabase',
    syncFailed: '无法保存到 Supabase',
    syncRate: '模拟操作过于频繁，请稍后再试',
    medicationTitle: '💊 用药提醒（演示）',
    medicationHelp: '仅为时间提醒演示，不是实际用药建议。真实用药时间应来自医生、照护者或已确认的说明。',
    morning: '早间',
    noon: '中午',
    evening: '晚间',
    waiting: '等待时间',
    due: '时间已到',
    taken: '已确认',
    overdue: '已超时',
    simulateDue: '⏰ 模拟到点',
    confirmTaken: '✅ 确认已服用',
    simulateOverdue: '⚠️ 模拟超时',
    autoOverdue: '若 20 秒内未确认，演示系统会自动标记为超时。',
    medicationDueEvent: '模拟用药提醒时间已到',
    medicationTakenEvent: '已确认模拟用药提醒',
    medicationOverdueEvent: '模拟用药提醒已超时 — 已通知工作人员',
    todayProgress: '今日提醒进度',
    nextMedication: '下一次提醒',
    disabilityPin: '模拟残障人士位置',
    homelessPin: '模拟无家可归者位置',
    homelessPerson: '模拟无家可归者',
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
  const [syncStatus, setSyncStatus] = useState<string>(copy[language].syncIdle);
  const [offlineSeconds, setOfflineSeconds] = useState<number | null>(null);
  const [medicationStates, setMedicationStates] = useState<Record<MedicationSlot, MedicationState>>({
    MORNING: 'WAITING',
    NOON: 'WAITING',
    EVENING: 'WAITING',
  });
  const medicationTimersRef = useRef<Partial<Record<MedicationSlot, number>>>({});

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

  async function saveDemoEvent(
    eventType: 'MOVE' | 'SOS' | 'LOW_BATTERY' | 'OFFLINE' | 'ONLINE' | 'RESET' | 'GEOFENCE_ALERT' | 'OFFLINE_ALERT' | 'MEDICATION_DUE' | 'MEDICATION_TAKEN' | 'MEDICATION_OVERDUE',
    nextState: DeviceState,
    nextBattery: number,
    point: [number, number],
    medication?: { slot: MedicationSlot; time: string },
  ) {
    if (!supabase) {
      setSyncStatus(t.syncFailed);
      return;
    }

    setSyncStatus(t.syncSaving);
    try {
      const { data, error } = await supabase.functions.invoke('public-api', {
        body: {
          action: 'care_demo_event',
          payload: {
            event_type: eventType,
            device_state: nextState,
            battery: nextBattery,
            lat: point[0],
            lng: point[1],
            medication_slot: medication?.slot ?? null,
            scheduled_time: medication?.time ?? null,
          },
        },
      });

      if (error || !data?.ok) {
        setSyncStatus(data?.code === 'RATE_LIMITED' ? t.syncRate : t.syncFailed);
        return;
      }

      setSyncStatus(t.syncSaved);
    } catch {
      setSyncStatus(t.syncFailed);
    }
  }

  function medicationSlotLabel(slot: MedicationSlot) {
    if (slot === 'MORNING') return t.morning;
    if (slot === 'NOON') return t.noon;
    return t.evening;
  }

  function medicationStateLabel(state: MedicationState) {
    if (state === 'DUE') return t.due;
    if (state === 'TAKEN') return t.taken;
    if (state === 'OVERDUE') return t.overdue;
    return t.waiting;
  }

  function clearMedicationTimer(slot: MedicationSlot) {
    const timer = medicationTimersRef.current[slot];
    if (timer) window.clearTimeout(timer);
    delete medicationTimersRef.current[slot];
  }

  function simulateMedicationDue(slot: MedicationSlot, time: string) {
    clearMedicationTimer(slot);
    setMedicationStates((current) => ({ ...current, [slot]: 'DUE' }));
    pushEvent(`${t.medicationDueEvent}: ${medicationSlotLabel(slot)} ${time}`);
    void saveDemoEvent('MEDICATION_DUE', deviceState, battery, currentPoint, { slot, time });

    medicationTimersRef.current[slot] = window.setTimeout(() => {
      setMedicationStates((current) => {
        if (current[slot] !== 'DUE') return current;
        pushEvent(`${t.medicationOverdueEvent}: ${medicationSlotLabel(slot)} ${time}`);
        void saveDemoEvent('MEDICATION_OVERDUE', deviceState, battery, currentPoint, { slot, time });
        return { ...current, [slot]: 'OVERDUE' };
      });
      delete medicationTimersRef.current[slot];
    }, 20000);
  }

  function confirmMedicationTaken(slot: MedicationSlot, time: string) {
    clearMedicationTimer(slot);
    setMedicationStates((current) => ({ ...current, [slot]: 'TAKEN' }));
    pushEvent(`${t.medicationTakenEvent}: ${medicationSlotLabel(slot)} ${time}`);
    void saveDemoEvent('MEDICATION_TAKEN', deviceState, battery, currentPoint, { slot, time });
  }

  function simulateMedicationOverdue(slot: MedicationSlot, time: string) {
    clearMedicationTimer(slot);
    setMedicationStates((current) => ({ ...current, [slot]: 'OVERDUE' }));
    pushEvent(`${t.medicationOverdueEvent}: ${medicationSlotLabel(slot)} ${time}`);
    void saveDemoEvent('MEDICATION_OVERDUE', deviceState, battery, currentPoint, { slot, time });
  }

  const takenMedicationCount = MEDICATION_SCHEDULE.filter(
    (item) => medicationStates[item.slot] === 'TAKEN',
  ).length;

  const nextMedication = MEDICATION_SCHEDULE.find(
    (item) => medicationStates[item.slot] !== 'TAKEN',
  ) ?? null;

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

    L.circle(ROUTE[0], {
      radius: 700,
      color: '#16a34a',
      weight: 2,
      fillOpacity: 0.05,
    }).bindTooltip(t.safeZone).addTo(map);

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

    markerRef.current = L.marker(ROUTE[0], { icon })
      .bindPopup('<b>DEMO PERSON A</b><br>Simulated Care Tracker')
      .addTo(map);

    const disabilityIcon = L.divIcon({
      className: 'care-demo-person-marker',
      html: '<div class="care-demo-person-marker-dot">🧑‍🦽</div>',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    L.marker(ROUTE[0], { icon: disabilityIcon, zIndexOffset: 300 })
      .bindTooltip('DEMO PERSON A', { direction: 'top', offset: [0, -22] })
      .addTo(map);

    const homelessIcon = L.divIcon({
      className: 'care-demo-homeless-marker',
      html: '<div class="care-demo-homeless-marker-dot">🧍</div>',
      iconSize: [46, 46],
      iconAnchor: [23, 23],
    });

    L.marker(DEMO_HOMELESS_POINT, { icon: homelessIcon, zIndexOffset: 200 })
      .bindTooltip(t.homelessPerson, { direction: 'top', offset: [0, -20] })
      .bindPopup('<b>DEMO PERSON B</b><br>Simulated homeless-person point — not a real person')
      .addTo(map);

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
    if (deviceState !== 'OFFLINE') {
      setOfflineSeconds(null);
      return;
    }
    setOfflineSeconds(15);
    const timer = window.setInterval(() => {
      setOfflineSeconds((value) => {
        if (value === null) return null;
        if (value <= 1) {
          window.clearInterval(timer);
          pushEvent(t.offlineAlertEvent);
          void saveDemoEvent('OFFLINE_ALERT', 'OFFLINE', battery, currentPoint);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [deviceState]);

  useEffect(() => {
    return () => {
      MEDICATION_SCHEDULE.forEach((item) => clearMedicationTimer(item.slot));
    };
  }, []);

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
    const nextBattery = Math.max(5, battery - 2);
    setRouteIndex(nextIndex);
    setHistory((points) => [...points, nextPoint].slice(-12));
    setBattery(nextBattery);
    if (deviceState === 'SOS') setDeviceState('ONLINE');
    pushEvent(t.moved);
    void saveDemoEvent('MOVE', 'ONLINE', nextBattery, nextPoint);
  }

  function simulateSos() {
    if (deviceState === 'OFFLINE') return;
    setDeviceState('SOS');
    pushEvent(t.sosEvent);
    void saveDemoEvent('SOS', 'SOS', battery, currentPoint);
  }

  function simulateGeofence() {
    if (deviceState === 'OFFLINE') return;
    const outsidePoint: [number, number] = [ROUTE[0][0] + 0.012, ROUTE[0][1] + 0.012];
    setHistory((points) => [...points, outsidePoint].slice(-12));
    markerRef.current?.setLatLng(outsidePoint);
    mapRef.current?.panTo(outsidePoint, { animate: true });
    pushEvent(t.geofenceEvent);
    void saveDemoEvent('GEOFENCE_ALERT', deviceState, battery, outsidePoint);
  }

  function simulateLowBattery() {
    setBattery(12);
    pushEvent(t.batteryEvent);
    void saveDemoEvent('LOW_BATTERY', deviceState, 12, currentPoint);
  }

  function toggleOffline() {
    if (deviceState === 'OFFLINE') {
      setDeviceState('ONLINE');
      pushEvent(t.onlineEvent);
      void saveDemoEvent('ONLINE', 'ONLINE', battery, currentPoint);
    } else {
      setDeviceState('OFFLINE');
      pushEvent(t.offlineEvent);
      void saveDemoEvent('OFFLINE', 'OFFLINE', battery, currentPoint);
    }
  }

  function resetDemo() {
    const now = new Date();
    setRouteIndex(0);
    setBattery(86);
    setDeviceState('ONLINE');
    setHistory([ROUTE[0]]);
    setLastUpdate(now);
    MEDICATION_SCHEDULE.forEach((item) => clearMedicationTimer(item.slot));
    setMedicationStates({ MORNING: 'WAITING', NOON: 'WAITING', EVENING: 'WAITING' });
    setTimeline([{ id: crypto.randomUUID(), at: now, text: t.resetEvent }]);
    mapRef.current?.setView(ROUTE[0], 14);
    void saveDemoEvent('RESET', 'ONLINE', 86, ROUTE[0]);
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
          <button className="btn secondary" type="button" onClick={simulateGeofence} disabled={deviceState === 'OFFLINE'}>
            {t.geofence}
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
        <div className="care-demo-sync-status" role="status" aria-live="polite">
          {syncStatus}
        </div>
        {deviceState === 'OFFLINE' && offlineSeconds !== null && (
          <div className="care-demo-offline-countdown">
            {t.offlineCountdown}: <b>{offlineSeconds}</b> {t.seconds}
          </div>
        )}
      </div>

      <section className="card care-medication-demo">
        <div className="care-medication-head">
          <div>
            <h2>{t.medicationTitle}</h2>
            <p className="muted">{t.medicationHelp}</p>
          </div>
          <div className="care-medication-progress">
            <span>{t.todayProgress}</span>
            <b>{takenMedicationCount}/3</b>
          </div>
        </div>

        {nextMedication && (
          <div className="care-medication-next">
            {t.nextMedication}: <b>{medicationSlotLabel(nextMedication.slot)} · {nextMedication.time}</b>
          </div>
        )}

        <div className="care-medication-grid">
          {MEDICATION_SCHEDULE.map((item) => {
            const state = medicationStates[item.slot];
            return (
              <article className={`care-medication-item ${state.toLowerCase()}`} key={item.slot}>
                <div className="care-medication-row">
                  <div>
                    <b>{medicationSlotLabel(item.slot)}</b>
                    <div className="care-medication-time">{item.time}</div>
                  </div>
                  <span className={`care-medication-state ${state.toLowerCase()}`}>
                    {medicationStateLabel(state)}
                  </span>
                </div>

                {state === 'DUE' && <div className="muted care-medication-auto">{t.autoOverdue}</div>}

                <div className="care-medication-actions">
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={state === 'TAKEN'}
                    onClick={() => simulateMedicationDue(item.slot, item.time)}
                  >
                    {t.simulateDue}
                  </button>
                  <button
                    className="btn primary"
                    type="button"
                    disabled={!['DUE', 'OVERDUE'].includes(state)}
                    onClick={() => confirmMedicationTaken(item.slot, item.time)}
                  >
                    {t.confirmTaken}
                  </button>
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={state === 'TAKEN'}
                    onClick={() => simulateMedicationOverdue(item.slot, item.time)}
                  >
                    {t.simulateOverdue}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="care-demo-main-grid">
        <div className="card">
          <h2>{t.map}</h2>
          <div ref={mapEl} className="care-demo-map" aria-label={t.map} />
          <div className="muted care-demo-coordinate">
            {currentPoint[0].toFixed(6)}, {currentPoint[1].toFixed(6)}
          </div>
          <div className="care-demo-map-legend">
            <span>🧑‍🦽 {t.disabilityPin}</span>
            <span>🧍 {t.homelessPin}</span>
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
