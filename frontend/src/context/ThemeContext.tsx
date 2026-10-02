"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface ThemeContextType {
  dark: boolean;
  setDark: (value: boolean) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  dark: false,
  setDark: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState<boolean>(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("studyspace_theme");
    if (savedTheme === "dark") {
      setDark(true);
    }
  }, []);

  const handleSetDark = (value: boolean) => {
    setDark(value);
    localStorage.setItem("studyspace_theme", value ? "dark" : "light");
  };

  const toggleTheme = () => {
    handleSetDark(!dark);
  };

  return (
    <ThemeContext.Provider value={{ dark, setDark: handleSetDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
