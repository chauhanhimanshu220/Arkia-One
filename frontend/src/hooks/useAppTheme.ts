import { useEffect, useState } from "react";

export type AppTheme = "light" | "dark";

export const APP_THEME_STORAGE_KEY = "admin-dashboard-theme";

export const getStoredAppTheme = (): AppTheme => {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.localStorage.getItem(APP_THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
};

export const applyAppTheme = (theme: AppTheme) => {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, theme);
  }
};

export const useAppTheme = () => {
  const [theme, setTheme] = useState<AppTheme>(() => getStoredAppTheme());

  useEffect(() => {
    applyAppTheme(theme);
  }, [theme]);

  return {
    theme,
    setTheme,
    toggleTheme: () => setTheme((current) => (current === "light" ? "dark" : "light")),
  };
};
