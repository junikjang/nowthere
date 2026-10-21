import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError, api, uploadPhoto, waitForPublished } from "../api/client";
import type { Post, VerificationStatus } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { VerificationBadge } from "../components/VerificationBadge";
import { getCurrentFix, placeLabel, type DeviceFix } from "../lib/location";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type ShareComposerScreenProps = {
  onBack: () => void;
  onRequireLogin: () => void;
};

type Photo = { uri: string; capturedAt: Date | null };

const TAGS = ["혼잡", "한산", "비", "눈", "교통", "사고", "행사", "맛집"];

/** "YYYY:MM:DD HH:MM:SS" in device-local time (what the picker reports) */
function parseLocalExif(exif: Record<string, unknown> | null | undefined): Date | null {
  const nested = (exif?.["{Exif}"] ?? {}) as Record<string, unknown>;
  const raw = exif?.DateTimeOriginal ?? nested.DateTimeOriginal ?? exif?.DateTime;
  if (typeof raw !== "string") return null;
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number) as number[];
  const date = new Date(y!, mo! - 1, d!, h!, mi!, s!);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Client-side preview only — the server makes the real decision from the uploaded file */
function estimate(photo: Photo | null, isText: boolean, fix: DeviceFix | null): VerificationStatus {
  if (!fix) return "unverified";
  const accuracyOk = fix.accuracyM == null || fix.accuracyM <= 150;
  if (isText) return accuracyOk ? "verified_now" : "verified_nearby";
  if (!photo?.capturedAt) return "unverified";
  const age = (Date.now() - photo.capturedAt.getTime()) / 60_000;
  if (age <= 10 && accuracyOk) return "verified_now";
  if (age <= 60) return "verified_nearby";
  return "unverified";
}

export function ShareComposerScreen({ onBack, onRequireLogin }: ShareComposerScreenProps) {
  const { nickname } = useAuth();
  const [fix, setFix] = useState<DeviceFix | null>(null);
  const [fixError, setFixError] = useState<string | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [phase, setPhase] = useState<"compose" | "posting" | "verifying" | "done">("compose");
  const [result, setResult] = useState<Post | null>(null);

  useEffect(() => {
    getCurrentFix()
      .then(async (f) => {
        setFix(f);
        const label = await placeLabel(f.lat, f.lng);
        setPlaceName((prev) => prev || label || "");
      })
      .catch((e) => setFixError(String(e.message ?? e)));
  }, []);

  const pick = async (source: "camera" | "library") => {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("권한 필요", source === "camera" ? "카메라 권한을 허용해주세요." : "사진 접근 권한을 허용해주세요.");
      return;
    }
    // quality: 1 avoids re-encoding, which keeps the original EXIF in the file for server-side verification
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, exif: true };
    const res =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const isJpeg = asset.mimeType ? /jpe?g/i.test(asset.mimeType) : /\.jpe?g$/i.test(asset.uri);
    if (!isJpeg) {
      Alert.alert("지원하지 않는 형식", "현재는 JPEG 사진만 올릴 수 있습니다.");
      return;
    }
    setPhoto({
      uri: asset.uri,
      capturedAt: parseLocalExif(asset.exif as Record<string, unknown> | null) ?? (source === "camera" ? new Date() : null)
    });
  };

  const submit = async () => {
    if (!nickname) {
      onRequireLogin();
      return;
    }
    if (!fix) {
      Alert.alert("위치 필요", "현재 위치를 확인할 수 없어 게시할 수 없습니다.");
      return;
    }
    if (!photo && caption.trim().length === 0) {
      Alert.alert("내용 필요", "사진을 추가하거나 지금 상황을 적어주세요.");
      return;
    }
    if (!placeName.trim()) {
      Alert.alert("장소 이름 필요", "어디인지 장소 이름을 적어주세요.");
      return;
    }
    setPhase("posting");
    try {
      const { post, upload } = await api.createPost({
        mediaType: photo ? "image" : "text",
        caption: caption.trim(),
        tags,
        placeName: placeName.trim(),
        location: { lat: fix.lat, lng: fix.lng },
        device: { lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM },
        clientCapturedAt: photo?.capturedAt?.toISOString() ?? null,
        clientUtcOffsetMinutes: -new Date().getTimezoneOffset()
      });
      if (upload && photo) {
        await uploadPhoto(upload, photo.uri);
        setPhase("verifying");
        setResult(await waitForPublished(post.id));
      } else {
        setResult(post);
      }
      setPhase("done");
    } catch (e) {
      setPhase("compose");
      if (e instanceof ApiError && e.status === 401) onRequireLogin();
      else Alert.alert("게시 실패", (e as Error).message);
    }
  };

  if (phase === "done" && result) {
    const v = result.verification;
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.content, styles.doneBox]}>
          <Ionicons
            name={result.status === "published" ? "checkmark-circle" : "time"}
            size={56}
            color={result.status === "published" ? colors.teal : colors.slate}
          />
          <Text style={styles.title}>
            {result.status === "published"
              ? "게시되었습니다"
              : result.status === "rejected"
                ? "게시할 수 없는 사진입니다"
                : "검증이 진행 중입니다"}
          </Text>
          {v ? <VerificationBadge status={v.status} /> : null}
          {v?.reasons.map((r) => (
            <Text key={r} style={styles.subtitle}>
              {`· ${r}`}
            </Text>
          ))}
          <Pressable style={[styles.submitButton, styles.fullWidth]} onPress={onBack}>
            <Text style={styles.submitLabel}>지도로 돌아가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const expected = estimate(photo, !photo, fix);
  const busy = phase !== "compose";

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={onBack} style={styles.backButton} disabled={busy}>
            <Ionicons name="close" size={20} color={colors.ink} />
          </Pressable>

          <Text style={styles.title}>지금 이 순간 공유하기</Text>
          <Text style={styles.subtitle}>
            방금 찍은 사진일수록, 실제 장소에 가까울수록 높은 검증 배지를 받습니다.
          </Text>

          {photo ? (
            <View>
              <Image source={{ uri: photo.uri }} style={styles.preview} />
              <Pressable style={styles.removePhoto} onPress={() => setPhoto(null)} disabled={busy}>
                <Ionicons name="close" size={16} color={colors.white} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <Pressable style={styles.actionCard} onPress={() => pick("camera")}>
                <Ionicons name="camera" size={22} color={colors.coral} />
                <Text style={styles.actionLabel}>카메라로 찍기</Text>
              </Pressable>
              <Pressable style={styles.actionCard} onPress={() => pick("library")}>
                <Ionicons name="images" size={22} color={colors.ocean} />
                <Text style={styles.actionLabel}>앨범에서 선택</Text>
              </Pressable>
            </View>
          )}

          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder={photo ? "설명 (선택)" : "지금 여기 상황은 어떤가요?"}
            placeholderTextColor={colors.slate}
            multiline
            maxLength={500}
            style={[styles.input, styles.captionInput]}
          />

          <View>
            <Text style={styles.fieldLabel}>장소 이름</Text>
            <TextInput
              value={placeName}
              onChangeText={setPlaceName}
              placeholder="예: 강남역 2번 출구"
              placeholderTextColor={colors.slate}
              maxLength={60}
              style={styles.input}
            />
          </View>

          <View style={styles.tagRow}>
            {TAGS.map((tag) => {
              const on = tags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => setTags(on ? tags.filter((t) => t !== tag) : [...tags, tag].slice(0, 5))}
                  style={[styles.tag, on && styles.tagOn]}
                >
                  <Text style={[styles.tagText, on && styles.tagTextOn]}>{`#${tag}`}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>검증 미리보기</Text>
            <Text style={styles.panelLine}>
              {`촬영 시각: ${
                photo ? (photo.capturedAt ? photo.capturedAt.toLocaleTimeString("ko-KR") : "정보 없음") : "텍스트 (게시 시각 기준)"
              }`}
            </Text>
            <Text style={styles.panelLine}>
              {`현재 위치: ${
                fix ? `확인됨 (±${Math.round(fix.accuracyM ?? 0)}m)` : fixError ? fixError : "확인 중..."
              }`}
            </Text>
            <View style={styles.expectedRow}>
              <Text style={styles.panelLine}>예상 배지</Text>
              <VerificationBadge status={expected} />
            </View>
            <Text style={styles.panelNote}>최종 배지는 서버가 사진 원본의 EXIF와 수신 시각으로 판정합니다.</Text>
          </View>

          <Pressable style={[styles.submitButton, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
            {busy ? (
              <View style={styles.busyRow}>
                <ActivityIndicator color={colors.white} />
                <Text style={styles.submitLabel}>{phase === "verifying" ? "서버에서 검증 중..." : "올리는 중..."}</Text>
              </View>
            ) : (
              <Text style={styles.submitLabel}>{nickname ? "지금 게시하기" : "로그인하고 게시하기"}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.sand },
  content: { padding: spacing.lg, gap: spacing.lg },
  doneBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  fullWidth: { alignSelf: "stretch", marginTop: spacing.lg },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line
  },
  title: { color: colors.ink, fontSize: 28, fontWeight: "900" },
  subtitle: { color: colors.slate, fontSize: 15, lineHeight: 22 },
  actionRow: { flexDirection: "row", gap: spacing.md },
  actionCard: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line
  },
  actionLabel: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  preview: { width: "100%", height: 240, borderRadius: 24, backgroundColor: colors.cloud },
  removePhoto: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(31,35,40,0.7)",
    alignItems: "center",
    justifyContent: "center"
  },
  fieldLabel: { color: colors.slate, fontSize: 12, fontWeight: "800", marginBottom: 6 },
  input: {
    backgroundColor: colors.paper,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 15
  },
  captionInput: { minHeight: 90, textAlignVertical: "top" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line
  },
  tagOn: { backgroundColor: colors.coral, borderColor: colors.coral },
  tagText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  tagTextOn: { color: colors.white },
  panel: {
    backgroundColor: "#DAF0EA",
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: "#B8DCCF"
  },
  panelTitle: { color: colors.teal, fontSize: 18, fontWeight: "900" },
  panelLine: { color: colors.ink, fontSize: 14 },
  panelNote: { color: colors.slate, fontSize: 12, lineHeight: 18 },
  expectedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  submitButton: { backgroundColor: colors.ink, borderRadius: 20, paddingVertical: 18, alignItems: "center" },
  submitLabel: { color: colors.white, fontSize: 16, fontWeight: "900" },
  busyRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" }
});
