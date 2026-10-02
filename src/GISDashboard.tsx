import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from './lib/supabase';
import { localizeStatus, localizeVillage, useI18n } from './i18n';
import { BO_LUANG_BOUNDARY, isInsideBoLuang } from './boLuangBoundary';

type IncidentPoint = {
  id: string;
  tracking_no: string;
  title: string;
  category: string;
  urgency: string;
  status: string;
  village: string;
  lat: number | null;
  lng: number | null;
  created_at?: string;
  assigned_department?: string | null;
  public_note?: string | null;
};

type EmergencyArea = {
  id: string;
  title: string;
  kind: string;
  severity: string;
  active: boolean;
  note: string | null;
  geojson: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
};

type Props = {
  userId: string;
  canWrite: boolean;
};

const severityColor: Record<string, string> = {
  LOW: '#16a34a',
  MEDIUM: '#f59e0b',
  HIGH: '#dc2626',
};

const severityLabel: Record<string, string> = {
  LOW: 'ทั่วไป',
  MEDIUM: 'เฝ้าระวัง',
  HIGH: 'รุนแรง/ฉุกเฉิน',
};

const statusLabel: Record<string, string> = {
  RECEIVED: 'รับเรื่องแล้ว',
  VERIFYING: 'กำลังตรวจสอบ',
  IN_PROGRESS: 'กำลังดำเนินการ',
  DONE: 'ดำเนินการแล้ว',
  CLOSED: 'ปิดเรื่อง',
};

export default function GISDashboard({ userId, canWrite }: Props) {
  const { language, t, locale } = useI18n();
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const incidentLayerRef = useRef<L.LayerGroup | null>(null);
  const areaLayerRef = useRef<L.LayerGroup | null>(null);
  const draftLayerRef = useRef<L.Polygon | null>(null);
  const drawingRef = useRef(false);
  const draftPointsRef = useRef<L.LatLng[]>([]);

  const [incidents, setIncidents] = useState<IncidentPoint[]>([]);
  const [areas, setAreas] = useState<EmergencyArea[]>([]);
  const [liveStatus, setLiveStatus] = useState('กำลังเชื่อมต่อ Realtime...');
  const [message, setMessage] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [areaTitle, setAreaTitle] = useState('');
  const [kind, setKind] = useState('FLOOD');
  const [severity, setSeverity] = useState('HIGH');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [urgencyFilter, setUrgencyFilter] = useState('ALL');
  const [villageFilter, setVillageFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<IncidentPoint | null>(null);

  const reload = useCallback(async () => {
    if (!supabase) return;
    const [incidentResult, areaResult] = await Promise.all([
      supabase
        .from('municipal_incidents')
        .select('id,tracking_no,title,category,urgency,status,village,lat,lng,created_at,assigned_department,public_note')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('emergency_areas')
        .select('id,title,kind,severity,active,note,geojson')
        .order('created_at', { ascending: false }),
    ]);

    if (!incidentResult.error) setIncidents((incidentResult.data || []) as IncidentPoint[]);
    if (!areaResult.error) setAreas((areaResult.data || []) as EmergencyArea[]);
  }, []);

  const villages = useMemo(
    () => Array.from(new Set(incidents.map((i) => i.village).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'th')),
    [incidents],
  );

  const filteredIncidents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incidents.filter((i) => {
      const statusOk =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
            ? !['DONE', 'CLOSED'].includes(i.status)
            : i.status === statusFilter;
      const urgencyOk = urgencyFilter === 'ALL' || i.urgency === urgencyFilter;
      const villageOk = villageFilter === 'ALL' || i.village === villageFilter;
      const searchOk =
        !q ||
        [i.tracking_no, i.title, i.category, i.village, i.assigned_department || '']
          .some((value) => value.toLowerCase().includes(q));
      return statusOk && urgencyOk && villageOk && searchOk;
    });
  }, [incidents, statusFilter, urgencyFilter, villageFilter, search]);

  useEffect(() => {
    if (!supabase) return;
    void reload();

    const channel = supabase
      .channel('bo-luang-gis-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'municipal_incidents' }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_areas' }, () => void reload())
      .subscribe((status) => {
        setLiveStatus(status === 'SUBSCRIBED' ? '● Realtime เชื่อมต่อแล้ว' : `Realtime: ${status}`);
      });

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [reload]);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;

    const boundary = L.polygon(BO_LUANG_BOUNDARY);
    const map = L.map(mapEl.current, {
      zoomControl: true,
      maxBounds: boundary.getBounds().pad(0.08),
      maxBoundsViscosity: 1,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    L.polygon(BO_LUANG_BOUNDARY, {
      weight: 3,
      fillOpacity: 0.03,
    }).addTo(map);

    map.fitBounds(boundary.getBounds(), { padding: [12, 12] });

    incidentLayerRef.current = L.layerGroup().addTo(map);
    areaLayerRef.current = L.layerGroup().addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      if (!drawingRef.current) return;
      if (!isInsideBoLuang(event.latlng.lat, event.latlng.lng)) {
        setMessage('วาดพื้นที่ได้เฉพาะภายในเขตเทศบาลตำบลบ่อหลวง');
        return;
      }
      draftPointsRef.current.push(event.latlng);
      if (draftLayerRef.current) draftLayerRef.current.remove();
      draftLayerRef.current = L.polygon(draftPointsRef.current, {
        weight: 3,
        fillOpacity: 0.15,
      }).addTo(map);
      setMessage(`จุดขอบเขต: ${draftPointsRef.current.length} จุด`);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = incidentLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    filteredIncidents.forEach((i) => {
      if (i.lat === null || i.lng === null) return;

      const color = severityColor[i.urgency] || severityColor.MEDIUM;
      const icon = L.divIcon({
        className: 'incident-person-marker',
        html: `
          <div class="incident-person-dot" style="--incident-color:${color}" aria-label="${severityLabel[i.urgency] || i.urgency}">
            <span class="incident-person-symbol">👤</span>
            <span class="incident-severity-pip"></span>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([i.lat, i.lng], { icon });
      marker.on('click', () => setSelectedIncident(i));
      marker.bindPopup(
        `<b>${i.title}</b><br>
        ${i.tracking_no}<br>
        พื้นที่: ${i.village}<br>
        ประเภท: ${i.category}<br>
        ความรุนแรง: <b style="color:${color}">${severityLabel[i.urgency] || i.urgency}</b><br>
        สถานะ: ${statusLabel[i.status] || i.status}`,
      );
      marker.addTo(layer);
    });
  }, [filteredIncidents]);

  useEffect(() => {
    const layer = areaLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    areas.filter((a) => a.active).forEach((a) => {
      const color = severityColor[a.severity] || severityColor.MEDIUM;
      const geoLayer = L.geoJSON(a.geojson as GeoJSON.GeoJsonObject, {
        style: {
          color,
          fillColor: color,
          weight: a.severity === 'HIGH' ? 4 : 3,
          fillOpacity: a.severity === 'HIGH' ? 0.28 : 0.18,
        },
      });
      geoLayer.bindPopup(
        `<b>พื้นที่ฉุกเฉิน: ${a.title}</b><br>
        ประเภท: ${a.kind}<br>
        ความรุนแรง: <b style="color:${color}">${severityLabel[a.severity] || a.severity}</b>`,
      );
      geoLayer.addTo(layer);
    });
  }, [areas]);

  function startDrawing() {
    if (!canWrite) return;
    drawingRef.current = true;
    draftPointsRef.current = [];
    if (draftLayerRef.current) {
      draftLayerRef.current.remove();
      draftLayerRef.current = null;
    }
    setDrawing(true);
    setMessage('แตะบนแผนที่อย่างน้อย 3 จุด เพื่อกำหนดขอบเขตพื้นที่ฉุกเฉิน');
  }

  function cancelDrawing() {
    drawingRef.current = false;
    draftPointsRef.current = [];
    if (draftLayerRef.current) {
      draftLayerRef.current.remove();
      draftLayerRef.current = null;
    }
    setDrawing(false);
    setMessage('');
  }

  async function saveArea() {
    if (!supabase || !canWrite) return;
    const points = draftPointsRef.current;
    if (!areaTitle.trim()) {
      setMessage('กรุณาใส่ชื่อพื้นที่ฉุกเฉิน');
      return;
    }
    if (points.length < 3) {
      setMessage('ต้องกำหนดอย่างน้อย 3 จุด');
      return;
    }

    const ring = points.map((p) => [p.lng, p.lat]);
    ring.push([points[0].lng, points[0].lat]);

    const { error } = await supabase.from('emergency_areas').insert({
      title: areaTitle.trim(),
      kind,
      severity,
      active: true,
      geojson: { type: 'Polygon', coordinates: [ring] },
      created_by: userId,
    });

    if (error) {
      setMessage(error.message.includes('OUTSIDE_BOLUANG_AREA')
        ? 'พื้นที่ต้องอยู่ภายในเขตเทศบาลตำบลบ่อหลวงทั้งหมด'
        : 'บันทึกพื้นที่ไม่สำเร็จ');
      return;
    }

    setAreaTitle('');
    cancelDrawing();
    setMessage('บันทึกพื้นที่ฉุกเฉินแล้ว และจะอัปเดตแบบ Realtime');
    await reload();
  }

  async function closeArea(id: string) {
    if (!supabase || !canWrite) return;
    const { error } = await supabase.from('emergency_areas').update({ active: false }).eq('id', id);
    if (error) setMessage('ปิดพื้นที่ไม่สำเร็จ');
    else await reload();
  }

  return (
    <div className="gis-live">
      <div className="row gis-toolbar">
        <div>
          <b>{t('gisTitle')}</b>
          <div className="muted">{liveStatus} · {t('incidentPoints')} {incidents.length} · {t('emergencyAreas')} {areas.filter((a) => a.active).length}</div>
        </div>
        <button className="btn secondary" type="button" onClick={() => void reload()}>{t('refresh')}</button>
      </div>

      {canWrite && (
        <div className="card gis-area-editor">
          <div className="grid">
            <label className="field">
              ชื่อพื้นที่ฉุกเฉิน
              <input value={areaTitle} onChange={(e) => setAreaTitle(e.target.value)} placeholder="เช่น เขตน้ำท่วม บ้าน..." />
            </label>
            <label className="field">
              ประเภท
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="FLOOD">น้ำท่วม</option>
                <option value="FIRE">ไฟไหม้</option>
                <option value="ROAD_CLOSED">ถนนปิด</option>
                <option value="LANDSLIDE">ดินถล่ม</option>
                <option value="OTHER">อื่น ๆ</option>
              </select>
            </label>
            <label className="field">
              ระดับ
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="LOW">ทั่วไป</option>
                <option value="MEDIUM">เฝ้าระวัง</option>
                <option value="HIGH">ฉุกเฉิน</option>
              </select>
            </label>
          </div>
          <div className="row">
            {!drawing ? (
              <button className="btn primary" type="button" onClick={startDrawing}>✏️ วาดพื้นที่ฉุกเฉิน</button>
            ) : (
              <>
                <button className="btn primary" type="button" onClick={() => void saveArea()}>บันทึกพื้นที่</button>
                <button className="btn secondary" type="button" onClick={cancelDrawing}>ยกเลิก</button>
              </>
            )}
          </div>
          {message && <div className="muted" style={{ marginTop: 8 }}>{message}</div>}
        </div>
      )}

      <section className="card gis-filters">
        <div className="gis-filter-grid">
          <label className="field">
            ค้นหา
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="เลข BLM / หัวข้อ / หมู่บ้าน / หน่วยงาน"
            />
          </label>
          <label className="field">
            สถานะ
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ACTIVE">{t('activeOnly')}</option>
              <option value="ALL">{t('all')}</option>
              <option value="RECEIVED">{localizeStatus('RECEIVED', language)}</option>
              <option value="VERIFYING">{localizeStatus('VERIFYING', language)}</option>
              <option value="IN_PROGRESS">{localizeStatus('IN_PROGRESS', language)}</option>
              <option value="DONE">{localizeStatus('DONE', language)}</option>
              <option value="CLOSED">{localizeStatus('CLOSED', language)}</option>
            </select>
          </label>
          <label className="field">
            ความรุนแรง
            <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}>
              <option value="ALL">{t('everyLevel')}</option>
              <option value="HIGH">รุนแรง/ฉุกเฉิน</option>
              <option value="MEDIUM">เฝ้าระวัง</option>
              <option value="LOW">ทั่วไป</option>
            </select>
          </label>
          <label className="field">
            หมู่บ้าน
            <select value={villageFilter} onChange={(e) => setVillageFilter(e.target.value)}>
              <option value="ALL">{t('everyVillage')}</option>
              {villages.map((village) => <option value={village} key={village}>{localizeVillage(village, language)}</option>)}
            </select>
          </label>
        </div>
        <div className="muted">{t('showing')} {filteredIncidents.length} {t('from')} {incidents.length} {t('points')}</div>
      </section>

      <div className="gis-severity-legend" aria-label="คำอธิบายระดับความรุนแรง">
        <span><i className="legend-dot low" />ทั่วไป</span>
        <span><i className="legend-dot medium" />เฝ้าระวัง</span>
        <span><i className="legend-dot high" />รุนแรง/ฉุกเฉิน</span>
        <span className="muted">{t('publicPoint')}</span>
      </div>

      <div ref={mapEl} className="gis-live-map" aria-label="แผนที่ GIS แบบ Realtime" />

      <div className="gis-below-grid">
        <section className="card">
          <h3>{t('shownPoints')}</h3>
          <div className="gis-incident-list">
            {filteredIncidents.length === 0 && <div className="muted">{t('noMatch')}</div>}
            {filteredIncidents.slice(0, 50).map((item) => (
              <button
                className={'gis-incident-row ' + (selectedIncident?.id === item.id ? 'active' : '')}
                type="button"
                key={item.id}
                onClick={() => {
                  setSelectedIncident(item);
                  if (item.lat !== null && item.lng !== null) {
                    mapRef.current?.setView([item.lat, item.lng], 17);
                  }
                }}
              >
                <span className="gis-incident-title">{item.title}</span>
                <span className="muted">{item.tracking_no} · {localizeVillage(item.village, language)}</span>
                <span>{severityLabel[item.urgency] || item.urgency} · {localizeStatus(item.status, language)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <h3>{t('pointDetail')}</h3>
          {!selectedIncident ? (
            <p className="muted">{t('choosePoint')}</p>
          ) : (
            <div className="gis-detail">
              <b>{selectedIncident.title}</b>
              <div className="muted">{selectedIncident.tracking_no}</div>
              <p>{t('type')}: {selectedIncident.category}</p>
              <p>{t('area')}: {localizeVillage(selectedIncident.village, language)}</p>
              <p>{t('severity')}: {severityLabel[selectedIncident.urgency] || selectedIncident.urgency}</p>
              <p>{t('status')}: {localizeStatus(selectedIncident.status, language)}</p>
              {selectedIncident.assigned_department && <p>{t('department')}: {selectedIncident.assigned_department}</p>}
              {selectedIncident.public_note && <p>{t('update')}: {selectedIncident.public_note}</p>}
              {selectedIncident.created_at && <p className="muted">{t('receivedAt')}: {new Date(selectedIncident.created_at).toLocaleString(locale)}</p>}
              {selectedIncident.lat !== null && selectedIncident.lng !== null && (
                <p className="muted">{t('coordinate')}: {selectedIncident.lat.toFixed(6)}, {selectedIncident.lng.toFixed(6)}</p>
              )}
            </div>
          )}
        </section>
      </div>

      {areas.some((a) => a.active) && (
        <div className="card">
          <b>พื้นที่ฉุกเฉินที่กำลังใช้งาน</b>
          <div className="list" style={{ marginTop: 10 }}>
            {areas.filter((a) => a.active).map((a) => (
              <div className="item" key={a.id}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span><b>{a.title}</b> · {a.kind} · {a.severity}</span>
                  {canWrite && <button className="btn secondary" type="button" onClick={() => void closeArea(a.id)}>ปิดพื้นที่</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
