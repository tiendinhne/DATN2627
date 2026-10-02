import { useEffect, useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { AppShell } from "./components/layout/AppShell";
import { Dashboard } from "./components/dashboard/Dashboard";
import { RoomPage } from "./components/room/RoomPage";
import { MeetingWorkspace } from "./components/meeting/MeetingWorkspace";
import { AuthPage } from "./components/AuthPage";
import { ProfilePage } from "./components/account/ProfilePage";
import { SettingsPage } from "./components/account/SettingsPage";

export type Page =
  | "landing"
  | "login"
  | "register"
  | "forgot-password"
  | "dashboard"
  | "room"
  | "meeting"
  | "profile"
  | "settings";

const pageFromHash = (): Page => {
  const route = window.location.hash.replace("#/", "");
  if (route.startsWith("meetings/")) return "meeting";
  if (route.startsWith("rooms/")) return "room";
  if (route === "profile") return "profile";
  if (route === "settings") return "settings";
  if (route === "register") return "register";
  if (route === "forgot-password") return "forgot-password";
  if (route === "login") return "login";
  if (route === "dashboard") return "dashboard";
  return "landing";
};

export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const handleHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const navigate = (next: Page) => {
    const paths: Record<Page, string> = {
      landing: "/",
      login: "/login",
      register: "/register",
      "forgot-password": "/forgot-password",
      dashboard: "/dashboard",
      room: "/rooms/software-engineering",
      meeting: "/meetings/sprint-review-05",
      profile: "/profile",
      settings: "/settings",
    };
    window.location.hash = paths[next];
    setPage(next);
  };

  if (page === "landing") return <LandingPage onNavigate={navigate} />;
  if (page === "login" || page === "register" || page === "forgot-password")
    return <AuthPage mode={page} onNavigate={navigate} />;
  if (page === "meeting")
    return <MeetingWorkspace dark={dark} onBack={() => navigate("room")} />;

  return (
    <AppShell
      activePage={page}
      dark={dark}
      onThemeChange={() => setDark((value) => !value)}
      onNavigate={navigate}
    >
      {page === "room" ? (
        <RoomPage onNavigate={navigate} />
      ) : page === "profile" ? (
        <ProfilePage />
      ) : page === "settings" ? (
        <SettingsPage dark={dark} onThemeChange={setDark} />
      ) : (
        <Dashboard onNavigate={navigate} />
      )}
    </AppShell>
  );
}
