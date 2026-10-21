import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";

import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type SearchBarProps = {
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
  busy?: boolean;
};

export function SearchBar({ placeholder, value, onChangeText, onSubmit, busy }: SearchBarProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={18} color={colors.slate} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        placeholder={placeholder}
        placeholderTextColor={colors.slate}
        style={styles.input}
      />
      {busy ? <ActivityIndicator size="small" color={colors.slate} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.paper,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.line
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
    padding: 0
  }
});
