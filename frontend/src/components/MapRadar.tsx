import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Merchant } from '../types';

export type { Merchant };

interface MapRadarProps {
  center: [number, number];
  radius: number;
  merchants: Merchant[];
  isScanning: boolean;
  onAudit: (merchant: Merchant) => void;
  onCenterChange?: (newCenter: [number, number]) => void;
}

// Özel Sürüklenebilir GPS Radar Hedef İkonu (Gradyansız düz kurumsal renk)
const centerLocationIcon = L.divIcon({
  className: 'custom-center-pin',
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 42px; cursor: grab;" title="Konumu değiştirmek için sürükleyin">
      <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(111, 143, 114, 0.35); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: relative; width: 32px; height: 32px; border-radius: 50%; background: #3F5E45; border: 2.5px solid #FFF8E7; display: flex; align-items: center; justify-content: center; color: #FFF8E7;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" fill="#FFF8E7"></circle>
          <circle cx="12" cy="12" r="9"></circle>
          <line x1="12" y1="2" x2="12" y2="4"></line>
          <line x1="12" y1="20" x2="12" y2="23"></line>
          <line x1="1" y1="12" x2="4" y2="12"></line>
          <line x1="20" y1="12" x2="23" y2="12"></line>
        </svg>
      </div>
      <div style="position: absolute; bottom: 3px; width: 8px; height: 8px; background: #3F5E45; transform: rotate(45deg); border-right: 1.5px solid #FFF8E7; border-bottom: 1.5px solid #FFF8E7;"></div>
    </div>
  `,
  iconSize: [36, 42],
  iconAnchor: [18, 38],
  popupAnchor: [0, -38],
});

// Kategori Renkleri
const categoryColors: Record<string, { bg: string; border: string }> = {
  food: { bg: '#d97706', border: '#b45309' },
  beauty: { bg: '#9333ea', border: '#7e22ce' },
  auto: { bg: '#0284c7', border: '#0369a1' },
  retail: { bg: '#6F8F72', border: '#3F5E45' },
  health: { bg: '#dc2626', border: '#b91c1c' },
  services: { bg: '#4f46e5', border: '#4338ca' },
  sports: { bg: '#0d9488', border: '#0f766e' },
  other: { bg: '#3F5E45', border: '#2D4632' },
};

const getMerchantIcon = (m: Merchant) => {
  const group = m.category_group || 'other';
  const iconTag = (m.category_icon || 'ISL').slice(0, 3);
  const colors = categoryColors[group] || categoryColors.other;

  return L.divIcon({
    className: 'custom-merchant-pin',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 32px; height: 36px; cursor: pointer;">
        <div style="width: 30px; height: 30px; border-radius: 50%; background: ${colors.bg}; border: 2px solid #FFF8E7; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; color: #FFF8E7; letter-spacing: -0.3px;">
          ${iconTag}
        </div>
        <div style="position: absolute; bottom: 1px; width: 6px; height: 6px; background: ${colors.border}; transform: rotate(45deg); border-right: 1px solid #FFF8E7; border-bottom: 1px solid #FFF8E7;"></div>
      </div>
    `,
    iconSize: [32, 36],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
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
    <div className="relative w-full h-[540px] rounded-xl overflow-hidden border-2 border-[#3F5E45] bg-[#E8DCC4]">
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
            <div className="text-center p-1 font-sans text-[#3F5E45]">
              <strong className="text-[#3F5E45] block text-sm">Radar Hedef Noktası</strong>
              <span className="text-xs text-[#3F5E45]/80">Konumu değiştirmek için bu pini haritada istediğiniz yere sürükleyin.</span>
            </div>
          </Popup>
        </Marker>

        <Circle center={center} pathOptions={{ color: '#3F5E45', fillColor: '#6F8F72', fillOpacity: 0.14, weight: 2 }} radius={radius} />

        {/* Esnaflar */}
        {merchants.map((m) => (
          <Marker
            key={m.osm_id}
            position={[m.latitude, m.longitude]}
            icon={getMerchantIcon(m)}
          >
            <Popup className="custom-popup">
              <div className="text-[#3F5E45] p-1 font-sans max-w-[260px]">
                {/* Kategori Etiketi */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs text-[#6F8F72] font-bold truncate">
                    [{m.category_icon || 'ISL'}] {m.category_label || m.category}
                  </span>
                  {m.lead_potential_score && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#B7C9A8] text-[#3F5E45] border border-[#3F5E45]">
                      %{m.lead_potential_score} Fırsat
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-base text-[#3F5E45] line-clamp-1">{m.name}</h3>

                {/* Ön Fırsat Rozeti */}
                {m.opportunity_badge && (
                  <div className="my-1.5">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#E8DCC4] text-[#3F5E45] border border-[#3F5E45] block text-center truncate">
                      {m.opportunity_badge}
                    </span>
                  </div>
                )}

                {/* İletişim Detayları */}
                <div className="text-xs text-[#3F5E45] space-y-1 my-2 bg-[#E8DCC4] p-2 rounded-lg border border-[#3F5E45]">
                  {m.phone ? (
                    <p className="text-[#3F5E45] font-semibold">Tel: {m.phone}</p>
                  ) : (
                    <p className="text-[#3F5E45]/60 italic">Tel: Belirtilmemiş</p>
                  )}
                  {m.website ? (
                    <p className="truncate text-[#3F5E45] font-medium">
                      <a href={m.website.startsWith('http') ? m.website : `http://${m.website}`} target="_blank" rel="noreferrer" className="underline">
                        Web: {m.website.replace(/^https?:\/\//, '')}
                      </a>
                      {m.is_corporate_chain && (
                        <span className="ml-1 text-[10px] font-bold">(Kurumsal)</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-amber-800 font-semibold">Web: Haritada Kayıt Yok</p>
                  )}
                  {m.instagram && (
                    <p className="truncate text-[#3F5E45]">Instagram: @{m.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')}</p>
                  )}
                  {m.opening_hours && (
                    <p className="text-[#3F5E45]/80 truncate text-[11px]">Saatler: {m.opening_hours}</p>
                  )}
                  {m.address && (
                    <p className="text-[#3F5E45]/80 truncate text-[11px]">Adres: {m.address}</p>
                  )}
                </div>

                <button
                  onClick={() => onAudit(m)}
                  className="w-full bg-[#6F8F72] hover:bg-[#3F5E45] text-[#FFF8E7] font-semibold py-1.5 px-3 rounded-lg text-xs transition-colors cursor-pointer border border-[#3F5E45]"
                >
                  İşletmeyi İncele ve Teklif Hazırla
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
