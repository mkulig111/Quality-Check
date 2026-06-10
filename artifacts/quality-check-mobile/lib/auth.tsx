import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { setApiToken, api } from "./api";

const ISSUER = "https://replit.com/oidc";
const TOKEN_KEY = "qc_session_token";

export interface AuthUser {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  role?: "manager" | "inspector" | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
});

const discovery = {
  authorizationEndpoint: `${ISSUER}/auth`,
  tokenEndpoint: `${ISSUER}/token`,
  revocationEndpoint: `${ISSUER}/token/revocation`,
  endSessionEndpoint: `${ISSUER}/session/end`,
};

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") return null;
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string) {
  if (Platform.OS === "web") return;
  await SecureStore.setItemAsync(key, value);
}

async function secureDel(key: string) {
  if (Platform.OS === "web") return;
  await SecureStore.deleteItemAsync(key);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: "quality-check-mobile" });

  // Capture request so we can read its codeVerifier in the response handler
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_REPL_ID ?? "replit",
      redirectUri,
      scopes: ["openid", "profile", "email"],
      usePKCE: true,
    },
    discovery
  );

  // Keep a stable ref to the latest request so the response effect can read it
  const requestRef = useRef(request);
  useEffect(() => { requestRef.current = request; }, [request]);

  const fetchUser = useCallback(async (sessionToken: string) => {
    try {
      setApiToken(sessionToken);
      const envelope = await api.get<{ user: AuthUser | null }>("/api/auth/user");
      setUser(envelope.user);
      return !!envelope.user;
    } catch {
      setApiToken(null);
      return false;
    }
  }, []);

  // Restore session from SecureStore on mount
  useEffect(() => {
    (async () => {
      const stored = await secureGet(TOKEN_KEY);
      if (stored) {
        const ok = await fetchUser(stored);
        if (ok) {
          setToken(stored);
        } else {
          await secureDel(TOKEN_KEY);
        }
      }
      setIsLoading(false);
    })();
  }, [fetchUser]);

  // Handle OIDC callback — use request.codeVerifier (PKCE verifier is on the request, not response)
  useEffect(() => {
    if (!response || response.type !== "success") return;

    const { code, state } = response.params;
    const codeVerifier = requestRef.current?.codeVerifier ?? "";

    (async () => {
      try {
        const body = {
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
          state: state ?? "",
          nonce: null,
        };
        const res = await fetch(`${getBaseUrl()}/api/mobile-auth/token-exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok || !data.token) throw new Error("Token exchange failed");
        await secureSet(TOKEN_KEY, data.token);
        setToken(data.token);
        await fetchUser(data.token);
      } catch (err) {
        console.error("Auth error:", err);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const signIn = useCallback(async () => {
    await promptAsync();
  }, [promptAsync]);

  const signOut = useCallback(async () => {
    const currentToken = token;
    setUser(null);
    setToken(null);
    setApiToken(null);
    await secureDel(TOKEN_KEY);
    if (currentToken) {
      try {
        await fetch(`${getBaseUrl()}/api/mobile-auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
        });
      } catch {
      }
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
