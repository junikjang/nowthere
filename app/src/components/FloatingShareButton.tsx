import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type FloatingShareButtonProps = {
  onPress: () => void;
};

export function FloatingShareButton({ onPress }: FloatingShareButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.button}>
      <Ionicons name="add" size={20} color={colors.white} />
      <Text style={styles.label}>지금 공유</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.coral,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4
  },
  label: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800"
  }
});
