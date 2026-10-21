import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../api/client";
import type { HotArea, Post } from "../api/types";
import { PostCard } from "../components/PostCard";
import { SectionHeader } from "../components/SectionHeader";
import { StateView } from "../components/StateView";
import { useLike } from "../lib/useLike";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type Props = {
  onOpenPlace: (postIds: string[], title: string) => void;
  onRequireLogin: () => void;
};

export function PopularNowScreen({ onOpenPlace, onRequireLogin }: Props) {
  const [areas, setAreas] = useState<HotArea[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const like = useLike(setPosts, onRequireLogin);

  const load = useCallback(async () => {
    try {
      const res = await api.popular();
      setAreas(res.areas);
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
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <SectionHeader
          eyebrow="인기 지역"
          title="지금 가장 활발한 곳"
          subtitle="최근 24시간 동안 검증된 게시물이 많고 반응이 뜨거운 장소입니다."
        />

        <StateView
          loading={loading}
          error={error}
          onRetry={load}
          empty={!loading && !error && areas.length === 0 ? "아직 공유된 소식이 없습니다." : null}
        />

        {areas.length > 0 ? (
          <View style={styles.rankPanel}>
            {areas.map((area, index) => (
              <Pressable
                key={area.geohash}
                style={styles.rankRow}
                onPress={() => onOpenPlace([area.topPost.id], area.placeName)}
              >
                <Text style={styles.rank}>{index + 1}</Text>
                <View style={styles.rankContent}>
                  <Text style={styles.rankPlace}>{area.placeName}</Text>
                  <Text style={styles.rankMeta}>
                    {`게시물 ${area.postCount}개 · 검증 ${area.verifiedCount}개`}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {posts.length > 0 ? (
          <View style={styles.feed}>
            <Text style={styles.feedTitle}>대표 게시물</Text>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onPress={() => onOpenPlace([post.id], post.placeName)}
                onLike={() => like(post)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.sand },
  content: { padding: spacing.lg, gap: spacing.lg },
  rankPanel: { backgroundColor: colors.ink, borderRadius: 28, padding: spacing.lg, gap: spacing.md },
  rankRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rank: { color: colors.sun, fontSize: 28, fontWeight: "900", width: 32 },
  rankContent: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
    paddingBottom: spacing.sm
  },
  rankPlace: { color: colors.white, fontSize: 18, fontWeight: "800" },
  rankMeta: { color: "#CFC6B4", fontSize: 12, marginTop: 4 },
  feed: { gap: spacing.md },
  feedTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" }
});
