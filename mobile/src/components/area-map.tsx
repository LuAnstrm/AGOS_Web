import { useMemo } from "react";
import { useApp } from "@/lib/app-state";
import { t, TIER_LABEL } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import NearbyMap from "./nearby-map";
import { Card, SectionTitle } from "./ui";

/** "Live map" from the paper: nearby sensors by tier, centres, and you. */
export function AreaMap() {
  const c = useTheme();
  const { locale, nodes, latest, centres, location } = useApp();

  const sensors = useMemo(
    () =>
      nodes
        .filter((n) => n.lat != null && n.lng != null)
        .map((n) => {
          const p = latest[n.id];
          return {
            id: n.id,
            name: n.name ?? n.id,
            lat: n.lat!,
            lng: n.lng!,
            tier: n.currentTier,
            tierLabel: TIER_LABEL[locale][n.currentTier],
            depthCm: p?.filteredCm ?? p?.rawCm ?? null,
          };
        }),
    [nodes, latest, locale],
  );
  const mapCentres = useMemo(
    () => centres.map((x) => ({ id: x.id, name: x.name, lat: x.lat, lng: x.lng, open: x.status === "open" })),
    [centres],
  );

  if (!sensors.length) return null;
  return (
    <>
      <SectionTitle icon="map-outline">{t(locale, "map")}</SectionTitle>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <NearbyMap
          sensors={sensors}
          centres={mapCentres}
          me={location.kind === "ok" ? location.position : null}
          colors={{ tiers: c.tiers, brand: c.brand, surface: c.surface, ink: c.ink, muted: c.muted }}
        />
      </Card>
    </>
  );
}
