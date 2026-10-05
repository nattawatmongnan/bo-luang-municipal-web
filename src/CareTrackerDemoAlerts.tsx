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
  alert_status: 'NEW' | 'ACCEPTED';
  accepted_at: string | null;
  accepted_by: string | null;
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
    accept: 'รับเรื่อง',
    accepting: 'กำลังรับเรื่อง…',
    accepted: 'รับเรื่องแล้ว',
    acceptedAt: 'เวลารับเรื่อง',
    acceptFail: 'รับเรื่องไม่สำเร็จ กรุณาลองใหม่',
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
    accept: 'Accept alert',
    accepting: 'Accepting…',
    accepted: 'Accepted',
    acceptedAt: 'Accepted at',
    acceptFail: 'Could not accept this alert. Please try again.',
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
    accept: '接收警报',
    accepting: '正在接收…',
    accepted: '已接收',
    acceptedAt: '接收时间',
    acceptFail: '无法接收此警报，请重试',
  },
} as const;

function label(eventType: DemoAlert['event_type'], t: { sos: string; geofence: string; offline: string }) {
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
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('care_tracker_demo_events')
      .select('id,device_id,event_type,device_state,battery,lat,lng,created_at,alert_status,accepted_at,accepted_by')
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
    const client = supabase;
    if (!client) return;

    const channel = client
      .channel('care-tracker-demo-alerts-staff')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'care_tracker_demo_events' },
        (payload) => {
          const row = payload.new as DemoAlert;
          if (!row?.id || !['SOS', 'GEOFENCE_ALERT', 'OFFLINE_ALERT'].includes(row.event_type)) return;
          setAlerts((current) => [row, ...current.filter((item) => item.id !== row.id)]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 12));
        },
      )
      .subscribe((status) => {
        setRealtimeState(status === 'SUBSCRIBED' ? '●' : '…');
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [loadAlerts]);

  async function acceptAlert(alert: DemoAlert) {
    if (!supabase || alert.alert_status === 'ACCEPTED') return;

    setAcceptingId(alert.id);
    setMessage('');
    const { data, error } = await supabase.rpc('accept_care_tracker_demo_alert', {
      p_event_id: alert.id,
    });

    if (error || !Array.isArray(data) || data.length === 0) {
      setMessage(t.acceptFail);
      setAcceptingId(null);
      return;
    }

    const accepted = data[0] as {
      id: string;
      alert_status: 'ACCEPTED';
      accepted_at: string;
      accepted_by: string;
    };

    setAlerts((current) => current.map((item) =>
      item.id === accepted.id
        ? {
            ...item,
            alert_status: accepted.alert_status,
            accepted_at: accepted.accepted_at,
            accepted_by: accepted.accepted_by,
          }
        : item
    ));
    setAcceptingId(null);
  }

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
              <div className="row">
                <span className="care-demo-badge">DEMO</span>
                <span className={alert.alert_status === 'ACCEPTED' ? 'care-alert-status accepted' : 'care-alert-status new'}>
                  {alert.alert_status === 'ACCEPTED' ? t.accepted : t.accept}
                </span>
              </div>
            </div>
            <div className="care-alert-meta">
              <span>{t.battery}: {alert.battery}%</span>
              {alert.lat !== null && alert.lng !== null && (
                <span>{t.location}: {alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}</span>
              )}
              <span>{new Date(alert.created_at).toLocaleString(locale)}</span>
              {alert.accepted_at && (
                <span>{t.acceptedAt}: {new Date(alert.accepted_at).toLocaleString(locale)}</span>
              )}
            </div>
            <div className="care-alert-actions">
              {alert.alert_status === 'NEW' ? (
                <button
                  className="btn primary"
                  type="button"
                  disabled={acceptingId === alert.id}
                  onClick={() => void acceptAlert(alert)}
                >
                  {acceptingId === alert.id ? t.accepting : t.accept}
                </button>
              ) : (
                <div className="care-alert-accepted-note">✓ {t.accepted}</div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
