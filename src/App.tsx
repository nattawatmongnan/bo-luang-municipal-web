import { FormEvent, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './lib/supabase';
import { isInsideBoLuang } from './boLuangBoundary';
import PWAInstall from './PWAInstall';
import { LanguageSwitcher, localizeCategory, localizeRole, localizeStatus, localizeSystemNote, localizeVillage, useI18n } from './i18n';

type SpeechRecognitionEventLike = Event & {
  results: {
    [index: number]: {
      [index: number]: { transcript: string };
      isFinal?: boolean;
    };
    length: number;
  };
};

type SpeechRecognitionErrorEventLike = Event & { error?: string };

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const LocationPicker = lazy(() => import('./LocationPicker'));
const GISDashboard = lazy(() => import('./GISDashboard'));
const CareTrackerDemo = lazy(() => import('./CareTrackerDemo'));
const CareTrackerDemoAlerts = lazy(() => import('./CareTrackerDemoAlerts'));

type Page = 'citizen' | 'track' | 'staff' | 'gis' | 'care-demo' | 'executive';
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
  resolution_photo_url?: string | null;
  resolution_photo_added_at?: string | null;
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

const staffRoles: AppRole[] = ['staff', 'department', 'executive', 'admin'];
const writableRoles: AppRole[] = ['staff', 'department', 'admin'];

function makeTracking() {
  const y = new Date().getFullYear() + 543;
  return 'BLM-' + y + '-' + crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
}

export default function App() {
  const { language, t, locale } = useI18n();
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
  const [adminProfiles, setAdminProfiles] = useState<Profile[]>([]);
  const [adminProfilesLoading, setAdminProfilesLoading] = useState(false);
  const [adminProfileMessage, setAdminProfileMessage] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [resolutionFiles, setResolutionFiles] = useState<Record<string, File | null>>({});
  const [resolutionUploadingId, setResolutionUploadingId] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [gpsMessage, setGpsMessage] = useState('');
  const [voiceAssistEnabled, setVoiceAssistEnabled] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [listeningField, setListeningField] = useState<'title' | 'description' | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const demo = !supabaseConfigured || import.meta.env.VITE_DEMO_MODE === 'true';

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

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
      setAuthMessage(t('profileMissing'));
      setStaffLoading(false);
      return;
    }

    const nextProfile = profileData as Profile;
    setProfile(nextProfile);

    if (!staffRoles.includes(nextProfile.role)) {
      setItems([]);
      setAuthMessage(t('staffDenied'));
      setStaffLoading(false);
      return;
    }

    const { data: incidents, error } = await supabase
      .from('municipal_incidents')
      .select('id,tracking_no,category,title,description,village,house_number,urgency,status,created_at,assigned_department,public_note,photo_url,resolution_photo_url,resolution_photo_added_at')
      .order('created_at', { ascending: false });

    if (error) {
      setItems([]);
      setAuthMessage(t('incidentsLoadFail'));
    } else {
      setItems((incidents || []) as Incident[]);
    }

    if (nextProfile.role === 'admin') {
      await loadAdminProfiles();
    } else {
      setAdminProfiles([]);
    }

    setStaffLoading(false);
  }

  async function loadAdminProfiles() {
    if (!supabase) return;
    setAdminProfilesLoading(true);
    setAdminProfileMessage('');

    const { data, error } = await supabase
      .from('profiles')
      .select('id,display_name,role,department')
      .order('display_name', { ascending: true, nullsFirst: false });

    if (error) {
      setAdminProfiles([]);
      setAdminProfileMessage(t('profilesLoadFail'));
    } else {
      setAdminProfiles((data || []) as Profile[]);
    }

    setAdminProfilesLoading(false);
  }

  async function saveAdminProfile(item: Profile) {
    if (!supabase || profile?.role !== 'admin') return;

    setAdminProfileMessage('');
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: item.display_name?.trim() || null,
        role: item.role,
        department: item.department?.trim() || null,
      })
      .eq('id', item.id);

    if (error) {
      setAdminProfileMessage(t('roleSaveFail'));
      return;
    }

    setAdminProfileMessage(t('roleSaved'));
    await loadAdminProfiles();
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
      setAuthMessage(t('loginFail'));
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
            : status === 'VERIFYING'
              ? 'เจ้าหน้าที่กำลังตรวจสอบ'
              : 'เจ้าหน้าที่อัปเดตสถานะ';

    const assignedDepartment =
      status === 'IN_PROGRESS' && !incident.assigned_department
        ? profile.department || 'เจ้าหน้าที่เทศบาล'
        : incident.assigned_department || null;

    setAuthMessage(t('statusUpdating'));

    const { error } = await supabase.rpc('update_incident_status', {
      p_incident_id: incident.id,
      p_status: status,
      p_public_note: note,
      p_assigned_department: assignedDepartment,
    });

    if (error) {
      setAuthMessage(t('statusUpdateFail'));
      return;
    }

    setAuthMessage(t('statusUpdated'));
    await loadProfileAndIncidents(session.user.id);
  }

  async function openEvidence(path: string) {
    if (!supabase) return;
    const { data, error } = await supabase.storage
      .from('incident-attachments')
      .createSignedUrl(path, 60);

    if (error || !data?.signedUrl) {
      setAuthMessage(t('evidenceOpenFail'));
      return;
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function uploadResolutionPhoto(incident: Incident) {
    if (!supabase || !session || !profile || !writableRoles.includes(profile.role)) return;

    const file = resolutionFiles[incident.id];
    if (!file) {
      setAuthMessage(t('chooseAfterPhoto'));
      return;
    }

    const allowedTypes: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = allowedTypes[file.type];

    if (!extension) {
      setAuthMessage(t('fileTypeError'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAuthMessage(t('fileSizeError'));
      return;
    }

    setResolutionUploadingId(incident.id);
    setAuthMessage(t('afterPhotoUploading'));

    const newPath = `staff-resolution/${incident.id}/${crypto.randomUUID()}.${extension}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('incident-attachments')
        .upload(newPath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        setAuthMessage(t('afterPhotoUploadFail'));
        return;
      }

      const { error: saveError } = await supabase.rpc('set_resolution_photo', {
        p_incident_id: incident.id,
        p_photo_path: newPath,
      });

      if (saveError) {
        await supabase.storage.from('incident-attachments').remove([newPath]);
        setAuthMessage(t('afterPhotoSaveFail'));
        return;
      }

      if (incident.resolution_photo_url && incident.resolution_photo_url !== newPath) {
        await supabase.storage
          .from('incident-attachments')
          .remove([incident.resolution_photo_url]);
      }

      setResolutionFiles((current) => ({ ...current, [incident.id]: null }));
      setAuthMessage(t('afterPhotoSaved'));
      await loadProfileAndIncidents(session.user.id);
    } catch {
      setAuthMessage(t('afterPhotoUploadFail'));
    } finally {
      setResolutionUploadingId(null);
    }
  }

  function speakText(text: string) {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setVoiceStatus(t('speechUnsupported'));
      return;
    }

    const synth = window.speechSynthesis;
    const targetLocale = language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-US';

    const speak = (retry = false) => {
      synth.cancel();

      const voices = synth.getVoices();
      const targetPrefix = targetLocale.slice(0, 2).toLowerCase();
      const preferredVoice =
        voices.find((voice) => voice.lang.toLowerCase() === targetLocale.toLowerCase()) ||
        voices.find((voice) => voice.lang.toLowerCase().startsWith(targetPrefix));

      if (!preferredVoice && voices.length === 0 && !retry) {
        window.setTimeout(() => speak(true), 250);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = targetLocale;
      utterance.rate = language === 'th' ? 0.88 : 0.92;
      utterance.pitch = 1;

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      } else if (language === 'th') {
        setVoiceStatus('กำลังใช้เสียงภาษาไทยของอุปกรณ์ หากไม่ได้ยินเสียง กรุณาเปิดเสียงภาษาไทยในการตั้งค่าเครื่อง');
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        if (language === 'th' && preferredVoice) {
          setVoiceStatus('🔊 กำลังอ่านเป็นภาษาไทย');
        }
      };
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => {
        setIsSpeaking(false);
        setVoiceStatus(
          language === 'th'
            ? 'ไม่พบเสียงภาษาไทยในอุปกรณ์นี้ กรุณาเปิดหรือติดตั้งเสียงภาษาไทยในการตั้งค่าเครื่อง'
            : t('speechError'),
        );
      };

      synth.speak(utterance);
    };

    speak();
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  function toggleVoiceAssist() {
    const next = !voiceAssistEnabled;
    setVoiceAssistEnabled(next);
    stopSpeaking();
    setVoiceStatus(next ? t('voiceAssistOn') : t('voiceAssistOff'));
    if (next) {
      window.setTimeout(() => speakText(t('voiceGuideSpeech')), 80);
    }
  }

  function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
  }

  function startVoiceInput(field: 'title' | 'description') {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setVoiceStatus(t('speechUnsupported'));
      speakText(t('speechUnsupported'));
      return;
    }

    stopSpeaking();
    const recognition = new Recognition();
    recognition.lang = locale;
    recognition.interimResults = false;
    recognition.continuous = false;
    setListeningField(field);
    setVoiceStatus(t('listening'));

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || '';
      const targetId = field === 'title' ? 'title-input' : 'description-input';
      const target = document.getElementById(targetId) as HTMLInputElement | HTMLTextAreaElement | null;
      if (target && transcript) {
        const setter = Object.getOwnPropertyDescriptor(
          target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
          'value',
        )?.set;
        setter?.call(target, transcript);
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.focus();
      }
      setVoiceStatus(transcript || t('speechError'));
    };
    recognition.onerror = () => {
      setVoiceStatus(t('speechError'));
      setListeningField(null);
    };
    recognition.onend = () => setListeningField(null);

    try {
      recognition.start();
    } catch {
      setVoiceStatus(t('speechError'));
      setListeningField(null);
    }
  }

  function readFormSummary() {
    const form = document.getElementById('citizen-report-form') as HTMLFormElement | null;
    if (!form) return;

    const data = new FormData(form);
    const category = String(data.get('category') || '');
    const village = String(data.get('village') || '');
    const urgency = String(data.get('urgency') || '');
    const title = String(data.get('title') || '').trim();
    const description = String(data.get('description') || '').trim();

    const parts = [
      t('summaryIntro'),
      `${t('summaryCategory')}: ${localizeCategory(category, language)}`,
      `${t('summaryVillage')}: ${village ? localizeVillage(village, language) : t('chooseVillage')}`,
      `${t('summaryUrgency')}: ${urgency === 'LOW' ? t('low') : urgency === 'HIGH' ? t('high') : t('medium')}`,
      `${t('summaryTitle')}: ${title || t('summaryMissing')}`,
      `${t('summaryDescription')}: ${description || t('summaryMissing')}`,
      locationConfirmed ? t('summaryLocationReady') : t('summaryLocationMissing'),
    ];

    speakText(parts.join('. '));
  }

  function openManualLocationPicker() {
    setMapPickerOpen(true);
    setLocationConfirmed(false);
    setGpsMessage(t('pinPrompt'));
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
      setCopyStatus(t('copyDone'));
    } catch {
      setCopyStatus(t('copyFail'));
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
    if (!payload.village) errors.village = t('chooseVillageError');
    if (payload.title.length < 3) errors.title = t('titleError');
    if (payload.description.length < 3) errors.description = t('descriptionError');

    const phoneDigits = payload.reporter_phone.replace(/\D/g, '');
    if (payload.reporter_phone && (phoneDigits.length < 9 || phoneDigits.length > 10)) {
      errors.phone = t('phoneError');
    }

    if (lat === null || lng === null) {
      errors.location = t('locationRequired');
    } else if (!isInsideBoLuang(lat, lng)) {
      errors.location = t('outsideBoundary');
    } else if (!locationConfirmed) {
      errors.location = t('pinNotConfirmed');
    }

    if (photoFile) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(photoFile.type)) {
        errors.photo = t('fileTypeError');
      } else if (photoFile.size > 5 * 1024 * 1024) {
        errors.photo = t('fileSizeError');
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
      setMessage(t('formCheck'));
      focusProblem(firstProblem);
      return;
    }

    if (demo || !supabase) {
      setMessage(t('demoNoSubmit'));
      return;
    }

    setSubmitting(true);
    let photoPath: string | null = null;

    try {
      if (photoFile) {
        const uploadBody = new FormData();
        uploadBody.append('action', 'upload');
        uploadBody.append('file', photoFile);

        const { data: uploadData, error: uploadError } = await supabase.functions.invoke('public-api', {
          body: uploadBody,
        });

        if (uploadError || !uploadData?.ok || !uploadData?.result?.path) {
          const uploadCode = uploadData?.code;
          setFormErrors({
            photo:
              uploadCode === 'RATE_LIMITED'
                ? t('uploadRate')
                : uploadCode === 'FILE_TOO_LARGE'
                  ? t('fileSizeError')
                  : uploadCode === 'INVALID_FILE_TYPE'
                    ? t('fileTypeError')
                    : t('uploadFail'),
          });
          setMessage(t('uploadFailKeep'));
          focusProblem('photo-input');
          return;
        }

        photoPath = uploadData.result.path;
      }

      const { data, error } = await supabase.functions.invoke('public-api', {
        body: {
          action: 'submit',
          payload: {
            category: payload.category,
            title: payload.title,
            description: payload.description,
            village: payload.village,
            house_number: payload.house_number || null,
            reporter_name: payload.reporter_name || null,
            reporter_phone: payload.reporter_phone || null,
            urgency: payload.urgency,
            photo_path: photoPath,
            lat,
            lng,
            location_confirmed: true,
          },
        },
      });

      if (error) {
        setMessage(t('serviceConnectFail'));
        return;
      }

      if (!data?.ok) {
        if (data?.code === 'RATE_LIMITED') {
          setMessage(t('submitRate'));
        } else if (data?.code === 'OUTSIDE_BOLUANG') {
          setFormErrors({ location: t('serverOutside') });
          setMessage(t('submitLocationFail'));
          focusProblem('manual-location-picker');
        } else if (data?.code === 'LOCATION_NOT_CONFIRMED') {
          setFormErrors({ location: t('confirmBeforeSubmit') });
          setMessage(t('notConfirmed'));
          focusProblem('manual-location-picker');
        } else {
          setMessage(t('submitFail'));
        }
        return;
      }

      const trackingNo = data?.result?.tracking_no;
      if (!trackingNo) {
        setMessage(t('noTrackingReturned'));
        return;
      }

      setLastTrackingNo(trackingNo);
      setMessage(t('submitSuccess'));
      setFormErrors({});
      e.currentTarget.reset();
      setPhotoFile(null);
      setLat(null);
      setLng(null);
      setLocationConfirmed(false);
      setMapPickerOpen(false);
      setGpsMessage('');
    } catch {
      setMessage(t('networkKeep'));
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
      setTrackMessage(t('trackingRequired'));
      focusProblem('tracking-input');
      return;
    }

    if (last4 && !/^\d{4}$/.test(last4)) {
      setTrackMessage(t('last4Error'));
      focusProblem('tracking-phone-input');
      return;
    }

    if (demo || !supabase) {
      setTrackMessage(t('demoNoTrack'));
      return;
    }

    setTrackingLoading(true);
    setTrackMessage(t('searching'));

    try {
      const { data, error } = await supabase.functions.invoke('public-api', {
        body: {
          action: 'track',
          payload: {
            tracking_no: trackingNo,
            phone_last4: last4,
          },
        },
      });

      if (error) {
        setTrackMessage(t('networkFail'));
        return;
      }

      if (!data?.ok) {
        setTrackMessage(
          data?.code === 'RATE_LIMITED'
            ? t('trackRate')
            : t('trackSystemFail'),
        );
        return;
      }

      const item = data?.result || null;
      setFound(item);
      setTrackMessage(
        item
          ? ''
          : t('trackNotFound'),
      );
    } catch {
      setTrackMessage(t('networkFail'));
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
            <img src="/icons/bo-luang-icon.svg" alt={t('brand')} className="brand-logo" />
            <div>
              <div className="brand">{t('brand')}</div>
              <div className="brand-en">BO-LUANG T CARE</div>
              <div className="sub">{t('brandSub')}</div>
            </div>
          </div>
          <div className="top-actions">
            <LanguageSwitcher />
            <nav className="nav">
            {([
              ['citizen', t('citizen')],
              ['track', t('track')],
              ['staff', t('staff')],
              ['gis', 'GIS Live'],
              ['care-demo', language === 'th' ? 'Care Tracker ทดลอง' : language === 'zh' ? 'Care Tracker 演示' : 'Care Tracker Demo'],
              ['executive', t('executive')],
            ] as [Page, string][]).map(([p, l]) => (
              <button className={page === p ? 'active' : ''} onClick={() => setPage(p)} key={p}>
                {l}
              </button>
            ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="wrap">
        {demo && (
          <div className="notice">
            {t('demo')}
          </div>
        )}

        {page === 'citizen' && (
          <>
            <section className="hero">
              <h1>{t('reportHero')}</h1>
              <p>{t('reportHeroDesc')}</p>
              <span className="emergency">
                {t('emergency')}
              </span>
            </section>

            <div className="grid">
              <section className="card citizen-form-card">
                <h2>{t('reportForm')}</h2>
                <div className={voiceAssistEnabled ? 'voice-assist-panel active' : 'voice-assist-panel'}>
                  <div className="voice-assist-head">
                    <div>
                      <b>🔊 {t('voiceAssist')}</b>
                      <p className="muted">{t('voiceGuide')}</p>
                    </div>
                    <button
                      className={voiceAssistEnabled ? 'btn primary voice-toggle' : 'btn secondary voice-toggle'}
                      type="button"
                      aria-pressed={voiceAssistEnabled}
                      onClick={toggleVoiceAssist}
                    >
                      {voiceAssistEnabled ? '✓ ' + t('voiceAssistOn') : t('voiceAssist')}
                    </button>
                  </div>
                  {voiceAssistEnabled && (
                    <>
                      <div className="row voice-actions">
                        <button className="btn secondary" type="button" onClick={() => speakText(t('voiceGuideSpeech'))}>
                          {t('readPage')}
                        </button>
                        {isSpeaking && (
                          <button className="btn secondary" type="button" onClick={stopSpeaking}>
                            {t('stopReading')}
                          </button>
                        )}
                        <button className="btn secondary" type="button" onClick={readFormSummary}>
                          {t('readSummary')}
                        </button>
                      </div>
                      {voiceStatus && <div className="voice-status" role="status" aria-live="polite">{voiceStatus}</div>}
                    </>
                  )}
                </div>
                <form id="citizen-report-form" onSubmit={submit}>
                  <div className="grid">
                    <label className="field">
                      {t('category')}
                      <select name="category">
                        {['ถนน','ไฟส่องสว่าง','ขยะ','น้ำประปา','น้ำท่วม','สัตว์รบกวน','ความปลอดภัย','อื่นๆ'].map((value) => (
                          <option value={value} key={value}>{localizeCategory(value, language)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      {t('village')}
                      <select
                        id="village-input"
                        name="village"
                        defaultValue=""
                        required
                        aria-invalid={Boolean(formErrors.village)}
                        aria-describedby={formErrors.village ? 'village-error' : undefined}
                      >
                        <option value="" disabled>{t('chooseVillage')}</option>
                        <option value="หมู่ที่ 1 บ้านบ่อหลวง">{localizeVillage('หมู่ที่ 1 บ้านบ่อหลวง', language)}</option>
                        <option value="หมู่ที่ 2 บ้านวังกอง">{localizeVillage('หมู่ที่ 2 บ้านวังกอง', language)}</option>
                        <option value="หมู่ที่ 3 บ้านขุน">{localizeVillage('หมู่ที่ 3 บ้านขุน', language)}</option>
                        <option value="หมู่ที่ 4 บ้านนาฟ่อน">{localizeVillage('หมู่ที่ 4 บ้านนาฟ่อน', language)}</option>
                        <option value="หมู่ที่ 5 บ้านแม่ลายเหนือ (รวมบ้านแม่ลายใต้)">{localizeVillage('หมู่ที่ 5 บ้านแม่ลายเหนือ (รวมบ้านแม่ลายใต้)', language)}</option>
                        <option value="หมู่ที่ 6 บ้านแม่ลายใต้ / บ้านพุย (บางส่วน)">{localizeVillage('หมู่ที่ 6 บ้านแม่ลายใต้ / บ้านพุย (บางส่วน)', language)}</option>
                        <option value="หมู่ที่ 7 บ้านพุย / บ้านกิ่วลม">{localizeVillage('หมู่ที่ 7 บ้านพุย / บ้านกิ่วลม', language)}</option>
                        <option value="หมู่ที่ 8 บ้านกิ่วลม / บ้านเตียนอาง">{localizeVillage('หมู่ที่ 8 บ้านกิ่วลม / บ้านเตียนอาง', language)}</option>
                        <option value="หมู่ที่ 9 บ้านแม่สะนาม">{localizeVillage('หมู่ที่ 9 บ้านแม่สะนาม', language)}</option>
                        <option value="หมู่ที่ 10 บ้านเตียนอาง">{localizeVillage('หมู่ที่ 10 บ้านเตียนอาง', language)}</option>
                        <option value="หมู่ที่ 11 บ้านบ่อสะแง๋">{localizeVillage('หมู่ที่ 11 บ้านบ่อสะแง๋', language)}</option>
                        <option value="หมู่ที่ 12 บ้านบ่อพะแวน (ที่ตั้งสำนักงานเทศบาลตำบลบ่อหลวง)">{localizeVillage('หมู่ที่ 12 บ้านบ่อพะแวน (ที่ตั้งสำนักงานเทศบาลตำบลบ่อหลวง)', language)}</option>
                        <option value="หมู่ที่ 13 บ้านแม่หืด">{localizeVillage('หมู่ที่ 13 บ้านแม่หืด', language)}</option>
                      </select>
                      {formErrors.village && <span id="village-error" className="field-error" role="alert">{formErrors.village}</span>}
                    </label>
                    <label className="field">
                      {t('urgency')}
                      <select name="urgency">
                        <option value="LOW">{t('low')}</option>
                        <option value="MEDIUM">{t('medium')}</option>
                        <option value="HIGH">{t('high')}</option>
                      </select>
                    </label>
                  </div>

                  <label className="field" htmlFor="title-input">
                    {t('title')}
                    <input
                      id="title-input"
                      name="title"
                      placeholder={t('titlePh')}
                      aria-invalid={Boolean(formErrors.title)}
                      aria-describedby={formErrors.title ? 'title-error' : undefined}
                    />
                    {voiceAssistEnabled && (
                      <button
                        className="btn secondary voice-field-button"
                        type="button"
                        onClick={() => startVoiceInput('title')}
                        disabled={listeningField !== null}
                      >
                        {listeningField === 'title' ? t('listening') : t('speakTitle')}
                      </button>
                    )}
                    {formErrors.title && <span id="title-error" className="field-error" role="alert">{formErrors.title}</span>}
                  </label>

                  <label className="field" htmlFor="description-input">
                    {t('description')}
                    <textarea
                      id="description-input"
                      name="description"
                      placeholder={t('descriptionPh')}
                      aria-invalid={Boolean(formErrors.description)}
                      aria-describedby={formErrors.description ? 'description-error' : undefined}
                    />
                    {voiceAssistEnabled && (
                      <button
                        className="btn secondary voice-field-button"
                        type="button"
                        onClick={() => startVoiceInput('description')}
                        disabled={listeningField !== null}
                      >
                        {listeningField === 'description' ? t('listening') : t('speakDescription')}
                      </button>
                    )}
                    {formErrors.description && <span id="description-error" className="field-error" role="alert">{formErrors.description}</span>}
                  </label>

                  <div className="grid">
                    <label className="field">
                      {t('house')}
                      <input name="house" />
                    </label>
                    <label className="field">
                      {t('reporter')}
                      <input name="name" />
                    </label>
                    <label className="field" htmlFor="phone-input">
                      {t('phone')}
                      <input
                        id="phone-input"
                        name="phone"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="เช่น 0812345678"
                        aria-invalid={Boolean(formErrors.phone)}
                        aria-describedby={formErrors.phone ? 'phone-error phone-help' : 'phone-help'}
                      />
                      <span id="phone-help" className="muted">{t('phoneHelp')}</span>
                      {formErrors.phone && <span id="phone-error" className="field-error" role="alert">{formErrors.phone}</span>}
                    </label>
                  </div>

                  <div className="field" id="manual-location-picker">
                    <span>{t('incidentLocation')}</span>
                    <p className="muted location-instruction">
                      {t('mapInstruction')}
                    </p>
                    <div className="row">
                      <button className="btn secondary" type="button" onClick={openManualLocationPicker}>
                        {t('openMap')}
                      </button>
                      {lat !== null && lng !== null && (
                        <span className={locationConfirmed ? 'location-state confirmed' : 'location-state selected'}>
                          {locationConfirmed ? t('confirmedPin') : t('selectedPin')} · {lat.toFixed(6)}, {lng.toFixed(6)}
                        </span>
                      )}
                    </div>
                    {gpsMessage && <span className="muted" aria-live="polite">{gpsMessage}</span>}
                    {formErrors.location && <span className="field-error" role="alert">{formErrors.location}</span>}

                    {mapPickerOpen && (
                      <div className="location-picker-wrap">
                        <Suspense fallback={<div className="map-loading">{t('mapLoadingShort')}</div>}>
                          <LocationPicker
                            lat={lat}
                            lng={lng}
                            onChange={(nextLat, nextLng) => {
                              setLat(nextLat);
                              setLng(nextLng);
                              setLocationConfirmed(false);
                              setGpsMessage(t('pinPlaced'));
                            }}
                            onOutside={() => {
                              setLocationConfirmed(false);
                              setGpsMessage(t('outsideMunicipality'));
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
                                setGpsMessage(t('tapPinFirst'));
                                return;
                              }
                              setLocationConfirmed(true);
                              setGpsMessage(t('pinReady'));
                            }}
                          >
                            {locationConfirmed ? t('confirmedPin') : t('confirmPin')}
                          </button>
                          <button
                            className="btn secondary"
                            type="button"
                            onClick={() => {
                              setLat(null);
                              setLng(null);
                              setLocationConfirmed(false);
                              setGpsMessage(t('pinCleared'));
                            }}
                          >
                            {t('clearPin')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <label className="field">
                    {t('evidence')}
                    <input
                      id="photo-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      aria-invalid={Boolean(formErrors.photo)}
                      aria-describedby={formErrors.photo ? 'photo-error photo-help' : 'photo-help'}
                      onChange={(e) => {
                        setPhotoFile(e.target.files?.[0] || null);
                        setFormErrors((current) => {
                          const next = { ...current };
                          delete next.photo;
                          return next;
                        });
                      }}
                    />
                    <span id="photo-help" className="muted">{t('evidenceHelp')}</span>
                    {formErrors.photo && <span id="photo-error" className="field-error" role="alert">{formErrors.photo}</span>}
                  </label>

                  <div className="privacy-note">
                    <b>{t('dataUse')}:</b> {t('dataUseText')}
                  </div>

                  <button className="btn primary submit-button" disabled={submitting}>
                    {submitting ? t('submitting') : t('submit')}
                  </button>
                </form>

                {message && (
                  <div
                    className={'notice ' + (lastTrackingNo ? 'ok' : '')}
                    style={{ marginTop: 14 }}
                    role={lastTrackingNo ? 'status' : 'alert'}
                    aria-live="polite"
                  >
                    <div>{message}</div>
                    {lastTrackingNo && (
                      <div className="tracking-success">
                        <strong>{t('trackingNo')}: <span className="tracking-code">{lastTrackingNo}</span></strong>
                        <button className="btn secondary" type="button" onClick={() => void copyTrackingNumber()}>
                          {t('copyTracking')}
                        </button>
                        {copyStatus && <span className="muted">{copyStatus}</span>}
                      </div>
                    )}
                  </div>
                )}
              </section>

              <aside className="card">
                <h3>{t('mainServices')}</h3>
                <div className="list">
                  <button
                    className="item service-button"
                    type="button"
                    onClick={() => {
                      openManualLocationPicker();
                    }}
                  >
                    {t('servicePin')}
                  </button>
                  <button
                    className="item service-button"
                    type="button"
                    onClick={() => document.getElementById('photo-input')?.click()}
                  >
                    {t('servicePhoto')}
                  </button>
                  <button className="item service-button" type="button" onClick={() => setPage('track')}>
                    {t('serviceTrack')}
                  </button>
                  <button className="item service-button" type="button" onClick={() => setPage('staff')}>
                    {t('serviceLogin')}
                  </button>
                </div>
              </aside>
            </div>
          </>
        )}

        {page === 'track' && (
          <section className="card track-card">
            <h2>{t('trackTitle')}</h2>
            <p className="muted">
              {t('trackHelp')}
            </p>
            <form className="track-form" onSubmit={doTrack}>
              <label className="field" htmlFor="tracking-input">
                {t('trackingNo')}
                <input
                  id="tracking-input"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value.toUpperCase())}
                  autoComplete="off"
                  placeholder="ตัวอย่าง BLM-2569-XXXXXXXXXX"
                  required
                />
              </label>
              <label className="field" htmlFor="tracking-phone-input">
                {t('phoneLast4')}
                <input
                  id="tracking-phone-input"
                  value={phoneLast4}
                  onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  autoComplete="off"
                />
              </label>
              <button className="btn primary" type="submit" disabled={trackingLoading}>
                {trackingLoading ? t('searching') : t('search')}
              </button>
            </form>

            {trackMessage && (
              <div
                className={trackingLoading ? 'muted track-message' : 'notice track-message'}
                role={trackingLoading ? 'status' : 'alert'}
                aria-live="polite"
              >
                {trackMessage}
              </div>
            )}

            {found && (
              <div className="item" style={{ marginTop: 16 }} aria-live="polite">
                <b>{found.title}</b>
                <p>{found.tracking_no}</p>
                <span className="status">{localizeStatus(found.status, language)}</span>
                <p>{t('area')}: {localizeVillage(found.village, language)}</p>
                <p>{found.public_note ? localizeSystemNote(found.public_note, language) : t('noUpdate')}</p>
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
                  <div><b>{t('brand')}</b><span>BO-LUANG T CARE</span></div>
                </div>
                <h2>{t('staffLogin')}</h2>
                <p className="muted">{t('staffAccount')}</p>
                <form onSubmit={handleLogin}>
                  <label className="field">
                    {t('email')}
                    <input type="email" name="email" autoComplete="username" required />
                  </label>
                  <label className="field">
                    {t('password')}
                    <input type="password" name="password" autoComplete="current-password" required />
                  </label>
                  <button className="btn primary" disabled={authLoading}>
                    {authLoading ? t('loggingIn') : t('login')}
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
                      <h1>{t('staffCenter')}</h1>
                      {profile && (
                        <p>
                          {profile.display_name || t('staffDefault')} · {localizeRole(profile.role, language)}
                          {profile.department ? ' · ' + profile.department : ''}
                        </p>
                      )}
                    </div>
                    {!demo && session && (
                      <div className="row">
                        <button className="btn secondary" onClick={() => setShowClosed((value) => !value)}>
                          {showClosed ? t('hideClosed') : `${t('viewClosed')} (${closedCount})`}
                        </button>
                        <button className="btn secondary" onClick={() => void loadProfileAndIncidents(session.user.id)}>
                          {t('refresh')}
                        </button>
                        <button className="btn danger" onClick={() => void handleLogout()}>
                          {t('logout')}
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                {authMessage && <div className="notice">{authMessage}</div>}

                {staffLoading && <div className="card">{t('loading')}</div>}

                {!demo && !staffLoading && session && canViewStaff && (
                  <Suspense fallback={<div className="card map-loading">Loading Care Tracker alerts...</div>}>
                    <CareTrackerDemoAlerts />
                  </Suspense>
                )}

                {!staffLoading && profile?.role === 'admin' && (
                  <section className="card admin-profile-card">
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h2>{t('adminRoles')}</h2>
                        <p className="muted">{t('adminRolesHelp')}</p>
                      </div>
                      <button className="btn secondary" type="button" onClick={() => void loadAdminProfiles()}>
                        {t('refreshAccounts')}
                      </button>
                    </div>

                    {adminProfileMessage && <div className="notice" aria-live="polite">{adminProfileMessage}</div>}
                    {adminProfilesLoading && <div className="muted">{t('accountsLoading')}</div>}

                    {!adminProfilesLoading && (
                      <div className="admin-profile-list">
                        {adminProfiles.map((account) => (
                          <div className="admin-profile-row" key={account.id}>
                            <label className="field">
                              {t('displayName')}
                              <input
                                value={account.display_name || ''}
                                onChange={(e) => setAdminProfiles((current) => current.map((p) =>
                                  p.id === account.id ? { ...p, display_name: e.target.value } : p
                                ))}
                              />
                            </label>
                            <label className="field">
                              {t('role')}
                              <select
                                value={account.role}
                                disabled={account.id === session?.user.id}
                                onChange={(e) => setAdminProfiles((current) => current.map((p) =>
                                  p.id === account.id ? { ...p, role: e.target.value as AppRole } : p
                                ))}
                              >
                                <option value="citizen">{localizeRole('citizen', language)}</option>
                                <option value="staff">{localizeRole('staff', language)}</option>
                                <option value="department">{localizeRole('department', language)}</option>
                                <option value="executive">{localizeRole('executive', language)}</option>
                                <option value="admin">{localizeRole('admin', language)}</option>
                              </select>
                              {account.id === session?.user.id && <span className="muted">{t('selfRoleLock')}</span>}
                            </label>
                            <label className="field">
                              {t('department')}
                              <input
                                value={account.department || ''}
                                onChange={(e) => setAdminProfiles((current) => current.map((p) =>
                                  p.id === account.id ? { ...p, department: e.target.value } : p
                                ))}
                                placeholder={t('departmentPlaceholder')}
                              />
                            </label>
                            <button className="btn primary" type="button" onClick={() => void saveAdminProfile(account)}>
                              {t('save')}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {!staffLoading && canViewStaff && (
                  <div className="list">
                    {activeStaffItems.length === 0 && (
                      <div className="card">{showClosed ? t('noClosed') : t('noOpen')}</div>
                    )}
                    {activeStaffItems.map((i) => (
                      <div className="item" key={i.id}>
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                          <div>
                            <b>{i.title}</b>
                            <div className="muted">
                              {i.tracking_no} · {localizeVillage(i.village, language)} · {localizeCategory(i.category, language)}
                            </div>
                          </div>
                          <span className="status">{localizeStatus(i.status, language)}</span>
                        </div>

                        <p>{i.description}</p>

                        {i.assigned_department && (
                          <p className="muted">{t('department')}: {i.assigned_department}</p>
                        )}

                        <section className="before-after-block">
                          <h3>{t('beforeAfterTitle')}</h3>
                          <div className="before-after-grid">
                            <div className="evidence-card">
                              <b>{t('beforePhoto')}</b>
                              {i.photo_url ? (
                                <button className="btn secondary" type="button" onClick={() => void openEvidence(i.photo_url!)}>
                                  {t('openEvidence')}
                                </button>
                              ) : (
                                <span className="muted">{t('noBeforePhoto')}</span>
                              )}
                            </div>

                            <div className="evidence-card">
                              <b>{t('afterPhoto')}</b>
                              {i.resolution_photo_url ? (
                                <>
                                  <button className="btn secondary" type="button" onClick={() => void openEvidence(i.resolution_photo_url!)}>
                                    {t('openEvidence')}
                                  </button>
                                  {i.resolution_photo_added_at && (
                                    <span className="muted">
                                      {t('photoAddedAt')}: {new Date(i.resolution_photo_added_at).toLocaleString(locale)}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="muted">{t('noAfterPhoto')}</span>
                              )}

                              {canWrite && (
                                <div className="resolution-upload">
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    aria-label={t('afterPhoto')}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] || null;
                                      setResolutionFiles((current) => ({ ...current, [i.id]: file }));
                                    }}
                                  />
                                  <span className="muted">{t('afterPhotoHelp')}</span>
                                  <button
                                    className="btn primary"
                                    type="button"
                                    disabled={resolutionUploadingId === i.id}
                                    onClick={() => void uploadResolutionPhoto(i)}
                                  >
                                    {resolutionUploadingId === i.id
                                      ? t('afterPhotoUploading')
                                      : i.resolution_photo_url
                                        ? t('replaceAfterPhoto')
                                        : t('uploadAfterPhoto')}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </section>

                        {canWrite && (
                          <div className="row">
                            <button className="btn secondary" onClick={() => void updateStatus(i, 'VERIFYING')}>
                              {t('verify')}
                            </button>
                            <button className="btn secondary" onClick={() => void updateStatus(i, 'IN_PROGRESS')}>
                              {t('takeAction')}
                            </button>
                            <button className="btn primary" onClick={() => void updateStatus(i, 'DONE')}>
                              {t('markDone')}
                            </button>
                            <button className="btn secondary" onClick={() => void updateStatus(i, 'CLOSED')}>
                              {t('closeCase')}
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
              <section className="card access-gate">
                <h2>{t('loginFirst')}</h2>
                <p className="muted">{t('gisStaffOnly')}</p>
                <button className="btn primary" type="button" onClick={() => setPage('staff')}>{t('goLogin')}</button>
              </section>
            )}

            {demo && (
              <section className="card">
                <h2>{t('gisNeedsLive')}</h2>
                <p className="muted">{t('disableDemo')}</p>
              </section>
            )}

            {!demo && session && canViewStaff && (
              <>
                <section className="hero">
                  <h1>{t('gisCenter')}</h1>
                  <p>{t('gisRealtime')}</p>
                </section>
                <Suspense fallback={<div className="card map-loading">{t('loadingGis')}</div>}>
                  <GISDashboard userId={session.user.id} canWrite={canWrite} />
                </Suspense>
              </>
            )}

            {!demo && session && !canViewStaff && (
              <div className="notice">{t('noGisPermission')}</div>
            )}
          </>
        )}

        {page === 'care-demo' && (
          <Suspense fallback={<div className="card map-loading">Loading Care Tracker Demo...</div>}>
            <CareTrackerDemo />
          </Suspense>
        )}

        {page === 'executive' && (
          <>
            {!demo && !session && (
              <section className="card access-gate">
                <h2>{t('loginFirst')}</h2>
                <button className="btn primary" type="button" onClick={() => setPage('staff')}>{t('goLogin')}</button>
              </section>
            )}

            {(demo || (session && profile && ['executive', 'admin'].includes(profile.role))) && (
              <>
                <section className="hero">
                  <h1>{t('execDashboard')}</h1>
                  <p>{t('execDesc')}</p>
                </section>
                <div className="grid">
                  <div className="card">
                    <div className="muted">{t('allCases')}</div>
                    <div className="kpi">{stats.all}</div>
                  </div>
                  <div className="card">
                    <div className="muted">{t('activeCases')}</div>
                    <div className="kpi">{stats.active}</div>
                  </div>
                  <div className="card">
                    <div className="muted">{t('doneCases')}</div>
                    <div className="kpi">{stats.done}</div>
                  </div>
                </div>
              </>
            )}

            {!demo && session && profile && !['executive', 'admin'].includes(profile.role) && (
              <div className="notice">{t('noExecPermission')}</div>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <PWAInstall />
        <span className="footer-brand"><img src="/icons/bo-luang-icon.svg" alt="" /> {t('brand')} · BO-LUANG T CARE</span>
      </footer>
    </div>
  );
}
