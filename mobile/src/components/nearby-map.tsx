import { Text, View } from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import { bounds, type NearbyMapProps } from "./nearby-map.types";

/**
 * Native (iOS / Android) live map: sensors colored by tier, evacuation
 * centres, and the user. Works in Expo Go as-is; production Android builds
 * need a Google Maps API key (see README).
 */
export default function NearbyMap(p: NearbyMapProps) {
  const b = bounds(p);
  if (!b) return null;
  return (
    <View style={{ height: p.height ?? 260, borderRadius: 18, overflow: "hidden" }}>
      <MapView
        style={{ flex: 1 }}
        showsUserLocation={p.me != null}
        initialRegion={{
          latitude: (b.minLat + b.maxLat) / 2,
          longitude: (b.minLng + b.maxLng) / 2,
          latitudeDelta: b.maxLat - b.minLat,
          longitudeDelta: b.maxLng - b.minLng,
        }}
      >
        {p.centres.map((c) => (
          <Marker key={`c-${c.id}`} coordinate={{ latitude: c.lat, longitude: c.lng }} pinColor={c.open ? p.colors.brand : p.colors.muted}>
            <Callout>
              <Text style={{ fontWeight: "700" }}>{c.name}</Text>
            </Callout>
          </Marker>
        ))}
        {p.sensors.map((s) => (
          <Marker key={`s-${s.id}-${s.tier}`} coordinate={{ latitude: s.lat, longitude: s.lng }} tracksViewChanges={false}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: p.colors.tiers[s.tier],
                borderWidth: 3,
                borderColor: p.colors.surface,
              }}
            />
            <Callout>
              <Text style={{ fontWeight: "700" }}>{s.name}</Text>
              <Text>
                {s.tierLabel}
                {s.depthCm != null ? ` · ${Math.round(s.depthCm)} cm` : ""}
              </Text>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}
