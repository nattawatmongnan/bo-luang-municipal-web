import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'th' | 'en' | 'zh';

const dictionaries = {
  th: {
    language: 'ภาษา',
    thai: 'ไทย',
    english: 'English',
    chinese: '中文',
    brand: 'เทศบาลตำบลบ่อหลวง',
    brandSub: 'แจ้งเหตุ · ติดตามงาน · GIS Live · ศูนย์งานเจ้าหน้าที่',
    citizen: 'ประชาชน',
    track: 'ติดตามเรื่อง',
    staff: 'เจ้าหน้าที่',
    gis: 'GIS Live',
    executive: 'ผู้บริหาร',
    demo: 'ขณะนี้อยู่ใน Demo mode — ข้อมูลตัวอย่างไม่ได้ใช้แทนฐานข้อมูลเทศบาลจริง',
    reportHero: 'แจ้งเหตุหรือขอความช่วยเหลือ',
    reportHeroDesc: 'ส่งข้อมูลให้เทศบาลพร้อมเลขติดตามเรื่อง ใช้งานได้ทั้งมือถือและคอมพิวเตอร์',
    emergency: 'กรณีฉุกเฉินที่เสี่ยงต่อชีวิต โปรดติดต่อหน่วยฉุกเฉินที่เกี่ยวข้องโดยตรง',
    reportForm: 'แบบฟอร์มแจ้งเหตุ',
    category: 'ประเภท',
    village: 'หมู่บ้าน/หมู่ที่ *',
    chooseVillage: 'เลือกหมู่บ้าน/หมู่ที่',
    urgency: 'ความเร่งด่วน',
    low: 'ทั่วไป',
    medium: 'เร่งด่วนปานกลาง',
    high: 'เร่งด่วน',
    title: 'หัวข้อ *',
    titlePh: 'สรุปเหตุสั้น ๆ',
    description: 'รายละเอียด *',
    descriptionPh: 'อธิบายตำแหน่งและสิ่งที่ต้องการให้ช่วย',
    house: 'บ้านเลขที่',
    reporter: 'ชื่อผู้แจ้ง',
    phone: 'เบอร์โทร (ถ้ามี)',
    phoneHelp: 'กรอกเบอร์โทรเต็ม โดยใช้ 4 หลักท้ายเพื่อยืนยันตอนติดตามเรื่อง',
    incidentLocation: 'ตำแหน่งจุดเกิดเหตุ *',
    mapInstruction: 'เปิดแผนที่ได้ทันที แล้วแตะหรือลากหมุดไปยังจุดเกิดเหตุ จากนั้นกดยืนยันตำแหน่ง',
    openMap: '📍 เปิดแผนที่ปักหมุด',
    selectedPin: '● เลือกหมุดแล้ว ยังไม่ได้ยืนยัน',
    confirmedPin: '✓ ยืนยันตำแหน่งแล้ว',
    confirmPin: 'ยืนยันหมุดตำแหน่งนี้',
    clearPin: 'ล้างหมุด',
    evidence: 'รูปหลักฐาน (ถ้ามี)',
    evidenceHelp: 'JPG, PNG หรือ WebP ไม่เกิน 5 MB',
    submit: 'ส่งเรื่องให้เทศบาล',
    submitting: 'กำลังส่งเรื่อง…',
    dataUse: 'การใช้ข้อมูล',
    dataUseText: 'ระบบจะใช้ชื่อ เบอร์โทร พิกัด และรูปภาพที่คุณกรอก/แนบ เพื่อรับเรื่อง ติดตาม และดำเนินการแจ้งเหตุในระบบนี้ กรุณาใส่เฉพาะข้อมูลที่จำเป็น',
    trackingNo: 'เลขติดตามเรื่อง',
    copyTracking: 'คัดลอกเลขติดตาม',
    trackTitle: 'ติดตามเรื่อง',
    trackHelp: 'ถ้าตอนแจ้งเหตุไม่ได้กรอกเบอร์โทร ใช้เลขติดตามเรื่องอย่างเดียวได้ แต่ถ้ากรอกเบอร์โทรไว้ ต้องกรอก 4 หลักท้ายของเบอร์นั้นเพื่อยืนยัน',
    phoneLast4: 'เบอร์โทร 4 หลักท้าย (กรอกเมื่อเคยระบุเบอร์โทรตอนแจ้งเหตุ)',
    search: 'ค้นหา',
    searching: 'กำลังค้นหา…',
    area: 'พื้นที่',
    noUpdate: 'ยังไม่มีข้อความอัปเดต',
    staffLogin: 'เข้าสู่ระบบเจ้าหน้าที่',
    staffAccount: 'ใช้บัญชีที่เทศบาลออกให้',
    email: 'อีเมล',
    password: 'รหัสผ่าน',
    login: 'เข้าสู่ระบบ',
    loggingIn: 'กำลังเข้าสู่ระบบ...',
    staffCenter: 'ศูนย์งานเจ้าหน้าที่',
    refresh: 'รีเฟรช',
    logout: 'ออกจากระบบ',
    loading: 'กำลังโหลดข้อมูล...',
    goLogin: 'ไปหน้าเข้าสู่ระบบ',
    loginFirst: 'กรุณาเข้าสู่ระบบก่อน',
    gisStaffOnly: 'GIS Live สำหรับเจ้าหน้าที่และผู้บริหารเทศบาล',
    gisCenter: 'GIS Live · ศูนย์เหตุการณ์',
    gisRealtime: 'หมุดเหตุและพื้นที่ฉุกเฉินจะอัปเดตจาก Supabase Realtime โดยอัตโนมัติ',
    loadingGis: 'กำลังโหลด GIS Live...',
    noGisPermission: 'บัญชีนี้ไม่มีสิทธิ์เปิด GIS Live',
    execDashboard: 'Dashboard ผู้บริหาร',
    execDesc: 'สรุปข้อมูลจากรายการที่ผู้ใช้มีสิทธิ์เข้าถึง โดยไม่แสดงข้อมูลติดต่อของผู้แจ้ง',
    allCases: 'เรื่องทั้งหมด',
    activeCases: 'กำลังดำเนินการ',
    doneCases: 'ดำเนินการแล้ว',
    noExecPermission: 'บัญชีนี้ไม่มีสิทธิ์เปิด Dashboard ผู้บริหาร',
    installApp: '📲 ติดตั้งแอป',
    appInstalled: '✓ แอปนี้ติดตั้งแล้ว',
    installing: 'กำลังเปิดหน้าติดตั้ง…',
    installed: 'ติดตั้งแอปเรียบร้อยแล้ว',
    mapLoading: 'กำลังโหลดแผนที่…',
    mapLoadFail: 'โหลดแผนที่พื้นหลังไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
    retry: 'ลองใหม่',
    mapHelp: 'แตะบนแผนที่เพื่อปักหมุด หรือลากหมุด 📍 ไปยังจุดเกิดเหตุจริง',
    boundaryNote: 'เขตรับผิดชอบของเทศบาลครอบคลุม 13 หมู่บ้านในตำบลบ่อหลวงตามข้อมูลทางการของเทศบาล ส่วนเส้น GIS ที่ระบบใช้เป็นขอบเขตอ้างอิง ADM3 รหัส TH501604 สำหรับงานปฏิบัติการ ไม่ใช่แผนที่แนวเขตทางกฎหมาย/รังวัด',
    gisTitle: 'GIS Live · เทศบาลตำบลบ่อหลวง',
    incidentPoints: 'หมุดเหตุ',
    emergencyAreas: 'พื้นที่ฉุกเฉิน',
    filterSearch: 'ค้นหา',
    status: 'สถานะ',
    severity: 'ความรุนแรง',
    all: 'ทั้งหมด',
    activeOnly: 'เฉพาะงานที่ยังเปิดอยู่',
    everyLevel: 'ทุกระดับ',
    everyVillage: 'ทุกหมู่บ้าน',
    showing: 'แสดง',
    from: 'จาก',
    points: 'จุด',
    publicPoint: '👤 = จุดแจ้งเหตุจากประชาชน',
    shownPoints: 'รายการจุดที่กำลังแสดง',
    noMatch: 'ไม่มีจุดที่ตรงกับตัวกรอง',
    pointDetail: 'รายละเอียดจุด',
    choosePoint: 'แตะหมุดหรือเลือกรายการเพื่อดูรายละเอียด',
    type: 'ประเภท',
    department: 'หน่วยงาน',
    update: 'อัปเดต',
    receivedAt: 'รับเรื่อง',
    coordinate: 'พิกัด',
  },
  en: {
    language: 'Language', thai: 'ไทย', english: 'English', chinese: '中文',
    brand: 'Bo Luang Subdistrict Municipality',
    brandSub: 'Report · Track · GIS Live · Staff Center',
    citizen: 'Citizen', track: 'Track case', staff: 'Staff', gis: 'GIS Live', executive: 'Executive',
    demo: 'Demo mode is active — sample data does not replace the municipality’s live database.',
    reportHero: 'Report an issue or request help',
    reportHeroDesc: 'Send information to the municipality and receive a tracking number. Works on mobile and desktop.',
    emergency: 'For life-threatening emergencies, contact the appropriate emergency service directly.',
    reportForm: 'Incident report form', category: 'Category', village: 'Village / Moo *', chooseVillage: 'Select village / Moo',
    urgency: 'Urgency', low: 'General', medium: 'Moderate', high: 'Urgent',
    title: 'Title *', titlePh: 'Short summary of the issue', description: 'Details *', descriptionPh: 'Describe the location and assistance needed',
    house: 'House number', reporter: 'Reporter name', phone: 'Phone number (optional)',
    phoneHelp: 'Enter the full phone number. The last 4 digits are used to verify tracking.',
    incidentLocation: 'Incident location *', mapInstruction: 'Open the map, tap or drag the pin to the incident location, then confirm it.',
    openMap: '📍 Open map and pin location', selectedPin: '● Pin selected, not confirmed yet', confirmedPin: '✓ Location confirmed',
    confirmPin: 'Confirm this pin', clearPin: 'Clear pin', evidence: 'Evidence photo (optional)',
    evidenceHelp: 'JPG, PNG or WebP, maximum 5 MB', submit: 'Send to municipality', submitting: 'Submitting…',
    dataUse: 'Data use', dataUseText: 'The system uses the name, phone number, location and photos you provide to receive, track and process this report. Please provide only necessary information.',
    trackingNo: 'Tracking number', copyTracking: 'Copy tracking number', trackTitle: 'Track a case',
    trackHelp: 'If no phone number was entered when reporting, use the tracking number only. If a phone number was entered, provide its last 4 digits for verification.',
    phoneLast4: 'Last 4 phone digits (only if you provided a phone number)', search: 'Search', searching: 'Searching…',
    area: 'Area', noUpdate: 'No public update yet', staffLogin: 'Staff sign in', staffAccount: 'Use an account issued by the municipality',
    email: 'Email', password: 'Password', login: 'Sign in', loggingIn: 'Signing in...', staffCenter: 'Staff Center',
    refresh: 'Refresh', logout: 'Sign out', loading: 'Loading data...', goLogin: 'Go to sign in', loginFirst: 'Please sign in first',
    gisStaffOnly: 'GIS Live is for municipal staff and executives', gisCenter: 'GIS Live · Incident Center',
    gisRealtime: 'Incident markers and emergency areas update automatically through Supabase Realtime.', loadingGis: 'Loading GIS Live...',
    noGisPermission: 'This account does not have permission to open GIS Live', execDashboard: 'Executive Dashboard',
    execDesc: 'Summary of data this account may access, without reporter contact information.', allCases: 'All cases',
    activeCases: 'In progress', doneCases: 'Completed', noExecPermission: 'This account does not have permission to open the Executive Dashboard',
    installApp: '📲 Install app', appInstalled: '✓ App installed', installing: 'Opening installer…', installed: 'App installed successfully',
    mapLoading: 'Loading map…', mapLoadFail: 'Map tiles could not be loaded. Check your internet connection and try again.', retry: 'Try again',
    mapHelp: 'Tap the map to place a pin, or drag 📍 to the actual incident location.',
    boundaryNote: 'The municipality serves 13 villages in Bo Luang Subdistrict. The GIS outline used here is the ADM3 TH501604 operational reference and is not a legal/cadastral boundary survey.',
    gisTitle: 'GIS Live · Bo Luang Municipality', incidentPoints: 'incident markers', emergencyAreas: 'emergency areas',
    filterSearch: 'Search', status: 'Status', severity: 'Severity', all: 'All', activeOnly: 'Open cases only', everyLevel: 'All levels',
    everyVillage: 'All villages', showing: 'Showing', from: 'of', points: 'points', publicPoint: '👤 = citizen-reported incident',
    shownPoints: 'Visible incident list', noMatch: 'No points match the filters', pointDetail: 'Point details',
    choosePoint: 'Tap a marker or choose an item to view details', type: 'Type', department: 'Department', update: 'Update',
    receivedAt: 'Received', coordinate: 'Coordinates',
  },
  zh: {
    language: '语言', thai: 'ไทย', english: 'English', chinese: '中文',
    brand: '博銮乡镇市政厅', brandSub: '事件上报 · 进度查询 · GIS 实时地图 · 工作人员中心',
    citizen: '公众', track: '进度查询', staff: '工作人员', gis: 'GIS 实时地图', executive: '管理层',
    demo: '当前为演示模式——示例数据不代表市政厅真实数据库。',
    reportHero: '报告问题或请求帮助', reportHeroDesc: '向市政厅提交信息并获取追踪编号，支持手机和电脑。',
    emergency: '如遇危及生命的紧急情况，请直接联系相关紧急救援单位。',
    reportForm: '事件上报表', category: '类别', village: '村 / Moo *', chooseVillage: '选择村 / Moo',
    urgency: '紧急程度', low: '一般', medium: '中等紧急', high: '紧急',
    title: '标题 *', titlePh: '简要说明问题', description: '详细信息 *', descriptionPh: '说明地点和需要的协助',
    house: '门牌号', reporter: '报告人姓名', phone: '电话号码（可选）',
    phoneHelp: '请输入完整电话号码，查询进度时使用后 4 位进行验证。',
    incidentLocation: '事件地点 *', mapInstruction: '打开地图，点击或拖动图钉到事件地点，然后确认位置。',
    openMap: '📍 打开地图并标记位置', selectedPin: '● 已选择图钉，尚未确认', confirmedPin: '✓ 位置已确认',
    confirmPin: '确认此位置', clearPin: '清除图钉', evidence: '证据照片（可选）',
    evidenceHelp: 'JPG、PNG 或 WebP，最大 5 MB', submit: '提交给市政厅', submitting: '正在提交…',
    dataUse: '数据使用', dataUseText: '系统将使用您提供的姓名、电话号码、位置和照片来接收、追踪和处理此事件。请仅提供必要信息。',
    trackingNo: '追踪编号', copyTracking: '复制追踪编号', trackTitle: '查询进度',
    trackHelp: '如果上报时未填写电话号码，只需使用追踪编号；如填写了电话号码，请输入后 4 位进行验证。',
    phoneLast4: '电话号码后 4 位（仅在上报时填写过电话号码时需要）', search: '查询', searching: '正在查询…',
    area: '区域', noUpdate: '暂无公开更新', staffLogin: '工作人员登录', staffAccount: '请使用市政厅发放的账号',
    email: '电子邮箱', password: '密码', login: '登录', loggingIn: '正在登录...', staffCenter: '工作人员中心',
    refresh: '刷新', logout: '退出登录', loading: '正在加载数据...', goLogin: '前往登录', loginFirst: '请先登录',
    gisStaffOnly: 'GIS 实时地图仅供市政工作人员和管理层使用', gisCenter: 'GIS 实时地图 · 事件中心',
    gisRealtime: '事件标记和紧急区域会通过 Supabase Realtime 自动更新。', loadingGis: '正在加载 GIS...',
    noGisPermission: '此账号无权打开 GIS 实时地图', execDashboard: '管理层仪表板',
    execDesc: '汇总当前账号有权访问的数据，不显示报告人的联系方式。', allCases: '全部事件',
    activeCases: '处理中', doneCases: '已完成', noExecPermission: '此账号无权打开管理层仪表板',
    installApp: '📲 安装应用', appInstalled: '✓ 应用已安装', installing: '正在打开安装界面…', installed: '应用安装成功',
    mapLoading: '正在加载地图…', mapLoadFail: '地图加载失败，请检查网络后重试。', retry: '重试',
    mapHelp: '点击地图放置图钉，或拖动 📍 到实际事件地点。',
    boundaryNote: '市政厅负责博銮乡 13 个村。系统中的 GIS 边界采用 ADM3 TH501604 作为工作参考，并非法律或地籍测量边界。',
    gisTitle: 'GIS 实时地图 · 博銮乡镇市政厅', incidentPoints: '事件标记', emergencyAreas: '紧急区域',
    filterSearch: '搜索', status: '状态', severity: '严重程度', all: '全部', activeOnly: '仅显示未结事件', everyLevel: '全部等级',
    everyVillage: '全部村庄', showing: '显示', from: '共', points: '个点', publicPoint: '👤 = 公众上报事件',
    shownPoints: '当前显示的事件', noMatch: '没有符合筛选条件的点', pointDetail: '地点详情',
    choosePoint: '点击地图标记或选择列表项目查看详情', type: '类别', department: '部门', update: '更新',
    receivedAt: '接收时间', coordinate: '坐标',
  },
} as const;

type Dict = typeof dictionaries.th;
type Key = keyof Dict;

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: Key) => string;
  locale: string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLanguage(): Language {
  const stored = localStorage.getItem('bo-luang-language');
  if (stored === 'th' || stored === 'en' || stored === 'zh') return stored;
  const browser = navigator.language.toLowerCase();
  if (browser.startsWith('zh')) return 'zh';
  if (browser.startsWith('en')) return 'en';
  return 'th';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    localStorage.setItem('bo-luang-language', next);
  };

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
  }, [language]);

  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage,
    t: (key) => dictionaries[language][key] || dictionaries.th[key],
    locale: language === 'zh' ? 'zh-CN' : language === 'en' ? 'en-US' : 'th-TH',
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside LanguageProvider');
  return value;
}

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className="language-switcher" role="group" aria-label={t('language')}>
      {([
        ['th', 'ไทย'],
        ['en', 'EN'],
        ['zh', '中文'],
      ] as [Language, string][]).map(([code, label]) => (
        <button
          type="button"
          key={code}
          className={language === code ? 'active' : ''}
          aria-pressed={language === code}
          onClick={() => setLanguage(code)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}


const categoryTranslations: Record<Language, Record<string, string>> = {
  th: {
    'ถนน': 'ถนน', 'ไฟส่องสว่าง': 'ไฟส่องสว่าง', 'ขยะ': 'ขยะ', 'น้ำประปา': 'น้ำประปา',
    'น้ำท่วม': 'น้ำท่วม', 'สัตว์รบกวน': 'สัตว์รบกวน', 'ความปลอดภัย': 'ความปลอดภัย', 'อื่นๆ': 'อื่นๆ',
  },
  en: {
    'ถนน': 'Road', 'ไฟส่องสว่าง': 'Street lighting', 'ขยะ': 'Waste', 'น้ำประปา': 'Water supply',
    'น้ำท่วม': 'Flooding', 'สัตว์รบกวน': 'Animal nuisance', 'ความปลอดภัย': 'Safety', 'อื่นๆ': 'Other',
  },
  zh: {
    'ถนน': '道路', 'ไฟส่องสว่าง': '路灯', 'ขยะ': '垃圾', 'น้ำประปา': '供水',
    'น้ำท่วม': '洪水', 'สัตว์รบกวน': '动物扰民', 'ความปลอดภัย': '安全', 'อื่นๆ': '其他',
  },
};

const statusTranslations: Record<Language, Record<string, string>> = {
  th: {
    RECEIVED: 'รับเรื่องแล้ว', VERIFYING: 'กำลังตรวจสอบ', IN_PROGRESS: 'กำลังดำเนินการ',
    DONE: 'ดำเนินการแล้ว', CLOSED: 'ปิดเรื่อง',
  },
  en: {
    RECEIVED: 'Received', VERIFYING: 'Verifying', IN_PROGRESS: 'In progress',
    DONE: 'Completed', CLOSED: 'Closed',
  },
  zh: {
    RECEIVED: '已接收', VERIFYING: '核实中', IN_PROGRESS: '处理中',
    DONE: '已完成', CLOSED: '已关闭',
  },
};

const villageEnglish: Record<string, string> = {
  'หมู่ที่ 1 บ้านบ่อหลวง': 'Moo 1 · Ban Bo Luang',
  'หมู่ที่ 2 บ้านวังกอง': 'Moo 2 · Ban Wang Kong',
  'หมู่ที่ 3 บ้านขุน': 'Moo 3 · Ban Khun',
  'หมู่ที่ 4 บ้านนาฟ่อน': 'Moo 4 · Ban Na Fon',
  'หมู่ที่ 5 บ้านแม่ลายเหนือ (รวมบ้านแม่ลายใต้)': 'Moo 5 · Ban Mae Lai Nuea (incl. Mae Lai Tai)',
  'หมู่ที่ 6 บ้านแม่ลายใต้ / บ้านพุย (บางส่วน)': 'Moo 6 · Ban Mae Lai Tai / Ban Phui (part)',
  'หมู่ที่ 7 บ้านพุย / บ้านกิ่วลม': 'Moo 7 · Ban Phui / Ban Kio Lom',
  'หมู่ที่ 8 บ้านกิ่วลม / บ้านเตียนอาง': 'Moo 8 · Ban Kio Lom / Ban Tian Ang',
  'หมู่ที่ 9 บ้านแม่สะนาม': 'Moo 9 · Ban Mae Sanam',
  'หมู่ที่ 10 บ้านเตียนอาง': 'Moo 10 · Ban Tian Ang',
  'หมู่ที่ 11 บ้านบ่อสะแง๋': 'Moo 11 · Ban Bo Sa Ngae',
  'หมู่ที่ 12 บ้านบ่อพะแวน (ที่ตั้งสำนักงานเทศบาลตำบลบ่อหลวง)': 'Moo 12 · Ban Bo Pha Waen (Municipal Office)',
  'หมู่ที่ 13 บ้านแม่หืด': 'Moo 13 · Ban Mae Huet',
};

export function localizeCategory(value: string, language: Language) {
  return categoryTranslations[language][value] || value;
}

export function localizeStatus(value: string, language: Language) {
  return statusTranslations[language][value] || value;
}

export function localizeVillage(value: string, language: Language) {
  if (language === 'th') return value.replace(/^หมู่ที่ (\d+) /, 'หมู่ที่ $1 · ');
  if (language === 'en') return villageEnglish[value] || value;
  const english = villageEnglish[value];
  return english ? english.replace(/^Moo/, '第').replace(' · ', '村 · ') : value;
}
