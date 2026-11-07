"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapPin = {
  lat: number;
  lon: number;
  label: string;
  color: string;
};

const iconCache = new Map<string, L.DivIcon>();

function pinIcon(color: string, size = 28): L.DivIcon {
  const cacheKey = `${color}-${size}`;
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  const icon = L.divIcon({
    className: "",
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C7.03 0 3 4.03 3 9c0 6.75 9 15 9 15s9-8.25 9-15c0-4.97-4.03-9-9-9z" fill="${color}"/>
      <circle cx="12" cy="9" r="3.25" fill="white"/>
    </svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });

  iconCache.set(cacheKey, icon);
  return icon;
}

type SiteMapProps = {
  center: { lat: number; lon: number };
  pins: MapPin[];
};

export function SiteMap({ center, pins }: SiteMapProps) {
  return (
    <div className="h-80 w-full overflow-hidden rounded-xl border">
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={10}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.map((pin, index) => (
          <Marker
            key={`${pin.lat}-${pin.lon}-${index}`}
            position={[pin.lat, pin.lon]}
            icon={pinIcon(pin.color, pin.color === "#16a34a" ? 32 : 24)}
          >
            <Popup>{pin.label}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
