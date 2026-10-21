import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../auth/AuthContext";
import { CognitoError, confirmSignUp, resendCode, signUp } from "../auth/cognito";
import { isDevAuth } from "../config";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

type Mode = "signIn" | "signUp" | "confirm";

export function AuthScreen({ onDone }: { onDone: () => void }) {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      if (e instanceof CognitoError && e.code === "UserNotConfirmedException") {
        setMode("confirm");
        await resendCode(email).catch(() => undefined);
      }
      Alert.alert("확인해주세요", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (isDevAuth) {
    return (
      <Shell title="개발 모드 로그인" subtitle="로컬 서버에 연결되어 있습니다. 닉네임만 입력하면 됩니다." onClose={onDone}>
        <Field value={nickname} onChangeText={setNickname} placeholder="닉네임" />
        <Primary
          label="시작하기"
          busy={busy}
          onPress={() => run(async () => {
            if (!nickname.trim()) throw new Error("닉네임을 입력해주세요");
            await signIn(nickname, "");
            onDone();
          })}
        />
      </Shell>
    );
  }

  if (mode === "confirm") {
    return (
      <Shell title="이메일 인증" subtitle={`${email}로 보낸 6자리 코드를 입력해주세요.`} onClose={onDone}>
        <Field value={code} onChangeText={setCode} placeholder="인증 코드" keyboardType="number-pad" />
        <Primary
          label="인증하고 로그인"
          busy={busy}
          onPress={() =>
            run(async () => {
              await confirmSignUp(email, code);
              await signIn(email, password);
              onDone();
            })
          }
        />
        <Link label="코드 다시 받기" onPress={() => run(() => resendCode(email))} />
      </Shell>
    );
  }

  const isSignUp = mode === "signUp";
  return (
    <Shell
      title={isSignUp ? "가입하기" : "로그인"}
      subtitle="현장 소식을 공유하려면 계정이 필요합니다. 둘러보기는 로그인 없이 가능합니다."
      onClose={onDone}
    >
      <Field value={email} onChangeText={setEmail} placeholder="이메일" keyboardType="email-address" />
      <Field value={password} onChangeText={setPassword} placeholder="비밀번호 (8자 이상)" secureTextEntry />
      {isSignUp ? <Field value={nickname} onChangeText={setNickname} placeholder="닉네임 (공개)" /> : null}
      <Primary
        label={isSignUp ? "가입하고 인증 코드 받기" : "로그인"}
        busy={busy}
        onPress={() =>
          run(async () => {
            if (isSignUp) {
              if (!nickname.trim()) throw new Error("닉네임을 입력해주세요");
              await signUp(email.trim(), password, nickname.trim());
              setMode("confirm");
            } else {
              await signIn(email, password);
              onDone();
            }
          })
        }
      />
      <Link
        label={isSignUp ? "이미 계정이 있어요" : "처음이에요, 가입할게요"}
        onPress={() => setMode(isSignUp ? "signIn" : "signUp")}
      />
    </Shell>
  );
}

function Shell(props: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={props.onClose} style={styles.close}>
            <Ionicons name="close" size={20} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>{props.title}</Text>
          <Text style={styles.subtitle}>{props.subtitle}</Text>
          {props.children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      autoCapitalize="none"
      autoCorrect={false}
      placeholderTextColor={colors.slate}
      style={styles.input}
      {...props}
    />
  );
}

function Primary({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.button, busy && { opacity: 0.6 }]} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonLabel}>{label}</Text>}
    </Pressable>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.link}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.sand },
  content: { padding: spacing.lg, gap: spacing.md },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line
  },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900", marginTop: spacing.md },
  subtitle: { color: colors.slate, fontSize: 15, lineHeight: 22, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.paper,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.ink,
    fontSize: 15
  },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 20,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: spacing.sm
  },
  buttonLabel: { color: colors.white, fontSize: 16, fontWeight: "900" },
  link: { alignItems: "center", paddingVertical: spacing.sm },
  linkText: { color: colors.coral, fontSize: 14, fontWeight: "800" }
});
