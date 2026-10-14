import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

export interface Merchant {
  osm_id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  category_group?: string;
  category_label?: string;
  category_icon?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  instagram?: string;
  opening_hours?: string;
  opportunity_badge?: string;
  lead_potential_score?: number;
}

interface MapRadarProps {
  center: [number, number];
  radius: number;
  merchants: Merchant[];
  isScanning: boolean;
  onAudit: (merchant: Merchant) => void;
  onCenterChange?: (newCenter: [number, number]) => void;
}

// Özel Sürüklenebilir GPS Radar Hedef İkonu
const centerLocationIcon = L.divIcon({
  className: 'custom-center-pin',
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 42px; cursor: grab;" title="Konumu değiştirmek için sürükleyin">
      <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(16, 185, 129, 0.35); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: relative; width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #10b981 0%, #047857 100%); border: 2.5px solid #ffffff; box-shadow: 0 4px 15px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" fill="white"></circle>
          <circle cx="12" cy="12" r="9"></circle>
          <line x1="12" y1="2" x2="12" y2="4"></line>
          <line x1="12" y1="20" x2="12" y2="23"></line>
          <line x1="1" y1="12" x2="4" y2="12"></line>
          <line x1="20" y1="12" x2="23" y2="12"></line>
        </svg>
      </div>
      <div style="position: absolute; bottom: 3px; width: 8px; height: 8px; background: #047857; transform: rotate(45deg); border-right: 1.5px solid white; border-bottom: 1.5px solid white;"></div>
    </div>
  `,
  iconSize: [36, 42],
  iconAnchor: [18, 38],
  popupAnchor: [0, -38],
});

// Kategori Renkleri
const categoryColors: Record<string, { bg: string; border: string }> = {
  food: { bg: '#f97316', border: '#ea580c' },      // Turuncu
  beauty: { bg: '#a855f7', border: '#9333ea' },    // Mor
  auto: { bg: '#0284c7', border: '#0369a1' },      // Gök Mavisi
  retail: { bg: '#10b981', border: '#059669' },    // Zümrüt Yeşili
  health: { bg: '#ef4444', border: '#dc2626' },    // Kırmızı
  services: { bg: '#6366f1', border: '#4f46e5' },  // İndigo
  sports: { bg: '#14b8a6', border: '#0d9488' },    // Turkuaz
  other: { bg: '#64748b', border: '#475569' },     // Slate
};

const getMerchantIcon = (m: Merchant) => {
  const group = m.category_group || 'other';
  const iconChar = m.category_icon || '📍';
  const colors = categoryColors[group] || categoryColors.other;

  return L.divIcon({
    className: 'custom-merchant-pin',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 30px; height: 34px; cursor: pointer;">
        <div style="width: 28px; height: 28px; border-radius: 50%; background: ${colors.bg}; border: 2px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; font-size: 13px;">
          ${iconChar}
        </div>
        <div style="position: absolute; bottom: 1px; width: 6px; height: 6px; background: ${colors.border}; transform: rotate(45deg); border-right: 1px solid white; border-bottom: 1px solid white;"></div>
      </div>
    `,
    iconSize: [30, 34],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
};

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, map, zoom]);
  return null;
}

const MapRadar: React.FC<MapRadarProps> = ({ center, radius, merchants, isScanning, onAudit, onCenterChange }) => {
  return (
    <div className="relative w-full h-[540px] rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
      <MapContainer 
        center={center} 
        zoom={14} 
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <ChangeView center={center} zoom={14} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Merkez Noktası ve Tarama Çemberi */}
        <Marker 
          position={center} 
          icon={centerLocationIcon}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target;
              if (marker) {
                const latLng = marker.getLatLng();
                if (onCenterChange) {
                  onCenterChange([
                    parseFloat(latLng.lat.toFixed(6)),
                    parseFloat(latLng.lng.toFixed(6))
                  ]);
                }
              }
            }
          }}
        >
          <Popup className="custom-popup">
            <div className="text-center p-1 font-sans">
              <strong className="text-emerald-400 block text-sm">📍 Radar Hedef Noktası</strong>
              <span className="text-xs text-slate-300">Konumu değiştirmek için bu pini haritada istediğiniz yere sürükleyin.</span>
            </div>
          </Popup>
        </Marker>
        
        <Circle center={center} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.08, weight: 1.5 }} radius={radius} />

        {/* Esnaflar */}
        {merchants.map((m) => (
          <Marker 
            key={m.osm_id} 
            position={[m.latitude, m.longitude]}
            icon={getMerchantIcon(m)}
          >
            <Popup className="custom-popup">
              <div className="text-slate-100 p-1 font-sans max-w-[260px]">
                {/* Kategori Etiketi */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs text-emerald-400 font-semibold truncate">
                    {m.category_icon || '🏢'} {m.category_label || m.category}
                  </span>
                  {m.lead_potential_score && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      %{m.lead_potential_score} Fırsat
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-base text-white line-clamp-1">{m.name}</h3>

                {/* Ön Fırsat Rozeti */}
                {m.opportunity_badge && (
                  <div className="my-1.5">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700 block text-center truncate">
                      {m.opportunity_badge}
                    </span>
                  </div>
                )}

                {/* İletişim Detayları */}
                <div className="text-xs text-slate-300 space-y-1 my-2 bg-slate-900/70 p-2 rounded-lg border border-slate-700/60">
                  {m.phone ? (
                    <p className="text-emerald-400 font-medium">📞 {m.phone}</p>
                  ) : (
                    <p className="text-slate-500 italic">📞 Tel belirtilmemiş</p>
                  )}
                  {m.website ? (
                    <p className="truncate text-blue-400">
                      <a href={m.website.startsWith('http') ? m.website : `http://${m.website}`} target="_blank" rel="noreferrer" className="hover:underline">
                        🌐 {m.website.replace(/^https?:\/\//, '')}
                      </a>
                    </p>
                  ) : (
                    <p className="text-rose-400 font-medium">🌐 Web sitesi YOK</p>
                  )}
                  {m.instagram && (
                    <p className="truncate text-purple-400">📸 @{m.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')}</p>
                  )}
                  {m.opening_hours && (
                    <p className="text-slate-400 truncate text-[11px]">⏰ {m.opening_hours}</p>
                  )}
                  {m.address && (
                    <p className="text-slate-400 truncate text-[11px]">📍 {m.address}</p>
                  )}
                </div>

                <button 
                  onClick={() => onAudit(m)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-1.5 px-3 rounded-lg text-xs transition-colors cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  Dijital Röntgen Çek 🩺
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
