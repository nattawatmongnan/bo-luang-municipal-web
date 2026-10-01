import { FormEvent, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './lib/supabase';
import { isInsideBoLuang } from './boLuangBoundary';
import PWAInstall from './PWAInstall';

const LocationPicker = lazy(() => import('./LocationPicker'));
const GISDashboard = lazy(() => import('./GISDashboard'));

type Page = 'citizen' | 'track' | 'staff' | 'gis' | 'executive';
type AppRole = 'citizen' | 'staff' | 'department' | 'executive' | 'admin';

type Profile = {
  id: string;
  display_name: string | null;
  role: AppRole;
  department: string | null;
};

type Incident = {
  id: string;
  tracking_no: string;
  category: string;
  title: string;
  description: string;
  village: string;
  house_number?: string | null;
  urgency: string;
  status: string;
  created_at: string;
  assigned_department?: string | null;
  public_note?: string | null;
  photo_url?: string | null;
};

const demoSeed: Incident[] = [
  {
    id: '1',
    tracking_no: 'BLM-2569-DEMO001',
    category: 'ไฟส่องสว่าง',
    title: 'ไฟถนนดับ',
    description: 'ไฟถนนดับใกล้ทางแยก',
    village: 'หมู่ 2',
    urgency: 'HIGH',
    status: 'IN_PROGRESS',
    created_at: new Date().toISOString(),
    assigned_department: 'กองช่าง',
    public_note: 'เจ้าหน้าที่รับเรื่องแล้ว',
  },
  {
    id: '2',
    tracking_no: 'BLM-2569-DEMO002',
    category: 'ถนน',
    title: 'ถนนชำรุด',
    description: 'มีหลุมบริเวณหน้าศาลา',
    village: 'หมู่ 5',
    urgency: 'MEDIUM',
    status: 'RECEIVED',
    created_at: new Date().toISOString(),
  },
];

const labels: Record<string, string> = {
  RECEIVED: 'รับเรื่องแล้ว',
  VERIFYING: 'กำลังตรวจสอบ',
  IN_PROGRESS: 'กำลังดำเนินการ',
  DONE: 'ดำเนินการแล้ว',
  CLOSED: 'ปิดเรื่อง',
};

const staffRoles: AppRole[] = ['staff', 'department', 'executive', 'admin'];
const writableRoles: AppRole[] = ['staff', 'department', 'admin'];

function makeTracking() {
  const y = new Date().getFullYear() + 543;
  return 'BLM-' + y + '-' + crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
}

export default function App() {
  const [page, setPage] = useState<Page>('citizen');
  const [items, setItems] = useState<Incident[]>(demoSeed);
  const [message, setMessage] = useState('');
  const [tracking, setTracking] = useState('');
  const [phoneLast4, setPhoneLast4] = useState('');
  const [found, setFound] = useState<Incident | null>(null);
  const [trackMessage, setTrackMessage] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [lastTrackingNo, setLastTrackingNo] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [gpsMessage, setGpsMessage] = useState('');

  const demo = !supabaseConfigured || import.meta.env.VITE_DEMO_MODE === 'true';

  useEffect(() => {
    if (!supabase || demo) return;

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user.id) {
        void loadProfileAndIncidents(data.session.user.id);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user.id) {
        void loadProfileAndIncidents(nextSession.user.id);
      } else {
        setProfile(null);
        setItems([]);
      }
    });

    return () => data.subscription.unsubscribe();
  }, [demo]);

  async function loadProfileAndIncidents(userId: string) {
    if (!supabase) return;
    setStaffLoading(true);
    setAuthMessage('');

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, role, department')
      .eq('id', userId)
      .single();

    if (profileError || !profileData) {
      setProfile(null);
      setItems([]);
      setAuthMessage('บัญชีนี้ยังไม่ได้รับสิทธิ์เจ้าหน้าที่ในตาราง profiles');
      setStaffLoading(false);
      return;
    }

    const nextProfile = profileData as Profile;
    setProfile(nextProfile);

    if (!staffRoles.includes(nextProfile.role)) {
      setItems([]);
      setAuthMessage('บัญชีนี้ไม่มีสิทธิ์เข้าหน้าเจ้าหน้าที่');
      setStaffLoading(false);
      return;
    }

    const { data: incidents, error } = await supabase
      .from('municipal_incidents')
      .select('id,tracking_no,category,title,description,village,house_number,urgency,status,created_at,assigned_department,public_note,photo_url')
      .order('created_at', { ascending: false });

    if (error) {
      setItems([]);
      setAuthMessage('ไม่สามารถโหลดรายการแจ้งเหตุได้');
    } else {
      setItems((incidents || []) as Incident[]);
    }

    setStaffLoading(false);
  }

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;

    setAuthLoading(true);
    setAuthMessage('');
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email') || '').trim();
    const password = String(f.get('password') || '');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      setAuthMessage('อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชียังไม่พร้อมใช้งาน');
      setAuthLoading(false);
      return;
    }

    setSession(data.session);
    await loadProfileAndIncidents(data.session.user.id);
    setAuthLoading(false);
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setItems([]);
    setAuthMessage('');
  }

  async function updateStatus(incident: Incident, status: string) {
    if (!supabase || !session || !profile || !writableRoles.includes(profile.role)) return;

    const note =
      status === 'IN_PROGRESS'
        ? 'เจ้าหน้าที่กำลังดำเนินการ'
        : status === 'DONE'
          ? 'ดำเนินการเรียบร้อย'
          : status === 'CLOSED'
            ? 'ปิดเรื่องแล้ว'
            : 'เจ้าหน้าที่อัปเดตสถานะ';

    const patch: Record<string, string | null> = {
      status,
      public_note: note,
    };

    if (status === 'IN_PROGRESS' && !incident.assigned_department) {
      patch.assigned_department = profile.department || 'เจ้าหน้าที่เทศบาล';
    }

    const { error } = await supabase
      .from('municipal_incidents')
      .update(patch)
      .eq('id', incident.id);

    if (error) {
      setAuthMessage('อัปเดตสถานะไม่สำเร็จ');
      return;
    }

    await supabase.from('incident_status_history').insert({
      incident_id: incident.id,
      status,
      public_note: note,
      changed_by: session.user.id,
    });

    await loadProfileAndIncidents(session.user.id);
  }

  async function openEvidence(path: string) {
    if (!supabase) return;
    const { data, error } = await supabase.storage
      .from('incident-attachments')
      .createSignedUrl(path, 60);

    if (error || !data?.signedUrl) {
      setAuthMessage('ไม่สามารถเปิดรูปหลักฐานได้');
      return;
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  function openManualLocationPicker() {
    setMapPickerOpen(true);
    setLocationConfirmed(false);
    setGpsMessage('แตะบนแผนที่เพื่อปักหมุดจุดเกิดเหตุ แล้วกดยืนยันตำแหน่ง');
    window.setTimeout(() => {
      document.getElementById('manual-location-picker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }

  function focusProblem(id: string) {
    window.setTimeout(() => {
      const element = document.getElementById(id) as HTMLElement | null;
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.focus();
    }, 0);
  }

  async function copyTrackingNumber() {
    if (!lastTrackingNo) return;
    try {
      await navigator.clipboard.writeText(lastTrackingNo);
      setCopyStatus('คัดลอกเลขติดตามแล้ว');
    } catch {
      setCopyStatus('คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกเลขแล้วคัดลอกเอง');
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setMessage('');
    setLastTrackingNo('');
    setCopyStatus('');

    const f = new FormData(e.currentTarget);
    const payload = {
      category: String(f.get('category') || 'อื่นๆ'),
      title: String(f.get('title') || '').trim(),
      description: String(f.get('description') || '').trim(),
      village: String(f.get('village') || '').trim(),
      house_number: String(f.get('house') || '').trim(),
      reporter_name: String(f.get('name') || '').trim(),
      reporter_phone: String(f.get('phone') || '').trim(),
      urgency: String(f.get('urgency') || 'MEDIUM'),
    };

    const errors: Record<string, string> = {};
    if (!payload.village) errors.village = 'กรุณาเลือกหมู่บ้าน/หมู่ที่';
    if (payload.title.length < 3) errors.title = 'หัวข้อต้องมีอย่างน้อย 3 ตัวอักษร';
    if (payload.description.length < 3) errors.description = 'รายละเอียดต้องมีอย่างน้อย 3 ตัวอักษร';

    const phoneDigits = payload.reporter_phone.replace(/\D/g, '');
    if (payload.reporter_phone && (phoneDigits.length < 9 || phoneDigits.length > 10)) {
      errors.phone = 'กรุณากรอกเบอร์โทรเต็ม 9–10 หลัก หรือเว้นว่าง';
    }

    if (lat === null || lng === null) {
      errors.location = 'กรุณาปักหมุดจุดเกิดเหตุบนแผนที่';
    } else if (!isInsideBoLuang(lat, lng)) {
      errors.location = 'จุดที่เลือกอยู่นอกขอบเขตอ้างอิงของระบบ';
    } else if (!locationConfirmed) {
      errors.location = 'เลือกหมุดแล้ว แต่ยังไม่ได้กดยืนยันตำแหน่ง';
    }

    if (photoFile) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(photoFile.type)) {
        errors.photo = 'รองรับเฉพาะรูป JPG, PNG หรือ WebP';
      } else if (photoFile.size > 5 * 1024 * 1024) {
        errors.photo = 'รูปต้องมีขนาดไม่เกิน 5 MB';
      }
    }

    setFormErrors(errors);

    const firstProblem =
      errors.village ? 'village-input' :
      errors.title ? 'title-input' :
      errors.description ? 'description-input' :
      errors.phone ? 'phone-input' :
      errors.location ? 'manual-location-picker' :
      errors.photo ? 'photo-input' : '';

    if (firstProblem) {
      if (errors.location) setMapPickerOpen(true);
      setMessage('กรุณาตรวจสอบข้อมูลที่ระบุไว้ในแบบฟอร์ม');
      focusProblem(firstProblem);
      return;
    }

    if (demo || !supabase) {
      setMessage('ขณะนี้เป็นโหมดสาธิต จึงยังไม่บันทึกเรื่องและไม่สร้างเลขติดตามจริง');
      return;
    }

    setSubmitting(true);
    let photoPath: string | null = null;

    try {
      if (photoFile) {
        const extension =
          photoFile.type === 'image/png'
            ? 'png'
            : photoFile.type === 'image/webp'
              ? 'webp'
              : 'jpg';
        photoPath = `public-submissions/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('incident-attachments')
          .upload(photoPath, photoFile, {
            contentType: photoFile.type,
            upsert: false,
          });

        if (uploadError) {
          setFormErrors({ photo: 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่' });
          setMessage('อัปโหลดรูปไม่สำเร็จ ข้อมูลในฟอร์มยังอยู่ครบ');
          focusProblem('photo-input');
          return;
        }
      }

      const { data, error } = await supabase.rpc('submit_incident', {
        p_category: payload.category,
        p_title: payload.title,
        p_description: payload.description,
        p_village: payload.village,
        p_house_number: payload.house_number || null,
        p_reporter_name: payload.reporter_name || null,
        p_reporter_phone: payload.reporter_phone || null,
        p_urgency: payload.urgency,
        p_photo_path: photoPath,
        p_lat: lat,
        p_lng: lng,
        p_accuracy_m: null,
        p_location_confirmed: true,
      });

      if (error) {
        if (error.message?.includes('OUTSIDE_BOLUANG')) {
          setFormErrors({ location: 'จุดที่เลือกอยู่นอกขอบเขตที่เซิร์ฟเวอร์อนุญาต' });
          setMessage('ไม่สามารถส่งเรื่องได้ กรุณาตรวจสอบตำแหน่ง');
          focusProblem('manual-location-picker');
        } else {
          setMessage('ส่งเรื่องไม่สำเร็จ ข้อมูลในฟอร์มยังอยู่ครบ กรุณาลองใหม่');
        }
        return;
      }

      const trackingNo = data?.[0]?.tracking_no;
      if (!trackingNo) {
        setMessage('บันทึกข้อมูลแล้วแต่ไม่ได้รับเลขติดตามกลับมา กรุณาแจ้งผู้ดูแลระบบก่อนส่งซ้ำ');
        return;
      }

      setLastTrackingNo(trackingNo);
      setMessage('ส่งเรื่องสำเร็จ');
      setFormErrors({});
      e.currentTarget.reset();
      setPhotoFile(null);
      setLat(null);
      setLng(null);
      setLocationConfirmed(false);
      setMapPickerOpen(false);
      setGpsMessage('');
    } catch {
      setMessage('เกิดข้อผิดพลาดด้านเครือข่าย ข้อมูลในฟอร์มยังอยู่ครบ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    } finally {
      setSubmitting(false);
    }
  }

  async function doTrack(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (trackingLoading) return;

    setFound(null);
    setTrackMessage('');

    const trackingNo = tracking.trim();
    const last4 = phoneLast4.trim();

    if (!trackingNo) {
      setTrackMessage('กรุณากรอกเลขติดตามเรื่อง');
      focusProblem('tracking-input');
      return;
    }

    if (last4 && !/^\d{4}$/.test(last4)) {
      setTrackMessage('หากกรอกเบอร์ยืนยัน ต้องเป็นตัวเลข 4 หลัก');
      focusProblem('tracking-phone-input');
      return;
    }

    if (demo || !supabase) {
      setTrackMessage('โหมดสาธิตไม่ได้เชื่อมข้อมูลติดตามจริง');
      return;
    }

    setTrackingLoading(true);
    setTrackMessage('กำลังค้นหา…');

    try {
      const { data, error } = await supabase.rpc('track_incident', {
        p_tracking_no: trackingNo,
        p_phone_last4: last4,
      });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        setTrackMessage(
          msg.includes('fetch') || msg.includes('network')
            ? 'เชื่อมต่อเครือข่ายไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'
            : 'ระบบติดตามขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง',
        );
        return;
      }

      const item = data?.[0] || null;
      setFound(item);
      setTrackMessage(
        item
          ? ''
          : 'ไม่พบข้อมูลที่ตรงกับข้อมูลที่ใช้ยืนยัน กรุณาตรวจสอบแล้วลองใหม่',
      );
    } catch {
      setTrackMessage('เชื่อมต่อเครือข่ายไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    } finally {
      setTrackingLoading(false);
    }
  }

  const stats = useMemo(
    () => ({
      all: items.length,
      active: items.filter((x) => !['DONE', 'CLOSED'].includes(x.status)).length,
      done: items.filter((x) => ['DONE', 'CLOSED'].includes(x.status)).length,
    }),
    [items],
  );

  const canViewStaff = Boolean(profile && staffRoles.includes(profile.role));
  const canWrite = Boolean(profile && writableRoles.includes(profile.role));
  const activeStaffItems = showClosed ? items : items.filter((item) => item.status !== 'CLOSED');
  const closedCount = items.filter((item) => item.status === 'CLOSED').length;

  return (
    <div className="app">
      <header className="top">
        <div className="top-inner">
          <div className="brand-lockup">
            <img src="/icons/bo-luang-icon.svg" alt="โลโก้เทศบาลตำบลบ่อหลวง" className="brand-logo" />
            <div>
              <div className="brand">เทศบาลตำบลบ่อหลวง</div>
              <div className="brand-en">BO-LUANG T CARE</div>
              <div className="sub">แจ้งเหตุ · ติดตามงาน · GIS Live · ศูนย์งานเจ้าหน้าที่</div>
            </div>
          </div>
          <nav className="nav">
            {([
              ['citizen', 'ประชาชน'],
              ['track', 'ติดตามเรื่อง'],
              ['staff', 'เจ้าหน้าที่'],
              ['gis', 'GIS Live'],
              ['executive', 'ผู้บริหาร'],
            ] as [Page, string][]).map(([p, l]) => (
              <button className={page === p ? 'active' : ''} onClick={() => setPage(p)} key={p}>
                {l}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="wrap">
        {demo && (
          <div className="notice">
            ขณะนี้อยู่ใน <b>Demo mode</b> — ข้อมูลตัวอย่างไม่ได้ใช้แทนฐานข้อมูลเทศบาลจริง
          </div>
        )}

        {page === 'citizen' && (
          <>
            <section className="hero">
              <h1>แจ้งเหตุหรือขอความช่วยเหลือ</h1>
              <p>ส่งข้อมูลให้เทศบาลพร้อมเลขติดตามเรื่อง ใช้งานได้ทั้งมือถือและคอมพิวเตอร์</p>
              <span className="emergency">
                กรณีฉุกเฉินที่เสี่ยงต่อชีวิต โปรดติดต่อหน่วยฉุกเฉินที่เกี่ยวข้องโดยตรง
              </span>
            </section>

            <div className="grid">
              <section className="card" style={{ gridColumn: 'span 2' }}>
                <h2>แบบฟอร์มแจ้งเหตุ</h2>
                <form onSubmit={submit}>
                  <div className="grid">
                    <label className="field">
                      ประเภท
                      <select name="category">
                        <option>ถนน</option>
                        <option>ไฟส่องสว่าง</option>
                        <option>ขยะ</option>
                        <option>น้ำประปา</option>
                        <option>น้ำท่วม</option>
                        <option>สัตว์รบกวน</option>
                        <option>ความปลอดภัย</option>
                        <option>อื่นๆ</option>
                      </select>
                    </label>
                    <label className="field">
                      หมู่บ้าน/หมู่ที่ *
                      <select id="village-input" name="village" defaultValue="" required>
                        <option value="" disabled>เลือกหมู่บ้าน/หมู่ที่</option>
                        <option value="หมู่ที่ 1 บ้านบ่อหลวง">หมู่ที่ 1 · บ้านบ่อหลวง</option>
                        <option value="หมู่ที่ 2 บ้านวังกอง">หมู่ที่ 2 · บ้านวังกอง</option>
                        <option value="หมู่ที่ 3 บ้านขุน">หมู่ที่ 3 · บ้านขุน</option>
                        <option value="หมู่ที่ 4 บ้านนาฟ่อน">หมู่ที่ 4 · บ้านนาฟ่อน</option>
                        <option value="หมู่ที่ 5 บ้านแม่ลายเหนือ (รวมบ้านแม่ลายใต้)">หมู่ที่ 5 · บ้านแม่ลายเหนือ (รวมบ้านแม่ลายใต้)</option>
                        <option value="หมู่ที่ 6 บ้านแม่ลายใต้ / บ้านพุย (บางส่วน)">หมู่ที่ 6 · บ้านแม่ลายใต้ / บ้านพุย (บางส่วน)</option>
                        <option value="หมู่ที่ 7 บ้านพุย / บ้านกิ่วลม">หมู่ที่ 7 · บ้านพุย / บ้านกิ่วลม</option>
                        <option value="หมู่ที่ 8 บ้านกิ่วลม / บ้านเตียนอาง">หมู่ที่ 8 · บ้านกิ่วลม / บ้านเตียนอาง</option>
                        <option value="หมู่ที่ 10 บ้านเตียนอาง">หมู่ที่ 10 · บ้านเตียนอาง</option>
                        <option value="หมู่ที่ 11 บ้านบ่อสะแง๋">หมู่ที่ 11 · บ้านบ่อสะแง๋</option>
                        <option value="หมู่ที่ 12 บ้านบ่อพะแวน (ที่ตั้งสำนักงานเทศบาลตำบลบ่อหลวง)">หมู่ที่ 12 · บ้านบ่อพะแวน (ที่ตั้งสำนักงานเทศบาล)</option>
                        <option value="หมู่ที่ 13 บ้านแม่หืด">หมู่ที่ 13 · บ้านแม่หืด</option>
                      </select>
                    </label>
                    <label className="field">
                      ความเร่งด่วน
                      <select name="urgency">
                        <option value="LOW">ทั่วไป</option>
                        <option value="MEDIUM">เร่งด่วนปานกลาง</option>
                        <option value="HIGH">เร่งด่วน</option>
                      </select>
                    </label>
                  </div>

                  <label className="field">
                    หัวข้อ *
                    <input name="title" placeholder="สรุปเหตุสั้น ๆ" />
                  </label>

                  <label className="field">
                    รายละเอียด *
                    <textarea name="description" placeholder="อธิบายตำแหน่งและสิ่งที่ต้องการให้ช่วย" />
                  </label>

                  <div className="grid">
                    <label className="field">
                      บ้านเลขที่
                      <input name="house" />
                    </label>
                    <label className="field">
                      ชื่อผู้แจ้ง
                      <input name="name" />
                    </label>
                    <label className="field">
                      เบอร์โทร
                      <input name="phone" inputMode="tel" placeholder="ใช้ 4 หลักท้ายเพื่อติดตามเรื่อง" />
                    </label>
                  </div>

                  <div className="field" id="manual-location-picker">
                    <span>ตำแหน่งจุดเกิดเหตุ *</span>
                    <p className="muted location-instruction">
                      กรอกหมู่บ้าน/หมู่ที่ บ้านเลขที่ และรายละเอียดด้านบนก่อน จากนั้นแตะปักหมุดเองบนแผนที่
                    </p>
                    <div className="row">
                      <button className="btn secondary" type="button" onClick={openManualLocationPicker}>
                        📍 เปิดแผนที่ปักหมุด
                      </button>
                      {lat !== null && lng !== null && (
                        <span className="muted">
                          หมุด: {lat.toFixed(6)}, {lng.toFixed(6)}
                        </span>
                      )}
                    </div>
                    {gpsMessage && <span className="muted">{gpsMessage}</span>}

                    {mapPickerOpen && (
                      <div className="location-picker-wrap">
                        <Suspense fallback={<div className="map-loading">กำลังโหลดแผนที่...</div>}>
                          <LocationPicker
                            lat={lat}
                            lng={lng}
                            onChange={(nextLat, nextLng) => {
                              setLat(nextLat);
                              setLng(nextLng);
                              setLocationConfirmed(false);
                              setGpsMessage('ปักหมุดแล้ว กรุณาตรวจสอบจุดและกดยืนยัน');
                            }}
                            onOutside={() => {
                              setLocationConfirmed(false);
                              setGpsMessage('เลือกไม่ได้: จุดนี้อยู่นอกเขตเทศบาลตำบลบ่อหลวง');
                            }}
                          />
                        </Suspense>
                        <div className="row location-confirm-row">
                          <button
                            className={`btn ${locationConfirmed ? 'secondary' : 'primary'}`}
                            type="button"
                            disabled={lat === null || lng === null}
                            onClick={() => {
                              if (lat === null || lng === null || !isInsideBoLuang(lat, lng)) {
                                setLocationConfirmed(false);
                                setGpsMessage('กรุณาแตะบนแผนที่เพื่อปักหมุดภายในเขตเทศบาลตำบลบ่อหลวง');
                                return;
                              }
                              setLocationConfirmed(true);
                              setGpsMessage('✓ ยืนยันหมุดแล้ว พร้อมส่งเข้า GIS/QGIS');
                            }}
                          >
                            {locationConfirmed ? '✓ ยืนยันหมุดแล้ว' : 'ยืนยันหมุดตำแหน่งนี้'}
                          </button>
                          <button
                            className="btn secondary"
                            type="button"
                            onClick={() => {
                              setLat(null);
                              setLng(null);
                              setLocationConfirmed(false);
                              setGpsMessage('ล้างหมุดแล้ว กรุณาปักจุดใหม่');
                            }}
                          >
                            ล้างหมุด
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <label className="field">
                    รูปหลักฐาน (ถ้ามี)
                    <input
                      id="photo-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                    />
                    <span className="muted">JPG, PNG หรือ WebP ไม่เกิน 5 MB</span>
                  </label>

                  <button className="btn primary">ส่งเรื่องให้เทศบาล</button>
                </form>

                {message && (
                  <div className={'notice ' + (message.startsWith('ส่งเรื่องสำเร็จ') ? 'ok' : '')} style={{ marginTop: 14 }}>
                    {message}
                  </div>
                )}
              </section>

              <aside className="card">
                <h3>บริการหลัก</h3>
                <div className="list">
                  <button
                    className="item service-button"
                    type="button"
                    onClick={() => {
                      openManualLocationPicker();
                    }}
                  >
                    📍 ปักหมุดจุดเกิดเหตุ
                  </button>
                  <button
                    className="item service-button"
                    type="button"
                    onClick={() => document.getElementById('photo-input')?.click()}
                  >
                    📷 หลักฐานภาพ
                  </button>
                  <button className="item service-button" type="button" onClick={() => setPage('track')}>
                    🔎 ติดตามสถานะด้วยเลข BLM
                  </button>
                  <button className="item service-button" type="button" onClick={() => setPage('staff')}>
                    🔐 เข้าสู่ระบบเจ้าหน้าที่/ผู้บริหาร
                  </button>
                </div>
              </aside>
            </div>
          </>
        )}

        {page === 'track' && (
          <section className="card">
            <h2>ติดตามเรื่อง</h2>
            <p className="muted">กรอกเลขติดตาม และหากตอนแจ้งเหตุใส่เบอร์โทร ให้กรอก 4 หลักท้ายด้วย</p>
            <div className="row">
              <input
                style={{ flex: 2, minWidth: 250, padding: 12, borderRadius: 12, border: '1px solid #cbd5e1' }}
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="BLM-2569-..."
              />
              <input
                style={{ width: 160, padding: 12, borderRadius: 12, border: '1px solid #cbd5e1' }}
                value={phoneLast4}
                onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                placeholder="4 หลักท้าย"
              />
              <button className="btn primary" onClick={doTrack}>
                ค้นหา
              </button>
            </div>

            {trackMessage && <p className="muted">{trackMessage}</p>}

            {found && (
              <div className="item" style={{ marginTop: 16 }}>
                <b>{found.title}</b>
                <p>{found.tracking_no}</p>
                <span className="status">{labels[found.status] || found.status}</span>
                <p>พื้นที่: {found.village}</p>
                <p>{found.public_note || 'ยังไม่มีข้อความอัปเดต'}</p>
              </div>
            )}
          </section>
        )}

        {page === 'staff' && (
          <>
            {!demo && !session && (
              <section className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
                <div className="login-brand">
                  <img src="/icons/bo-luang-icon.svg" alt="" className="login-logo" />
                  <div><b>เทศบาลตำบลบ่อหลวง</b><span>BO-LUANG T CARE</span></div>
                </div>
                <h2>เข้าสู่ระบบเจ้าหน้าที่</h2>
                <p className="muted">ใช้บัญชีที่สร้างไว้ใน Supabase Authentication</p>
                <form onSubmit={handleLogin}>
                  <label className="field">
                    อีเมล
                    <input type="email" name="email" autoComplete="username" required />
                  </label>
                  <label className="field">
                    รหัสผ่าน
                    <input type="password" name="password" autoComplete="current-password" required />
                  </label>
                  <button className="btn primary" disabled={authLoading}>
                    {authLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
                  </button>
                </form>
                {authMessage && <div className="notice" style={{ marginTop: 14 }}>{authMessage}</div>}
              </section>
            )}

            {(demo || session) && (
              <>
                <section className="hero">
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h1>ศูนย์งานเจ้าหน้าที่</h1>
                      {profile && (
                        <p>
                          {profile.display_name || 'เจ้าหน้าที่'} · {profile.role}
                          {profile.department ? ' · ' + profile.department : ''}
                        </p>
                      )}
                    </div>
                    {!demo && session && (
                      <div className="row">
                        <button className="btn secondary" onClick={() => setShowClosed((value) => !value)}>
                          {showClosed ? 'ซ่อนเรื่องที่ปิดแล้ว' : `ดูเรื่องที่ปิดแล้ว (${closedCount})`}
                        </button>
                        <button className="btn secondary" onClick={() => void loadProfileAndIncidents(session.user.id)}>
                          รีเฟรช
                        </button>
                        <button className="btn danger" onClick={() => void handleLogout()}>
                          ออกจากระบบ
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                {authMessage && <div className="notice">{authMessage}</div>}

                {staffLoading && <div className="card">กำลังโหลดข้อมูล...</div>}

                {!staffLoading && canViewStaff && (
                  <div className="list">
                    {activeStaffItems.length === 0 && (
                      <div className="card">{showClosed ? 'ยังไม่มีเรื่องที่ปิดแล้ว' : 'ไม่มีงานที่กำลังเปิดอยู่'}</div>
                    )}
                    {activeStaffItems.map((i) => (
                      <div className="item" key={i.id}>
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                          <div>
                            <b>{i.title}</b>
                            <div className="muted">
                              {i.tracking_no} · {i.village} · {i.category}
                            </div>
                          </div>
                          <span className="status">{labels[i.status] || i.status}</span>
                        </div>

                        <p>{i.description}</p>

                        {i.assigned_department && (
                          <p className="muted">หน่วยงาน: {i.assigned_department}</p>
                        )}

                        {i.photo_url && (
                          <p>
                            <button className="btn secondary" onClick={() => void openEvidence(i.photo_url!)}>
                              📷 เปิดรูปหลักฐาน
                            </button>
                          </p>
                        )}

                        {canWrite && (
                          <div className="row">
                            <button className="btn secondary" onClick={() => void updateStatus(i, 'VERIFYING')}>
                              ตรวจสอบ
                            </button>
                            <button className="btn secondary" onClick={() => void updateStatus(i, 'IN_PROGRESS')}>
                              รับดำเนินการ
                            </button>
                            <button className="btn primary" onClick={() => void updateStatus(i, 'DONE')}>
                              ดำเนินการแล้ว
                            </button>
                            <button className="btn secondary" onClick={() => void updateStatus(i, 'CLOSED')}>
                              ปิดเรื่อง
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {page === 'gis' && (
          <>
            {!demo && !session && (
              <section className="card">
                <h2>กรุณาเข้าสู่ระบบจากหน้า “เจ้าหน้าที่” ก่อน</h2>
                <p className="muted">GIS Live สำหรับเจ้าหน้าที่และผู้บริหารเทศบาล</p>
              </section>
            )}

            {demo && (
              <section className="card">
                <h2>GIS Live ต้องเชื่อม Supabase จริง</h2>
                <p className="muted">ปิด Demo mode เพื่อดูข้อมูล Realtime</p>
              </section>
            )}

            {!demo && session && canViewStaff && (
              <>
                <section className="hero">
                  <h1>GIS Live · ศูนย์เหตุการณ์</h1>
                  <p>หมุดเหตุและพื้นที่ฉุกเฉินจะอัปเดตจาก Supabase Realtime โดยอัตโนมัติ</p>
                </section>
                <Suspense fallback={<div className="card map-loading">กำลังโหลด GIS Live...</div>}>
                  <GISDashboard userId={session.user.id} canWrite={canWrite} />
                </Suspense>
              </>
            )}

            {!demo && session && !canViewStaff && (
              <div className="notice">บัญชีนี้ไม่มีสิทธิ์เปิด GIS Live</div>
            )}
          </>
        )}

        {page === 'executive' && (
          <>
            {!demo && !session && (
              <section className="card">
                <h2>กรุณาเข้าสู่ระบบจากหน้า “เจ้าหน้าที่” ก่อน</h2>
              </section>
            )}

            {(demo || (session && profile && ['executive', 'admin'].includes(profile.role))) && (
              <>
                <section className="hero">
                  <h1>Dashboard ผู้บริหาร</h1>
                  <p>สรุปข้อมูลจากรายการที่ผู้ใช้มีสิทธิ์เข้าถึง โดยไม่แสดงข้อมูลติดต่อของผู้แจ้ง</p>
                </section>
                <div className="grid">
                  <div className="card">
                    <div className="muted">เรื่องทั้งหมด</div>
                    <div className="kpi">{stats.all}</div>
                  </div>
                  <div className="card">
                    <div className="muted">กำลังดำเนินการ</div>
                    <div className="kpi">{stats.active}</div>
                  </div>
                  <div className="card">
                    <div className="muted">ดำเนินการแล้ว</div>
                    <div className="kpi">{stats.done}</div>
                  </div>
                </div>
              </>
            )}

            {!demo && session && profile && !['executive', 'admin'].includes(profile.role) && (
              <div className="notice">บัญชีนี้ไม่มีสิทธิ์เปิด Dashboard ผู้บริหาร</div>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <PWAInstall />
        <span className="footer-brand"><img src="/icons/bo-luang-icon.svg" alt="" /> เทศบาลตำบลบ่อหลวง · BO-LUANG T CARE</span>
      </footer>
    </div>
  );
}
