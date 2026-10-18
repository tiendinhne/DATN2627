"use client";

import React from "react";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/auth.context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}