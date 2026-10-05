import { useCallback, useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { useI18n } from './i18n';

type DemoAlert = {
  id: string;
  device_id: string;
  event_type: 'SOS' | 'GEOFENCE_ALERT' | 'OFFLINE_ALERT';
  device_state: string;
  battery: number;
  lat: number | null;
  lng: number | null;
  created_at: string;
};

const copy = {
  th: {
    title: 'การแจ้งเตือน Care Tracker (DEMO)',
    help: 'ข้อมูลส่วนนี้เป็นเหตุการณ์จำลองเท่านั้น ไม่ใช่บุคคลหรือเหตุฉุกเฉินจริง',
    empty: 'ยังไม่มีการแจ้งเตือนจำลอง',
    sos: '🆘 SOS จำลอง',
    geofence: '🚧 ออกนอกพื้นที่ปลอดภัยจำลอง',
    offline: '📡 ขาดสัญญาณจำลอง',
    battery: 'แบตเตอรี่',
    location: 'พิกัดจำลอง',
    realtime: 'Realtime',
    refresh: 'รีเฟรช',
    loadFail: 'โหลดการแจ้งเตือนจำลองไม่สำเร็จ',
  },
  en: {
    title: 'Care Tracker Alerts (DEMO)',
    help: 'These are simulated events only, not real people or real emergencies.',
    empty: 'No simulated alerts yet',
    sos: '🆘 Simulated SOS',
    geofence: '🚧 Simulated geofence alert',
    offline: '📡 Simulated signal-loss alert',
    battery: 'Battery',
    location: 'Simulated location',
    realtime: 'Realtime',
    refresh: 'Refresh',
    loadFail: 'Could not load demo alerts',
  },
  zh: {
    title: 'Care Tracker 警报（演示）',
    help: '此处仅显示模拟事件，并非真实人员或真实紧急情况。',
    empty: '暂无模拟警报',
    sos: '🆘 模拟 SOS',
    geofence: '🚧 模拟越界警报',
    offline: '📡 模拟失联警报',
    battery: '电量',
    location: '模拟位置',
    realtime: '实时',
    refresh: '刷新',
    loadFail: '无法加载模拟警报',
  },
} as const;

function label(eventType: DemoAlert['event_type'], t: typeof copy.th) {
  if (eventType === 'SOS') return t.sos;
  if (eventType === 'GEOFENCE_ALERT') return t.geofence;
  return t.offline;
}

export default function CareTrackerDemoAlerts() {
  const { language, locale } = useI18n();
  const t = copy[language];
  const [alerts, setAlerts] = useState<DemoAlert[]>([]);
  const [message, setMessage] = useState('');
  const [realtimeState, setRealtimeState] = useState('…');

  const loadAlerts = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('care_tracker_demo_events')
      .select('id,device_id,event_type,device_state,battery,lat,lng,created_at')
      .in('event_type', ['SOS', 'GEOFENCE_ALERT', 'OFFLINE_ALERT'])
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) {
      setMessage(t.loadFail);
      return;
    }
    setMessage('');
    setAlerts((data || []) as DemoAlert[]);
  }, [t.loadFail]);

  useEffect(() => {
    void loadAlerts();
    if (!supabase) return;

    const channel = supabase
      .channel('care-tracker-demo-alerts-staff')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'care_tracker_demo_events' },
        (payload) => {
          const row = payload.new as DemoAlert;
          if (!['SOS', 'GEOFENCE_ALERT', 'OFFLINE_ALERT'].includes(row.event_type)) return;
          setAlerts((current) => [row, ...current.filter((item) => item.id !== row.id)].slice(0, 12));
        },
      )
      .subscribe((status) => {
        setRealtimeState(status === 'SUBSCRIBED' ? '●' : '…');
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAlerts]);

  return (
    <section className="card care-alert-panel">
      <div className="row care-alert-header">
        <div>
          <h2>{t.title}</h2>
          <p className="muted">{t.help}</p>
        </div>
        <div className="row">
          <span className="care-alert-realtime">{realtimeState} {t.realtime}</span>
          <button className="btn secondary" type="button" onClick={() => void loadAlerts()}>
            {t.refresh}
          </button>
        </div>
      </div>

      {message && <div className="notice">{message}</div>}

      <div className="care-alert-list" aria-live="polite">
        {alerts.length === 0 && <div className="muted">{t.empty}</div>}
        {alerts.map((alert) => (
          <article className={`care-alert-item ${alert.event_type.toLowerCase()}`} key={alert.id}>
            <div className="row care-alert-row">
              <div>
                <b>{label(alert.event_type, t)}</b>
                <div className="muted">{alert.device_id}</div>
              </div>
              <span className="care-demo-badge">DEMO</span>
            </div>
            <div className="care-alert-meta">
              <span>{t.battery}: {alert.battery}%</span>
              {alert.lat !== null && alert.lng !== null && (
                <span>{t.location}: {alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}</span>
              )}
              <span>{new Date(alert.created_at).toLocaleString(locale)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
