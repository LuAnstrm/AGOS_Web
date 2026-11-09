"use client";

import "leaflet/dist/leaflet.css";
import { Fragment, useEffect, useRef } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { SensorNode } from "@/lib/api";
import { TIER_LABEL, type Tier } from "@/lib/tiers";
import { useCssVars } from "@/lib/useCssVars";

const MALOLOS: [number, number] = [14.835, 120.805];
const VARS = [
  "tier-safe",
  "tier-advisory",
  "tier-watch",
  "tier-warning",
  "tier-critical",
  "surface",
  "ink",
] as const;

export interface MapProps {
  nodes: SensorNode[];
  latestCm: Record<string, number | undefined>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Sensor map view: every node, color-coded by its current alert tier. */
export default function SensorMap({ nodes, latestCm, selectedId, onSelect }: MapProps) {
  const c = useCssVars(VARS);
  const color = (t: Tier) => c[`tier-${t}`] || "#888";
  const placed = nodes.filter((n) => n.lat != null && n.lng != null);

  return (
    <MapContainer center={MALOLOS} zoom={13} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="agos-tiles"
      />
      <FitToNodes points={placed.map((n) => [n.lat!, n.lng!] as [number, number])} />
      {placed.map((n) => {
        const pos: [number, number] = [n.lat!, n.lng!];
        const selected = n.id === selectedId;
        const depth = latestCm[n.id];
        // Only the selected node keeps an always-on label; the rest show on
        // hover, so close-together nodes never stack labels. Every node's tier
        // and depth is always readable in the node list under the map.
        const pinned = selected;
        const critical = n.currentTier === "critical";
        // Leaflet can't switch a tooltip to/from permanent in place, and
        // remounting just the Tooltip under a live marker breaks under React's
        // dev double-mount. Keying the whole group remounts marker + tooltip
        // together, exactly like the first render.
        return (
          <Fragment key={`${n.id}:${pinned}:${critical}`}>
            {critical && (
              <CircleMarker
                center={pos}
                radius={12}
                interactive={false}
                pathOptions={{
                  className: "agos-pulse",
                  color: color("critical"),
                  weight: 3,
                  fillOpacity: 0,
                }}
              />
            )}
            <CircleMarker
              center={pos}
              radius={selected ? 13 : 10}
              eventHandlers={{ click: () => onSelect(n.id) }}
              pathOptions={{
                fillColor: color(n.currentTier),
                fillOpacity: 1,
                color: selected ? c.ink : c.surface,
                weight: selected ? 3 : 2,
              }}
            >
              <Tooltip direction="right" offset={[12, 0]} permanent={pinned}>
                <span className="font-medium">{n.name ?? n.id}</span>
                <br />
                {TIER_LABEL[n.currentTier].en}
                {depth != null && <> · {Math.round(depth)} cm</>}
                {n.source === "simulated" && <span className="text-muted"> · sim</span>}
              </Tooltip>
            </CircleMarker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}

/** Fits the view to all nodes once, when they first load. */
function FitToNodes({ points }: { points: [number, number][] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length === 0) return;
    done.current = true;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(points, { padding: [48, 48], maxZoom: 15 });
  }, [map, points]);
  return null;
}
