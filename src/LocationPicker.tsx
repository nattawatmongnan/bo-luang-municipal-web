import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BO_LUANG_BOUNDARY, isInsideBoLuang } from './boLuangBoundary';

type Props = {
  lat: number;
  lng: number;
  accuracy: number | null;
  onChange: (lat: number, lng: number) => void;
  onOutside?: () => void;
};

export default function LocationPicker({ lat, lng, accuracy, onChange, onOutside }: Props) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  const onOutsideRef = useRef(onOutside);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onOutsideRef.current = onOutside;
  }, [onOutside]);

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;

    const boundary = L.polygon(BO_LUANG_BOUNDARY);
    const bounds = boundary.getBounds();

    const map = L.map(mapElement.current, {
      center: [lat, lng],
      zoom: 14,
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
      iconSize: [38, 38],
      iconAnchor: [19, 36],
    });

    const marker = L.marker([lat, lng], {
      draggable: true,
      icon,
      autoPan: true,
    }).addTo(map);

    marker.on('dragend', () => {
      const point = marker.getLatLng();
      if (!isInsideBoLuang(point.lat, point.lng)) {
        marker.setLatLng([lat, lng]);
        onOutsideRef.current?.();
        return;
      }
      onChangeRef.current(point.lat, point.lng);
    });

    map.on('click', (event: L.LeafletMouseEvent) => {
      if (!isInsideBoLuang(event.latlng.lat, event.latlng.lng)) {
        onOutsideRef.current?.();
        return;
      }
      marker.setLatLng(event.latlng);
      onChangeRef.current(event.latlng.lat, event.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      accuracyRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    marker.setLatLng([lat, lng]);
    if (isInsideBoLuang(lat, lng)) {
      map.setView([lat, lng], Math.max(map.getZoom(), 16));
    }

    if (accuracyRef.current) {
      accuracyRef.current.remove();
      accuracyRef.current = null;
    }

    if (accuracy !== null && Number.isFinite(accuracy) && accuracy > 0) {
      accuracyRef.current = L.circle([lat, lng], {
        radius: accuracy,
        weight: 1,
        fillOpacity: 0.08,
      }).addTo(map);
    }
  }, [lat, lng, accuracy]);

  return (
    <div>
      <div ref={mapElement} className="location-map" aria-label="แผนที่เลือกตำแหน่ง" />
      <div className="muted location-map-help">
        พื้นที่เส้นขอบคือเขตเทศบาลตำบลบ่อหลวง เลือกตำแหน่งได้เฉพาะภายในเขตนี้
      </div>
    </div>
  );
}
