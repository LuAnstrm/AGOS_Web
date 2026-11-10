"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Fragment, useEffect, useRef } from "react";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { EvacCentre, SensorNode, SosRequest } from "@/lib/api";
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
  sos: SosRequest[];
  selectedSosId: string | null;
  onSelectSos: (id: string) => void;
  centres: EvacCentre[];
  selectedCentreId: string | null;
  onSelectCentre: (id: string) => void;
}

/** Sensor map view: every node, color-coded by its current alert tier, plus open SOS requests. */
export default function SensorMap({
  nodes,
  latestCm,
  selectedId,
  onSelect,
  sos,
  selectedSosId,
  onSelectSos,
  centres,
  selectedCentreId,
  onSelectCentre,
}: MapProps) {
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
      {centres.map((ct) => (
        <Marker
          key={`${ct.id}:${ct.status}:${ct.id === selectedCentreId}`}
          position={[ct.lat, ct.lng]}
          icon={centreIcon(ct, ct.id === selectedCentreId)}
          eventHandlers={{ click: () => onSelectCentre(ct.id) }}
          zIndexOffset={500}
          title={`${ct.name} — ${ct.status}`}
        />
      ))}
      {sos.map((r) => (
        <Marker
          key={`${r.id}:${r.status}:${r.id === selectedSosId}`}
          position={[r.lat, r.lng]}
          icon={sosIcon(r, r.id === selectedSosId)}
          eventHandlers={{ click: () => onSelectSos(r.id) }}
          zIndexOffset={1000}
          title={`SOS: ${r.peopleCount} ${r.peopleCount === 1 ? "person" : "people"}, ${r.status}`}
        />
      ))}
    </MapContainer>
  );
}

/**
 * SOS marker: a labelled square badge in ink — deliberately not a tier color
 * and not a circle, so it never reads as a sensor node. New requests pulse.
 */
/** Evacuation centre: a house badge in brand blue; dimmed when full or closed. */
function centreIcon(c: EvacCentre, selected: boolean) {
  const cls = ["agos-centre", `agos-centre-${c.status}`, selected && "agos-centre-selected"].filter(Boolean).join(" ");
  return L.divIcon({
    className: "",
    html: `<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function sosIcon(r: SosRequest, selected: boolean) {
  const cls = ["agos-sos", r.status === "new" && "agos-sos-new", selected && "agos-sos-selected"]
    .filter(Boolean)
    .join(" ");
  return L.divIcon({
    className: "",
    html: `<span class="${cls}">SOS<b>${r.peopleCount}</b></span>`,
    iconSize: [44, 22],
    iconAnchor: [22, 11],
  });
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
