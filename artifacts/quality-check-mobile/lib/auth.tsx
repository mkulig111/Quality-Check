import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { setApiToken, api } from "./api";

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
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  signIn: async () => {},
  signOut: async () => {},
});

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem(key)
      : null;
  }
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string) {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureDel(key: string) {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const signIn = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${getBaseUrl()}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.token) {
      throw new Error(data.error ?? "Login failed");
    }
    await secureSet(TOKEN_KEY, data.token);
    setToken(data.token);
    setApiToken(data.token);
    setUser(data.user);
  }, []);

  const signOut = useCallback(async () => {
    const currentToken = token;
    setUser(null);
    setToken(null);
    setApiToken(null);
    await secureDel(TOKEN_KEY);
    if (currentToken) {
      try {
        await fetch(`${getBaseUrl()}/api/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
        });
      } catch {}
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
