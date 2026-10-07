import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { motion } from 'framer-motion';

// Leaflet default icon fix
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Merchant {
  osm_id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  address?: string;
  phone?: string;
}

interface MapRadarProps {
  center: [number, number];
  radius: number;
  merchants: Merchant[];
  isScanning: boolean;
  onAudit: (merchant: Merchant) => void;
}

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, map, zoom]);
  return null;
}

const MapRadar: React.FC<MapRadarProps> = ({ center, radius, merchants, isScanning, onAudit }) => {
  return (
    <div className="relative w-full h-[500px] rounded-xl overflow-hidden shadow-2xl border border-slate-700">
      <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
        <ChangeView center={center} zoom={14} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Merkez Noktası ve Tarama Çemberi */}
        <Marker position={center}>
          <Popup>Merkez Konum</Popup>
        </Marker>
        <Circle center={center} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.1 }} radius={radius} />

        {/* Esnaflar */}
        {merchants.map((m) => (
          <Marker key={m.osm_id} position={[m.latitude, m.longitude]}>
            <Popup className="custom-popup">
              <div className="text-slate-800">
                <h3 className="font-bold text-lg">{m.name}</h3>
                <p className="text-sm text-slate-500 capitalize">{m.category}</p>
                {m.phone && <p className="text-sm mt-1">📞 {m.phone}</p>}
                {m.address && <p className="text-sm mt-1 text-slate-600">📍 {m.address}</p>}
                {m.website && <p className="text-sm mt-1 text-blue-500"><a href={m.website.startsWith('http') ? m.website : `http://${m.website}`} target="_blank" rel="noreferrer">🌐 Websitesi</a></p>}
                <button 
                  onClick={() => onAudit(m)}
                  className="mt-2 bg-emerald-500 text-white px-3 py-1 rounded text-sm w-full hover:bg-emerald-600 transition-colors"
                >
                  Dijital Röntgen Çek
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
        {isScanning && (
          <Marker 
            position={center} 
            icon={L.divIcon({
              className: 'clear-marker',
              html: '<div class="radar-pulse-ring"></div>',
              iconSize: [0, 0]
            })} 
          />
        )}
      </MapContainer>
    </div>
  );
};

export default MapRadar;
