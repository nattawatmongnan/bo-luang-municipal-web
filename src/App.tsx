import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './lib/supabase';

type Page = 'citizen' | 'track' | 'staff' | 'executive';
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

  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

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

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('');
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

    if (!payload.title || !payload.description || !payload.village) {
      setMessage('กรุณากรอกข้อมูลที่จำเป็นให้ครบ');
      return;
    }

    if (photoFile) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(photoFile.type)) {
        setMessage('รองรับเฉพาะรูป JPG, PNG หรือ WebP');
        return;
      }
      if (photoFile.size > 5 * 1024 * 1024) {
        setMessage('รูปต้องมีขนาดไม่เกิน 5 MB');
        return;
      }
    }

    if (demo || !supabase) {
      const incident: Incident = {
        ...payload,
        id: crypto.randomUUID(),
        tracking_no: makeTracking(),
        status: 'RECEIVED',
        created_at: new Date().toISOString(),
      };
      setItems((x) => [incident, ...x]);
      setMessage('ส่งเรื่องสำเร็จ เลขติดตาม: ' + incident.tracking_no);
      e.currentTarget.reset();
      return;
    }

    let photoPath: string | null = null;

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
        setMessage('อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่');
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
    });

    if (error) {
      setMessage('ส่งเรื่องไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่');
      return;
    }

    const trackingNo = data?.[0]?.tracking_no;
    setMessage(trackingNo ? 'ส่งเรื่องสำเร็จ เลขติดตาม: ' + trackingNo : 'ส่งเรื่องสำเร็จ');
    e.currentTarget.reset();
    setPhotoFile(null);
  }

  async function doTrack() {
    setFound(null);
    setTrackMessage('');

    if (!tracking.trim()) {
      setTrackMessage('กรุณากรอกเลขติดตาม');
      return;
    }

    if (demo || !supabase) {
      const item = items.find((x) => x.tracking_no.toUpperCase() === tracking.trim().toUpperCase()) || null;
      setFound(item);
      if (!item) setTrackMessage('ไม่พบรายการ กรุณาตรวจสอบเลขติดตาม');
      return;
    }

    const { data, error } = await supabase.rpc('track_incident', {
      p_tracking_no: tracking.trim(),
      p_phone_last4: phoneLast4.trim(),
    });

    if (error) {
      setTrackMessage('ไม่สามารถตรวจสอบสถานะได้ในขณะนี้');
      return;
    }

    const item = data?.[0] || null;
    setFound(item);
    if (!item) setTrackMessage('ไม่พบรายการ หรือ 4 หลักท้ายของเบอร์โทรไม่ตรง');
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
          <div>
            <div className="brand">เทศบาลตำบลบ่อหลวง · Municipal One Stop</div>
            <div className="sub">แจ้งเหตุ · ติดตามงาน · ศูนย์งานเจ้าหน้าที่</div>
          </div>
          <nav className="nav">
            {([
              ['citizen', 'ประชาชน'],
              ['track', 'ติดตามเรื่อง'],
              ['staff', 'เจ้าหน้าที่'],
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
                      <input id="village-input" name="village" placeholder="เช่น หมู่ 3" />
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
                      document.getElementById('village-input')?.focus();
                      document.getElementById('village-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  >
                    📍 ระบุตำแหน่งและหมู่บ้าน
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

      <footer className="footer">Bo Luang Municipal Web · R2 Auth + Supabase</footer>
    </div>
  );
}
