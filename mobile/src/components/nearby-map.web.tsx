import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { bounds, type NearbyMapProps } from "./nearby-map.types";

/**
 * Web build of the live map (react-native-maps has no web support): the same
 * markers on an OpenStreetMap basemap via Leaflet.
 */
export default function NearbyMap(p: NearbyMapProps) {
  const b = bounds(p);
  if (!b) return null;
  return (
    <div style={{ height: p.height ?? 260, borderRadius: 18, overflow: "hidden" }}>
      <MapContainer
        center={[(b.minLat + b.maxLat) / 2, (b.minLng + b.maxLng) / 2]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        attributionControl
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Fit b={b} />
        {p.centres.map((c) => (
          <CircleMarker
            key={`c-${c.id}-${c.open}`}
            center={[c.lat, c.lng]}
            radius={7}
            pathOptions={{ color: p.colors.surface, weight: 2, fillColor: c.open ? p.colors.brand : p.colors.muted, fillOpacity: 1 }}
          >
            <Tooltip>{c.name}</Tooltip>
          </CircleMarker>
        ))}
        {p.sensors.map((s) => (
          <CircleMarker
            key={`s-${s.id}-${s.tier}`}
            center={[s.lat, s.lng]}
            radius={10}
            pathOptions={{ color: p.colors.surface, weight: 3, fillColor: p.colors.tiers[s.tier], fillOpacity: 1 }}
          >
            <Tooltip>
              <b>{s.name}</b>
              <br />
              {s.tierLabel}
              {s.depthCm != null ? ` · ${Math.round(s.depthCm)} cm` : ""}
            </Tooltip>
          </CircleMarker>
        ))}
        {p.me && (
          <CircleMarker
            center={[p.me.lat, p.me.lng]}
            radius={7}
            pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#1a73e8", fillOpacity: 1 }}
          />
        )}
      </MapContainer>
    </div>
  );
}

function Fit({ b }: { b: NonNullable<ReturnType<typeof bounds>> }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    map.fitBounds(
      [
        [b.minLat, b.minLng],
        [b.maxLat, b.maxLng],
      ],
      { padding: [12, 12] },
    );
  }, [map, b]);
  return null;
}
