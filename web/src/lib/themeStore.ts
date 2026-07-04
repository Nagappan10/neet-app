import { create } from "zustand";

export type Theme = "dark" | "light";

const STORAGE_KEY = "neet-theme";

function initial(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return "dark"; // dark-first per the design system
}

function apply(theme: Theme): void {
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const theme = initial();
  apply(theme);
  return {
    theme,
    toggle: () => {
      const next: Theme = get().theme === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      apply(next);
      set({ theme: next });
    },
  };
});
