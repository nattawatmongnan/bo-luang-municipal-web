import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BO_LUANG_BOUNDARY, BO_LUANG_BOUNDARY_SOURCE, isInsideBoLuang } from './boLuangBoundary';

type Props = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  onOutside?: () => void;
};

export default function LocationPicker({ lat, lng, onChange, onOutside }: Props) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const onOutsideRef = useRef(onOutside);
  const latRef = useRef(lat);
  const lngRef = useRef(lng);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    onChangeRef.current = onChange;
    onOutsideRef.current = onOutside;
    latRef.current = lat;
    lngRef.current = lng;
  }, [lat, lng, onChange, onOutside]);

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;

    setMapLoading(true);
    setMapError('');

    try {
      const boundary = L.polygon(BO_LUANG_BOUNDARY);
      const bounds = boundary.getBounds();

      const map = L.map(mapElement.current, {
        zoomControl: true,
        maxBounds: bounds.pad(0.08),
        maxBoundsViscosity: 1,
      });

      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      });

      tiles.once('load', () => setMapLoading(false));
      tiles.on('tileerror', () => {
        setMapLoading(false);
        setMapError('โหลดแผนที่พื้นหลังไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
      });
      tiles.addTo(map);

      L.polygon(BO_LUANG_BOUNDARY, {
        weight: 3,
        fillOpacity: 0.05,
      }).addTo(map);

      map.fitBounds(bounds, { padding: [16, 16] });

      const icon = L.divIcon({
        className: 'location-pin-icon',
        html: '<div class="location-pin-emoji">📍</div>',
        iconSize: [42, 42],
        iconAnchor: [21, 40],
      });

      const placeMarker = (point: L.LatLng) => {
        if (!markerRef.current) {
          const marker = L.marker(point, {
            draggable: true,
            icon,
            autoPan: true,
          }).addTo(map);

          marker.on('dragend', () => {
            const next = marker.getLatLng();
            if (!isInsideBoLuang(next.lat, next.lng)) {
              const currentLat = latRef.current;
              const currentLng = lngRef.current;
              if (currentLat !== null && currentLng !== null) {
                marker.setLatLng([currentLat, currentLng]);
              } else {
                marker.remove();
                markerRef.current = null;
              }
              onOutsideRef.current?.();
              return;
            }
            onChangeRef.current(next.lat, next.lng);
          });

          markerRef.current = marker;
        } else {
          markerRef.current.setLatLng(point);
        }
      };

      map.on('click', (event: L.LeafletMouseEvent) => {
        if (!isInsideBoLuang(event.latlng.lat, event.latlng.lng)) {
          onOutsideRef.current?.();
          return;
        }
        placeMarker(event.latlng);
        onChangeRef.current(event.latlng.lat, event.latlng.lng);
      });

      if (latRef.current !== null && lngRef.current !== null && isInsideBoLuang(latRef.current, lngRef.current)) {
        placeMarker(L.latLng(latRef.current, lngRef.current));
        map.setView([latRef.current, lngRef.current], 16);
      }

      mapRef.current = map;
    } catch {
      setMapLoading(false);
      setMapError('ไม่สามารถเปิดแผนที่ได้');
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [retryKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat === null || lng === null || !isInsideBoLuang(lat, lng)) return;

    if (!markerRef.current) {
      const icon = L.divIcon({
        className: 'location-pin-icon',
        html: '<div class="location-pin-emoji">📍</div>',
        iconSize: [42, 42],
        iconAnchor: [21, 40],
      });
      markerRef.current = L.marker([lat, lng], { draggable: true, icon, autoPan: true }).addTo(map);
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    map.setView([lat, lng], Math.max(map.getZoom(), 16));
  }, [lat, lng]);

  return (
    <div>
      <div className="map-frame">
        <div ref={mapElement} className="location-map" aria-label="แผนที่ปักหมุดตำแหน่งเหตุ" />
        {mapLoading && <div className="map-overlay" role="status">กำลังโหลดแผนที่…</div>}
        {mapError && (
          <div className="map-overlay map-error" role="alert">
            <span>{mapError}</span>
            <button className="btn secondary" type="button" onClick={() => setRetryKey((v) => v + 1)}>
              ลองใหม่
            </button>
          </div>
        )}
      </div>
      <div className="muted location-map-help">
        แตะบนแผนที่เพื่อปักหมุด หรือลากหมุด 📍 ไปยังจุดเกิดเหตุจริง
      </div>
      <div className="boundary-note">{BO_LUANG_BOUNDARY_SOURCE}</div>
    </div>
  );
}
