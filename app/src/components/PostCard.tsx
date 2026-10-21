import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import type { Post } from "../api/types";
import { distanceLabel, timeAgo } from "../lib/format";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";
import { VerificationBadge } from "./VerificationBadge";

type PostCardProps = {
  post: Post;
  onPress?: () => void;
  onLike?: () => void;
};

export function PostCard({ post, onPress, onLike }: PostCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      {post.mediaUrl ? (
        <Image source={{ uri: post.mediaUrl }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.textThumb]}>
          <Ionicons name="chatbubble-ellipses" size={26} color={colors.slate} />
        </View>
      )}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.place} numberOfLines={1}>
            {post.placeName}
          </Text>
          <Text style={styles.meta}>
            {post.distanceM != null ? `${distanceLabel(post.distanceM)} · ` : ""}
            {timeAgo(post.createdAt)}
          </Text>
        </View>
        {post.caption ? (
          <Text style={styles.caption} numberOfLines={3}>
            {post.caption}
          </Text>
        ) : null}
        <View style={styles.footerRow}>
          <VerificationBadge status={post.verification?.status ?? "unverified"} />
          <Pressable onPress={onLike} hitSlop={10} style={styles.like} disabled={!onLike}>
            <Ionicons name="heart" size={14} color={colors.coral} />
            <Text style={styles.likeCount}>{post.likeCount}</Text>
            <Text style={styles.nickname}>· {post.nickname}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.paper,
    borderRadius: 22,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4
  },
  thumbnail: {
    width: 84,
    height: 84,
    borderRadius: 18,
    backgroundColor: colors.cloud
  },
  textThumb: { alignItems: "center", justifyContent: "center" },
  content: { flex: 1, gap: spacing.sm },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  place: { flex: 1, color: colors.ink, fontSize: 17, fontWeight: "800" },
  meta: { color: colors.slate, fontSize: 12, fontWeight: "700" },
  caption: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  like: { flexDirection: "row", alignItems: "center", gap: 4 },
  likeCount: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  nickname: { color: colors.slate, fontSize: 12, fontWeight: "600" }
});
