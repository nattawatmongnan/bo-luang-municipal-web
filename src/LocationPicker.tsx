import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Props = {
  lat: number;
  lng: number;
  accuracy: number | null;
  onChange: (lat: number, lng: number) => void;
};

export default function LocationPicker({ lat, lng, accuracy, onChange }: Props) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;

    const map = L.map(mapElement.current, {
      center: [lat, lng],
      zoom: 17,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

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
      onChangeRef.current(point.lat, point.lng);
    });

    map.on('click', (event: L.LeafletMouseEvent) => {
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
    map.setView([lat, lng], Math.max(map.getZoom(), 17));

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
        แตะบนแผนที่หรือลากหมุด 📍 เพื่อแก้ตำแหน่งก่อนยืนยัน
      </div>
    </div>
  );
}
