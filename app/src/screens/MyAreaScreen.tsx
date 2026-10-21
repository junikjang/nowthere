import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../api/client";
import type { Post } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { PostCard } from "../components/PostCard";
import { SectionHeader } from "../components/SectionHeader";
import { StateView } from "../components/StateView";
import { getCurrentFix, placeLabel } from "../lib/location";
import { useLike } from "../lib/useLike";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

const RADII = [1000, 3000, 10000] as const;

type Props = {
  onOpenPlace: (postIds: string[], title: string) => void;
  onRequireLogin: () => void;
};

export function MyAreaScreen({ onOpenPlace, onRequireLogin }: Props) {
  const { nickname, signOut } = useAuth();
  const [radius, setRadius] = useState<(typeof RADII)[number]>(3000);
  const [label, setLabel] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const like = useLike(setPosts, onRequireLogin);

  const load = useCallback(async (r: number) => {
    try {
      const fix = await getCurrentFix();
      placeLabel(fix.lat, fix.lng).then(setLabel);
      const res = await api.nearby(fix.lat, fix.lng, r);
      setPosts(res.posts);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(radius);
    }, [load, radius])
  );

  const verified = posts.filter((p) => p.verification?.status !== "unverified").length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(radius);
            }}
          />
        }
      >
        <SectionHeader
          eyebrow="내 주변"
          title="내 주변 실시간 소식"
          subtitle="현재 위치를 기준으로 최근 24시간 동안 올라온 현장 게시물입니다."
        />

        <View style={styles.locationCard}>
          <Text style={styles.locationLabel}>현재 위치</Text>
          <Text style={styles.locationTitle}>{label ?? "위치 확인 중"}</Text>
          <Text style={styles.locationSubtitle}>{`반경 내 게시물 ${posts.length}개 · 검증 ${verified}개`}</Text>
          <View style={styles.radiusRow}>
            {RADII.map((r) => (
              <Pressable
                key={r}
                onPress={() => {
                  setLoading(true);
                  setRadius(r);
                }}
                style={[styles.radiusChip, radius === r && styles.radiusChipActive]}
              >
                <Text style={[styles.radiusText, radius === r && styles.radiusTextActive]}>
                  {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <StateView
          loading={loading}
          error={error}
          onRetry={() => load(radius)}
          empty={!loading && !error && posts.length === 0 ? "주변에 최근 소식이 없습니다." : null}
        />

        <View style={styles.feed}>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onPress={() => onOpenPlace([post.id], post.placeName)}
              onLike={() => like(post)}
            />
          ))}
        </View>

        <View style={styles.account}>
          <Text style={styles.accountText}>{nickname ? `${nickname} 님으로 로그인됨` : "로그인하지 않음"}</Text>
          <Pressable onPress={nickname ? signOut : onRequireLogin}>
            <Text style={styles.accountAction}>{nickname ? "로그아웃" : "로그인"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.sand },
  content: { padding: spacing.lg, gap: spacing.lg },
  locationCard: {
    backgroundColor: "#DAF0EA",
    borderRadius: 28,
    padding: spacing.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: "#B8DCCF"
  },
  locationLabel: { color: colors.teal, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  locationTitle: { color: colors.ink, fontSize: 24, fontWeight: "900" },
  locationSubtitle: { color: colors.slate, fontSize: 14, lineHeight: 20 },
  radiusRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm },
  radiusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.7)"
  },
  radiusChipActive: { backgroundColor: colors.teal },
  radiusText: { color: colors.teal, fontWeight: "800", fontSize: 12 },
  radiusTextActive: { color: colors.white },
  feed: { gap: spacing.md },
  account: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line
  },
  accountText: { color: colors.slate, fontSize: 13 },
  accountAction: { color: colors.coral, fontSize: 13, fontWeight: "800" }
});
