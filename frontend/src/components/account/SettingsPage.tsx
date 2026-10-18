"use client";

import { SettingsView } from "@/features/account";

export function SettingsPage({
  dark,
  onThemeChange,
}: {
  dark?: boolean;
  onThemeChange?: (value: boolean) => void;
}) {
  return <SettingsView dark={dark} onThemeChange={onThemeChange} />;
}

export default SettingsPage;
