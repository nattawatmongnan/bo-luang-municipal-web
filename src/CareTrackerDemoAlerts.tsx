import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabase';
import { useI18n } from './i18n';

type DemoAlert = {
  id: string;
  device_id: string;
  event_type: 'SOS' | 'GEOFENCE_ALERT' | 'OFFLINE_ALERT' | 'MEDICATION_OVERDUE' | 'ASSISTANCE_REQUEST';
  person_group: 'DISABILITY' | 'HOMELESS';
  support_kind: 'FOOD' | 'SHELTER' | 'TRANSPORT' | 'SOCIAL_WORK' | 'BASIC_SUPPORT' | null;
  device_state: string;
  battery: number;
  lat: number | null;
  lng: number | null;
  medication_slot: 'MORNING' | 'NOON' | 'EVENING' | null;
  scheduled_time: string | null;
  created_at: string;
  alert_status: 'NEW' | 'ACCEPTED' | 'IN_PROGRESS' | 'CLOSED';
  accepted_at: string | null;
  accepted_by: string | null;
  started_at: string | null;
  started_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
};

const copy = {
  th: {
    title: 'การแจ้งเตือน Care Tracker (DEMO)',
    help: 'ข้อมูลส่วนนี้เป็นเหตุการณ์จำลองเท่านั้น ไม่ใช่บุคคลหรือเหตุฉุกเฉินจริง',
    empty: 'ยังไม่มีการแจ้งเตือนจำลอง',
    sos: '🆘 SOS จำลอง',
    geofence: '🚧 ออกนอกพื้นที่ปลอดภัยจำลอง',
    offline: '📡 ขาดสัญญาณจำลอง',
    medicationOverdue: '💊 เลยเวลาเตือนรับยา (DEMO)',
    medicationSlot: 'รอบยา',
    scheduledTime: 'เวลาที่ตั้งไว้',
    assistance: '📣 ขอความช่วยเหลือจำลอง',
    group: 'กลุ่ม',
    disability: 'ผู้พิการ DEMO',
    homeless: 'คนไร้บ้าน DEMO',
    supportKind: 'ประเภทความช่วยเหลือ',
    food: 'อาหาร/น้ำดื่ม',
    shelter: 'ที่พักชั่วคราว',
    transport: 'การเดินทาง',
    socialWork: 'นักสังคมสงเคราะห์',
    basicSupport: 'ความช่วยเหลือพื้นฐาน',
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
    startWork: 'เริ่มปฏิบัติงาน',
    startingWork: 'กำลังเริ่มงาน…',
    inProgress: 'กำลังปฏิบัติงาน',
    startedAt: 'เริ่มปฏิบัติงาน',
    closeCase: 'ปิดเรื่อง',
    closingCase: 'กำลังปิดเรื่อง…',
    closed: 'ปิดเรื่องแล้ว',
    closedAt: 'เวลาปิดเรื่อง',
    statusFail: 'อัปเดตสถานะไม่สำเร็จ กรุณาลองใหม่',
    thaiVoice: 'เสียงแจ้งเตือนภาษาไทย',
    voiceOn: '🔊 เปิดเสียงไทย',
    voiceOff: '🔇 ปิดเสียงไทย',
    testVoice: '▶ ทดสอบเสียง',
    readAlert: '🔊 อ่านแจ้งเตือน',
    voiceUnsupported: 'เบราว์เซอร์นี้ไม่รองรับเสียงอ่าน',
    voiceReady: 'เปิดเสียงแจ้งเตือนภาษาไทยแล้ว',
  },
  en: {
    title: 'Care Tracker Alerts (DEMO)',
    help: 'These are simulated events only, not real people or real emergencies.',
    empty: 'No simulated alerts yet',
    sos: '🆘 Simulated SOS',
    geofence: '🚧 Simulated geofence alert',
    offline: '📡 Simulated signal-loss alert',
    medicationOverdue: '💊 Medication reminder overdue (DEMO)',
    medicationSlot: 'Reminder slot',
    scheduledTime: 'Scheduled time',
    assistance: '📣 Simulated assistance request',
    group: 'Group',
    disability: 'Disability DEMO',
    homeless: 'Homeless DEMO',
    supportKind: 'Support type',
    food: 'Food / water',
    shelter: 'Temporary shelter',
    transport: 'Transport',
    socialWork: 'Social worker',
    basicSupport: 'Basic support',
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
    startWork: 'Start response',
    startingWork: 'Starting…',
    inProgress: 'Response in progress',
    startedAt: 'Started at',
    closeCase: 'Close case',
    closingCase: 'Closing…',
    closed: 'Closed',
    closedAt: 'Closed at',
    statusFail: 'Could not update the alert status. Please try again.',
    thaiVoice: 'Thai voice alerts',
    voiceOn: '🔊 Enable Thai voice',
    voiceOff: '🔇 Disable Thai voice',
    testVoice: '▶ Test voice',
    readAlert: '🔊 Read alert',
    voiceUnsupported: 'This browser does not support speech synthesis',
    voiceReady: 'Thai voice alerts are enabled',
  },
  zh: {
    title: 'Care Tracker 警报（演示）',
    help: '此处仅显示模拟事件，并非真实人员或真实紧急情况。',
    empty: '暂无模拟警报',
    sos: '🆘 模拟 SOS',
    geofence: '🚧 模拟越界警报',
    offline: '📡 模拟失联警报',
    medicationOverdue: '💊 用药提醒已超时（演示）',
    medicationSlot: '提醒时段',
    scheduledTime: '设定时间',
    assistance: '📣 模拟求助',
    group: '群组',
    disability: '残障人士 DEMO',
    homeless: '无家可归者 DEMO',
    supportKind: '援助类型',
    food: '食物 / 饮用水',
    shelter: '临时住所',
    transport: '交通',
    socialWork: '社会工作者',
    basicSupport: '基本援助',
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
    startWork: '开始处理',
    startingWork: '正在开始…',
    inProgress: '处理中',
    startedAt: '开始时间',
    closeCase: '关闭事件',
    closingCase: '正在关闭…',
    closed: '已关闭',
    closedAt: '关闭时间',
    statusFail: '无法更新状态，请重试',
    thaiVoice: '泰语语音警报',
    voiceOn: '🔊 开启泰语语音',
    voiceOff: '🔇 关闭泰语语音',
    testVoice: '▶ 测试语音',
    readAlert: '🔊 播报警报',
    voiceUnsupported: '此浏览器不支持语音朗读',
    voiceReady: '已开启泰语语音警报',
  },
} as const;

function label(
  eventType: DemoAlert['event_type'],
  t: { sos: string; geofence: string; offline: string; medicationOverdue: string; assistance: string },
) {
  if (eventType === 'SOS') return t.sos;
  if (eventType === 'GEOFENCE_ALERT') return t.geofence;
  if (eventType === 'MEDICATION_OVERDUE') return t.medicationOverdue;
  if (eventType === 'ASSISTANCE_REQUEST') return t.assistance;
  return t.offline;
}

function medicationSlotLabel(
  slot: DemoAlert['medication_slot'],
  language: 'th' | 'en' | 'zh',
) {
  if (!slot) return '';
  if (language === 'th') return slot === 'MORNING' ? 'รอบเช้า' : slot === 'NOON' ? 'รอบกลางวัน' : 'รอบเย็น';
  if (language === 'zh') return slot === 'MORNING' ? '早间' : slot === 'NOON' ? '中午' : '晚间';
  return slot === 'MORNING' ? 'Morning' : slot === 'NOON' ? 'Noon' : 'Evening';
}

function supportKindLabel(
  kind: DemoAlert['support_kind'],
  t: {
    food: string; shelter: string; transport: string; socialWork: string; basicSupport: string;
  },
) {
  if (kind === 'FOOD') return t.food;
  if (kind === 'SHELTER') return t.shelter;
  if (kind === 'TRANSPORT') return t.transport;
  if (kind === 'SOCIAL_WORK') return t.socialWork;
  return t.basicSupport;
}

export default function CareTrackerDemoAlerts() {
  const { language, locale } = useI18n();
  const t = copy[language];
  const [alerts, setAlerts] = useState<DemoAlert[]>([]);
  const [message, setMessage] = useState('');
  const [realtimeState, setRealtimeState] = useState('…');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('bo-luang-care-thai-voice') === 'on'
  );
  const voiceEnabledRef = useRef(voiceEnabled);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
    window.localStorage.setItem('bo-luang-care-thai-voice', voiceEnabled ? 'on' : 'off');
  }, [voiceEnabled]);

  function thaiAlertText(alert: DemoAlert) {
    if (alert.event_type === 'SOS') {
      return `แจ้งเตือนระบบทดลอง มีสัญญาณ เอส โอ เอส จากอุปกรณ์ ${alert.device_id} แบตเตอรี่ ${alert.battery} เปอร์เซ็นต์ กรุณาตรวจสอบ`;
    }
    if (alert.event_type === 'GEOFENCE_ALERT') {
      return `แจ้งเตือนระบบทดลอง อุปกรณ์ ${alert.device_id} ออกจากพื้นที่ปลอดภัยจำลอง กรุณาตรวจสอบ`;
    }
    if (alert.event_type === 'MEDICATION_OVERDUE') {
      return `แจ้งเตือนระบบทดลอง ยังไม่มีการยืนยันการรับยาตามรอบที่ตั้งไว้ จากอุปกรณ์ ${alert.device_id} กรุณาตรวจสอบกับผู้ดูแล`;
    }
    if (alert.event_type === 'ASSISTANCE_REQUEST') {
      return `แจ้งเตือนระบบทดลอง คนไร้บ้านจำลองส่งคำขอความช่วยเหลือจากอุปกรณ์ ${alert.device_id} กรุณาตรวจสอบ`;
    }
    return `แจ้งเตือนระบบทดลอง ไม่พบสัญญาณจากอุปกรณ์ ${alert.device_id} กรุณาตรวจสอบ`;
  }

  function speakThai(text: string) {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setMessage(t.voiceUnsupported);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = 0.92;
    utterance.pitch = 1;
    const thaiVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith('th'));
    if (thaiVoice) utterance.voice = thaiVoice;
    window.speechSynthesis.speak(utterance);
  }

  function toggleThaiVoice() {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setMessage(t.voiceUnsupported);
      return;
    }
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    if (next) speakThai('เปิดเสียงแจ้งเตือนภาษาไทยแล้ว ระบบนี้เป็นระบบทดลอง');
    else window.speechSynthesis.cancel();
  }

  const loadAlerts = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('care_tracker_demo_events')
      .select('id,device_id,person_group,event_type,device_state,battery,lat,lng,medication_slot,scheduled_time,support_kind,created_at,alert_status,accepted_at,accepted_by,started_at,started_by,closed_at,closed_by')
      .in('event_type', ['SOS', 'GEOFENCE_ALERT', 'OFFLINE_ALERT', 'MEDICATION_OVERDUE', 'ASSISTANCE_REQUEST'])
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
          if (!row?.id || !['SOS', 'GEOFENCE_ALERT', 'OFFLINE_ALERT', 'MEDICATION_OVERDUE', 'ASSISTANCE_REQUEST'].includes(row.event_type)) return;
          if (payload.eventType === 'INSERT' && voiceEnabledRef.current) {
            speakThai(thaiAlertText(row));
          }
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

  async function setAlertStatus(alert: DemoAlert, nextStatus: 'IN_PROGRESS' | 'CLOSED') {
    if (!supabase) return;

    setUpdatingId(alert.id);
    setMessage('');
    const { data, error } = await supabase.rpc('set_care_tracker_demo_alert_status', {
      p_event_id: alert.id,
      p_status: nextStatus,
    });

    if (error || !Array.isArray(data) || data.length === 0) {
      setMessage(t.statusFail);
      setUpdatingId(null);
      return;
    }

    const updated = data[0] as Pick<
      DemoAlert,
      'id' | 'alert_status' | 'accepted_at' | 'accepted_by' |
      'started_at' | 'started_by' | 'closed_at' | 'closed_by'
    >;

    setAlerts((current) => current.map((item) =>
      item.id === updated.id ? { ...item, ...updated } : item
    ));
    setUpdatingId(null);
  }

  function statusText(alert: DemoAlert) {
    if (alert.alert_status === 'CLOSED') return t.closed;
    if (alert.alert_status === 'IN_PROGRESS') return t.inProgress;
    if (alert.alert_status === 'ACCEPTED') return t.accepted;
    return t.accept;
  }

  function statusClass(alert: DemoAlert) {
    if (alert.alert_status === 'CLOSED') return 'closed';
    if (alert.alert_status === 'IN_PROGRESS') return 'in-progress';
    if (alert.alert_status === 'ACCEPTED') return 'accepted';
    return 'new';
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
          <button
            className={voiceEnabled ? 'btn primary' : 'btn secondary'}
            type="button"
            aria-pressed={voiceEnabled}
            onClick={toggleThaiVoice}
          >
            {voiceEnabled ? t.voiceOff : t.voiceOn}
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() => speakThai('ทดสอบเสียงภาษาไทย ระบบบ่อหลวง ที แคร์ พร้อมใช้งาน')}
          >
            {t.testVoice}
          </button>
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
                <span className={`care-alert-status ${statusClass(alert)}`}>
                  {statusText(alert)}
                </span>
              </div>
            </div>
            <div className="care-alert-meta">
              <span>{t.group}: {alert.person_group === 'HOMELESS' ? t.homeless : t.disability}</span>
              <span>{t.battery}: {alert.battery}%</span>
              {alert.event_type === 'ASSISTANCE_REQUEST' && (
                <span>{t.supportKind}: {supportKindLabel(alert.support_kind, t)}</span>
              )}
              {alert.event_type === 'MEDICATION_OVERDUE' && alert.medication_slot && (
                <span>{t.medicationSlot}: {medicationSlotLabel(alert.medication_slot, language)}</span>
              )}
              {alert.event_type === 'MEDICATION_OVERDUE' && alert.scheduled_time && (
                <span>{t.scheduledTime}: {alert.scheduled_time.slice(0, 5)}</span>
              )}
              {alert.lat !== null && alert.lng !== null && (
                <span>{t.location}: {alert.lat.toFixed(5)}, {alert.lng.toFixed(5)}</span>
              )}
              <span>{new Date(alert.created_at).toLocaleString(locale)}</span>
              {alert.accepted_at && (
                <span>{t.acceptedAt}: {new Date(alert.accepted_at).toLocaleString(locale)}</span>
              )}
              {alert.started_at && (
                <span>{t.startedAt}: {new Date(alert.started_at).toLocaleString(locale)}</span>
              )}
              {alert.closed_at && (
                <span>{t.closedAt}: {new Date(alert.closed_at).toLocaleString(locale)}</span>
              )}
            </div>
            <div className="care-alert-actions">
              <button
                className="btn secondary"
                type="button"
                onClick={() => speakThai(thaiAlertText(alert))}
              >
                {t.readAlert}
              </button>
              {alert.alert_status === 'NEW' && (
                <button
                  className="btn primary"
                  type="button"
                  disabled={acceptingId === alert.id}
                  onClick={() => void acceptAlert(alert)}
                >
                  {acceptingId === alert.id ? t.accepting : t.accept}
                </button>
              )}
              {alert.alert_status === 'ACCEPTED' && (
                <>
                  <button
                    className="btn primary"
                    type="button"
                    disabled={updatingId === alert.id}
                    onClick={() => void setAlertStatus(alert, 'IN_PROGRESS')}
                  >
                    {updatingId === alert.id ? t.startingWork : t.startWork}
                  </button>
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={updatingId === alert.id}
                    onClick={() => void setAlertStatus(alert, 'CLOSED')}
                  >
                    {updatingId === alert.id ? t.closingCase : t.closeCase}
                  </button>
                </>
              )}
              {alert.alert_status === 'IN_PROGRESS' && (
                <button
                  className="btn primary"
                  type="button"
                  disabled={updatingId === alert.id}
                  onClick={() => void setAlertStatus(alert, 'CLOSED')}
                >
                  {updatingId === alert.id ? t.closingCase : t.closeCase}
                </button>
              )}
              {alert.alert_status === 'CLOSED' && (
                <div className="care-alert-closed-note">✓ {t.closed}</div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
