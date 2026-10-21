import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { VerificationStatus } from "../api/types";
import { verificationLabel, verificationTone } from "../lib/format";

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const tone = verificationTone[status];
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Ionicons
        name={status === "unverified" ? "help-circle-outline" : "checkmark-circle"}
        size={13}
        color={tone.fg}
      />
      <Text style={[styles.label, { color: tone.fg }]}>{verificationLabel[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999
  },
  label: { fontSize: 12, fontWeight: "800" }
});
