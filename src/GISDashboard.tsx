import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from './lib/supabase';
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

export default function GISDashboard({ userId, canWrite }: Props) {
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

  const reload = useCallback(async () => {
    if (!supabase) return;
    const [incidentResult, areaResult] = await Promise.all([
      supabase
        .from('municipal_incidents')
        .select('id,tracking_no,title,category,urgency,status,village,lat,lng')
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

    incidents.forEach((i) => {
      if (i.lat === null || i.lng === null) return;
      const marker = L.circleMarker([i.lat, i.lng], {
        radius: i.urgency === 'HIGH' ? 9 : 7,
        weight: 2,
        fillOpacity: 0.8,
      });
      marker.bindPopup(
        `<b>${i.title}</b><br>${i.tracking_no}<br>${i.village}<br>${i.category}<br>สถานะ: ${i.status}`,
      );
      marker.addTo(layer);
    });
  }, [incidents]);

  useEffect(() => {
    const layer = areaLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    areas.filter((a) => a.active).forEach((a) => {
      const geoLayer = L.geoJSON(a.geojson as GeoJSON.GeoJsonObject, {
        style: {
          weight: a.severity === 'HIGH' ? 4 : 2,
          fillOpacity: a.severity === 'HIGH' ? 0.25 : 0.15,
        },
      });
      geoLayer.bindPopup(`<b>พื้นที่ฉุกเฉิน: ${a.title}</b><br>${a.kind}<br>ระดับ: ${a.severity}`);
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
          <b>GIS Live · เทศบาลตำบลบ่อหลวง</b>
          <div className="muted">{liveStatus} · หมุดเหตุ {incidents.length} จุด · พื้นที่ฉุกเฉิน {areas.filter((a) => a.active).length} พื้นที่</div>
        </div>
        <button className="btn secondary" type="button" onClick={() => void reload()}>รีเฟรช</button>
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

      <div ref={mapEl} className="gis-live-map" aria-label="แผนที่ GIS แบบ Realtime" />

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
