import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../api/client";
import type { Post } from "../api/types";
import { PostCard } from "../components/PostCard";
import { StateView } from "../components/StateView";
import { VerificationBadge } from "../components/VerificationBadge";
import { timeAgo, verificationLabel } from "../lib/format";
import { useLike } from "../lib/useLike";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type Filter = "all" | "verified" | "image";

type PlaceDetailScreenProps = {
  postIds: string[];
  title: string;
  onBack: () => void;
  onRequireLogin: () => void;
};

export function PlaceDetailScreen({ postIds, title, onBack, onRequireLogin }: PlaceDetailScreenProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const like = useLike(setPosts, onRequireLogin);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPosts((await api.posts(postIds)).posts);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [postIds]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () =>
      posts.filter((p) =>
        filter === "verified" ? p.verification?.status !== "unverified" : filter === "image" ? !!p.mediaUrl : true
      ),
    [posts, filter]
  );
  const hero = posts.find((p) => p.mediaUrl) ?? posts[0];
  const detail = hero?.verification;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={colors.ink} />
          <Text style={styles.backLabel}>뒤로</Text>
        </Pressable>

        {hero?.mediaUrl ? (
          <Image source={{ uri: hero.mediaUrl }} style={styles.hero} resizeMode="cover" />
        ) : (
          <View style={[styles.hero, styles.heroEmpty]}>
            <Ionicons name="location" size={36} color={colors.slate} />
          </View>
        )}

        <Text style={styles.placeTitle}>{title}</Text>
        <Text style={styles.placeMeta}>
          {hero ? `최근 ${timeAgo(hero.createdAt)} · 게시물 ${posts.length}개` : " "}
        </Text>

        {detail ? (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>대표 게시물 검증 정보</Text>
              <VerificationBadge status={detail.status} />
            </View>
            <Text style={styles.panelLine}>
              {`촬영 시각: ${detail.capturedAt ? new Date(detail.capturedAt).toLocaleTimeString("ko-KR") : "알 수 없음"}${
                detail.captureAgeMinutes != null ? ` (업로드까지 ${Math.round(detail.captureAgeMinutes)}분)` : ""
              }`}
            </Text>
            <Text style={styles.panelLine}>
              {`기기 위치와의 거리: ${detail.deviceDistanceM != null ? `${detail.deviceDistanceM}m` : "알 수 없음"}`}
            </Text>
            {detail.exifGpsDistanceM != null ? (
              <Text style={styles.panelLine}>{`사진 GPS와의 거리: ${detail.exifGpsDistanceM}m`}</Text>
            ) : null}
            {detail.reasons.map((r) => (
              <Text key={r} style={styles.panelReason}>
                {`· ${r}`}
              </Text>
            ))}
            {detail.reasons.length === 0 ? (
              <Text style={styles.panelReason}>{`· ${verificationLabel[detail.status]} 기준을 모두 충족`}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.filterRow}>
          {(
            [
              ["all", "전체"],
              ["verified", "검증됨"],
              ["image", "사진"]
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              style={[styles.filterPill, filter === key && styles.filterPillActive]}
            >
              <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <StateView
          loading={loading}
          error={error}
          onRetry={load}
          empty={!loading && !error && visible.length === 0 ? "조건에 맞는 게시물이 없습니다." : null}
        />

        <View style={styles.feed}>
          {visible.map((post) => (
            <PostCard key={post.id} post={post} onLike={() => like(post)} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.sand },
  content: { padding: spacing.lg, gap: spacing.md },
  backButton: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start" },
  backLabel: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  hero: { height: 240, borderRadius: 30, backgroundColor: "#D6E3ED", width: "100%" },
  heroEmpty: { justifyContent: "center", alignItems: "center" },
  placeTitle: { color: colors.ink, fontSize: 28, fontWeight: "900" },
  placeMeta: { color: colors.slate, fontSize: 14, fontWeight: "700" },
  panel: {
    backgroundColor: colors.paper,
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    gap: spacing.xs
  },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  panelTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  panelLine: { color: colors.ink, fontSize: 14 },
  panelReason: { color: colors.slate, fontSize: 13 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  filterPill: {
    backgroundColor: colors.paper,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line
  },
  filterPillActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  filterTextActive: { color: colors.white },
  feed: { gap: spacing.md }
});
