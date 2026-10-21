import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";

import type { MapPin } from "../api/types";
import { verificationTone } from "../lib/format";
import { colors } from "../theme/colors";

type MapPinCardProps = {
  pin: MapPin;
  isSelected?: boolean;
  onPress?: () => void;
};

/** Representative pin: rounded thumbnail + verification ring + merged-post count */
export function MapPinCard({ pin, isSelected = false, onPress }: MapPinCardProps) {
  // Android renders custom markers as bitmaps: keep tracking until the image has loaded, then freeze
  const [tracks, setTracks] = useState(true);
  const tone = verificationTone[pin.verification];

  return (
    <Marker
      coordinate={{ latitude: pin.lat, longitude: pin.lng }}
      onPress={onPress}
      tracksViewChanges={tracks || isSelected}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={styles.wrap}>
        <View
          style={[
            styles.bubble,
            { borderColor: isSelected ? colors.coral : tone.fg, transform: [{ scale: isSelected ? 1.12 : 1 }] }
          ]}
        >
          {pin.mediaUrl ? (
            <Image source={{ uri: pin.mediaUrl }} style={styles.image} onLoad={() => setTracks(false)} />
          ) : (
            <View style={[styles.image, styles.textPin]} onLayout={() => setTracks(false)}>
              <Ionicons name="chatbubble-ellipses" size={20} color={tone.fg} />
            </View>
          )}
          {pin.count > 1 ? (
            <View style={styles.count}>
              <Text style={styles.countText}>{pin.count}</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.tail, { borderTopColor: isSelected ? colors.coral : tone.fg }]} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", padding: 6 },
  bubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    backgroundColor: colors.paper
  },
  image: { width: "100%", height: "100%", borderRadius: 23 },
  textPin: { alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  count: {
    position: "absolute",
    top: -6,
    right: -8,
    minWidth: 22,
    paddingHorizontal: 5,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white
  },
  countText: { color: colors.white, fontSize: 11, fontWeight: "900" },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1
  }
});
