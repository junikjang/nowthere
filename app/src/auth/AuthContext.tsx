import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { setTokenProvider } from "../api/client";
import { isDevAuth } from "../config";
import { nicknameFromIdToken, refresh, signIn as cognitoSignIn, type Tokens } from "./cognito";

const STORE_KEY = "nowthere.auth";

type AuthState = {
  ready: boolean;
  nickname: string | null;
  signIn: (emailOrNickname: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function load(): Promise<Tokens | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

async function persist(tokens: Tokens | null) {
  try {
    if (tokens) await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(tokens));
    else await SecureStore.deleteItemAsync(STORE_KEY);
  } catch {
    // SecureStore is unavailable on web; keep the session in memory only
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const tokensRef = useRef<Tokens | null>(null);
  tokensRef.current = tokens;

  useEffect(() => {
    load().then((t) => {
      setTokens(t);
      setReady(true);
    });
  }, []);

  const update = useCallback(async (t: Tokens | null) => {
    tokensRef.current = t;
    setTokens(t);
    await persist(t);
  }, []);

  // The API client asks for a fresh ID token before each authenticated call
  useEffect(() => {
    setTokenProvider(async () => {
      const t = tokensRef.current;
      if (!t) return null;
      if (isDevAuth || t.expiresAt > Date.now()) return t.idToken;
      try {
        const next = await refresh(t.refreshToken);
        await update(next);
        return next.idToken;
      } catch {
        await update(null);
        return null;
      }
    });
  }, [update]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      nickname: tokens ? (isDevAuth ? decodeURIComponent(tokens.idToken.slice(4)) : nicknameFromIdToken(tokens.idToken)) : null,
      signIn: async (emailOrNickname, password) => {
        if (isDevAuth) {
          // Local backend accepts "dev:<nickname>" tokens
          await update({
            idToken: `dev:${encodeURIComponent(emailOrNickname.trim())}`,
            refreshToken: "",
            expiresAt: Number.MAX_SAFE_INTEGER
          });
          return;
        }
        await update(await cognitoSignIn(emailOrNickname.trim(), password));
      },
      signOut: () => update(null)
    }),
    [ready, tokens, update]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
