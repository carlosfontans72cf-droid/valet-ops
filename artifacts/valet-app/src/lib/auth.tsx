import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetMe, SessionInfo, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  session: SessionInfo | null;
  isLoading: boolean;
  setToken: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(localStorage.getItem("valet_token"));
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: session, isLoading, error } = useGetMe({
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  const setToken = (newToken: string) => {
    localStorage.setItem("valet_token", newToken);
    setTokenState(newToken);
  };

  const logout = () => {
    localStorage.removeItem("valet_token");
    setTokenState(null);
    queryClient.clear();
    setLocation("/login");
  };

  useEffect(() => {
    if (error) {
      logout();
    }
  }, [error]);

  useEffect(() => {
    const handleStorageChange = () => {
      const currentToken = localStorage.getItem("valet_token");
      if (currentToken !== token) {
        setTokenState(currentToken);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [token]);

  return (
    <AuthContext.Provider value={{ session: session || null, isLoading: isLoading && !!token, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
