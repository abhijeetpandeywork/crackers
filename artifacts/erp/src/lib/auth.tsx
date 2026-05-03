import React, { createContext, useContext, useEffect, useState } from "react";
import { setAuthTokenGetter, setUnauthorizedHandler } from "@workspace/api-client-react";
import { useLocation } from "wouter";

const AuthContext = createContext<{
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
}>({
  token: null,
  setToken: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setTokenState] = useState<string | null>(() => {
    return localStorage.getItem("erp_token");
  });
  const [, setLocation] = useLocation();

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("erp_token"));
    setUnauthorizedHandler(() => {
      // Stale/expired token: clear it and bounce to login so a 401 doesn't
      // leave the user stuck on a "Failed to load…" error screen.
      if (localStorage.getItem("erp_token")) {
        localStorage.removeItem("erp_token");
        setTokenState(null);
        setLocation("/login");
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [setLocation]);

  const setToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem("erp_token", newToken);
    } else {
      localStorage.removeItem("erp_token");
    }
    setTokenState(newToken);
  };

  const logout = () => {
    setToken(null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ token, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
