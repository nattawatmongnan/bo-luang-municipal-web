import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BO_LUANG_BOUNDARY, isInsideBoLuang } from './boLuangBoundary';

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

  useEffect(() => {
    onChangeRef.current = onChange;
    onOutsideRef.current = onOutside;
    latRef.current = lat;
    lngRef.current = lng;
  }, [lat, lng, onChange, onOutside]);

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;

    const boundary = L.polygon(BO_LUANG_BOUNDARY);
    const bounds = boundary.getBounds();

    const map = L.map(mapElement.current, {
      zoomControl: true,
      maxBounds: bounds.pad(0.08),
      maxBoundsViscosity: 1,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

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

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

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
      <div ref={mapElement} className="location-map" aria-label="แผนที่ปักหมุดตำแหน่งเหตุ" />
      <div className="muted location-map-help">
        แตะบนแผนที่เพื่อปักหมุด หรือลากหมุด 📍 ไปยังจุดเกิดเหตุจริง โดยเลือกได้เฉพาะในเขตเทศบาลตำบลบ่อหลวง
      </div>
    </div>
  );
}
