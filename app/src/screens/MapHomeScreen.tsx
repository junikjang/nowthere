import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { type Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../api/client";
import type { MapPin } from "../api/types";
import { FloatingShareButton } from "../components/FloatingShareButton";
import { MapPinCard } from "../components/MapPinCard";
import { SearchBar } from "../components/SearchBar";
import { VerificationBadge } from "../components/VerificationBadge";
import { timeAgo } from "../lib/format";
import { getCurrentFix, searchPlace } from "../lib/location";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type MapHomeScreenProps = {
  onOpenPlace: (postIds: string[], title: string) => void;
  onOpenShare: () => void;
};

const SEOUL: Region = { latitude: 37.5512, longitude: 126.9882, latitudeDelta: 0.18, longitudeDelta: 0.18 };
const REFRESH_MS = 60_000; // real-time app: refresh pins every minute while visible

export function MapHomeScreen({ onOpenPlace, onOpenShare }: MapHomeScreenProps) {
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region>(SEOUL);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const loadPins = useCallback(async (region: Region) => {
    const bbox: [number, number, number, number] = [
      Math.max(-180, region.longitude - region.longitudeDelta / 2),
      Math.max(-90, region.latitude - region.latitudeDelta / 2),
      Math.min(180, region.longitude + region.longitudeDelta / 2),
      Math.min(90, region.latitude + region.latitudeDelta / 2)
    ];
    setStatus("loading");
    try {
      const res = await api.mapPins(bbox);
      setPins(res.pins);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, []);

  const onRegionChangeComplete = useCallback(
    (region: Region) => {
      regionRef.current = region;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => loadPins(region), 350);
    },
    [loadPins]
  );

  // Center on the user once, if they allow location
  useEffect(() => {
    getCurrentFix()
      .then((fix) =>
        mapRef.current?.animateToRegion(
          { latitude: fix.lat, longitude: fix.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 },
          600
        )
      )
      .catch(() => loadPins(SEOUL));
  }, [loadPins]);

  useFocusEffect(
    useCallback(() => {
      loadPins(regionRef.current);
      const timer = setInterval(() => loadPins(regionRef.current), REFRESH_MS);
      return () => clearInterval(timer);
    }, [loadPins])
  );

  const onSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const [first] = await searchPlace(q);
      if (!first) {
        Alert.alert("검색 결과 없음", `'${q}'에 해당하는 장소를 찾지 못했습니다.`);
        return;
      }
      mapRef.current?.animateToRegion(
        { latitude: first.lat, longitude: first.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 },
        600
      );
    } catch {
      Alert.alert("검색 실패", "잠시 후 다시 시도해주세요.");
    } finally {
      setSearching(false);
    }
  };

  const selectedPin = pins.find((p) => p.id === selectedPinId) ?? pins[0];
  const totalPosts = pins.reduce((n, p) => n + p.count, 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <SearchBar
            placeholder="도시, 랜드마크, 지역을 검색해보세요"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmit={onSearch}
            busy={searching}
          />
        </View>

        <View style={styles.mapPanel}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={SEOUL}
            onRegionChangeComplete={onRegionChangeComplete}
            showsUserLocation
            showsMyLocationButton={false}
            toolbarEnabled={false}
            onPress={() => setSelectedPinId(null)}
          >
            {pins.map((pin) => (
              <MapPinCard
                key={pin.id}
                pin={pin}
                isSelected={selectedPin?.id === pin.id && selectedPinId != null}
                onPress={() => setSelectedPinId(pin.id)}
              />
            ))}
          </MapView>

          <View style={styles.liveChip}>
            <View style={[styles.liveDot, status === "error" && { backgroundColor: colors.slate }]} />
            <Text style={styles.liveText}>
              {status === "error" ? "연결 끊김" : status === "loading" ? "불러오는 중" : `최근 24시간 · ${totalPosts}개`}
            </Text>
          </View>

          <Pressable
            style={styles.locateButton}
            onPress={() =>
              getCurrentFix()
                .then((fix) =>
                  mapRef.current?.animateToRegion(
                    { latitude: fix.lat, longitude: fix.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 },
                    500
                  )
                )
                .catch((e) => Alert.alert("위치", String(e.message ?? e)))
            }
          >
            <Ionicons name="locate" size={20} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.sheet}>
          {selectedPin ? (
            <>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetEyebrow}>{selectedPinId ? "선택한 장소" : "지금 가장 뜨거운 곳"}</Text>
                <Text style={styles.sheetMeta}>{timeAgo(selectedPin.createdAt)}</Text>
              </View>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {selectedPin.title}
              </Text>
              {selectedPin.caption ? (
                <Text style={styles.sheetSubtitle} numberOfLines={2}>
                  {selectedPin.caption}
                </Text>
              ) : null}
              <View style={styles.metaRow}>
                <VerificationBadge status={selectedPin.verification} />
                <Text style={styles.metaText}>{`게시물 ${selectedPin.count}개`}</Text>
              </View>
              <Pressable onPress={() => onOpenPlace(selectedPin.postIds, selectedPin.title)} style={styles.placeButton}>
                <Text style={styles.placeButtonLabel}>현장 게시물 보기</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.white} />
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.sheetEyebrow}>아직 조용해요</Text>
              <Text style={styles.sheetSubtitle}>
                이 지역에는 최근 24시간 동안 공유된 소식이 없습니다. 첫 번째로 지금 상황을 알려주세요.
              </Text>
            </>
          )}
        </View>

        <FloatingShareButton onPress={onOpenShare} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.sand },
  container: { flex: 1 },
  topBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  mapPanel: {
    flex: 1,
    marginHorizontal: spacing.lg,
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cloud
  },
  liveChip: {
    position: "absolute",
    left: spacing.md,
    top: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(255,249,239,0.94)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: 999
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral },
  liveText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  locateButton: {
    position: "absolute",
    right: spacing.md,
    top: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,249,239,0.94)",
    alignItems: "center",
    justifyContent: "center"
  },
  sheet: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 88,
    gap: spacing.sm
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetEyebrow: { color: colors.coral, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  sheetMeta: { color: colors.slate, fontSize: 12, fontWeight: "700" },
  sheetTitle: { color: colors.ink, fontSize: 24, fontWeight: "900" },
  sheetSubtitle: { color: colors.slate, fontSize: 14, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  metaText: { color: colors.slate, fontSize: 13, fontWeight: "700" },
  placeButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.ink,
    paddingVertical: 14,
    borderRadius: 18,
    marginRight: 140
  },
  placeButtonLabel: { color: colors.white, fontSize: 15, fontWeight: "800" }
});
