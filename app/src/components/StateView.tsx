import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type Props = {
  loading?: boolean;
  error?: string | null;
  empty?: string | null;
  onRetry?: () => void;
};

/** Loading / error / empty placeholder used by the list screens */
export function StateView({ loading, error, empty, onRetry }: Props) {
  if (loading) {
    return (
      <View style={styles.box}>
        <ActivityIndicator color={colors.coral} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.box}>
        <Text style={styles.text}>{error}</Text>
        {onRetry ? (
          <Pressable onPress={onRetry} style={styles.retry}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.box}>
        <Text style={styles.text}>{empty}</Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  box: { paddingVertical: spacing.xl, alignItems: "center", gap: spacing.sm },
  text: { color: colors.slate, fontSize: 14, textAlign: "center", lineHeight: 20 },
  retry: { backgroundColor: colors.ink, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  retryText: { color: colors.white, fontWeight: "800" }
});
