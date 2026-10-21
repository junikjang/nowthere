import * as Location from "expo-location";

export type DeviceFix = { lat: number; lng: number; accuracyM: number | null };

export async function getCurrentFix(): Promise<DeviceFix> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") throw new Error("위치 권한이 필요합니다");
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy ?? null };
}

/** Short Korean place label for a coordinate, e.g. "강남구 역삼동" */
export async function placeLabel(lat: number, lng: number): Promise<string | null> {
  try {
    const [addr] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!addr) return null;
    const parts = [addr.district ?? addr.subregion ?? addr.city, addr.street ?? addr.name].filter(
      (p): p is string => !!p
    );
    return [...new Set(parts)].join(" ") || null;
  } catch {
    return null;
  }
}

export async function searchPlace(query: string) {
  const results = await Location.geocodeAsync(query);
  return results.map((r) => ({ lat: r.latitude, lng: r.longitude }));
}
