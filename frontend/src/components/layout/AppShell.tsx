"use client";

import {
  Bell,
  BookOpen,
  ChevronDown,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  UserRound,
  UsersRound,
  Video,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/auth.context";
import { searchMyRoomsAndMeetings } from "@/services/room.service";
import type { RoomMeetingSearchResponse } from "@/types/backend";

export type NavPage = "dashboard" | "room" | "profile" | "settings";

interface AppShellProps {
  children: ReactNode;
  activePage?: string;
  dark?: boolean;
  onThemeChange?: () => void;
  onNavigate?: (page: any) => void;
}

const nav = [
  { label: "Tổng quan", icon: LayoutDashboard, page: "dashboard" as NavPage, href: "/dashboard" },
  { label: "Phòng của tôi", icon: UsersRound, page: "room" as NavPage, href: "/rooms" },
  { label: "Hồ sơ", icon: UserRound, page: "profile" as NavPage, href: "/profile" },
  { label: "Cài đặt", icon: Settings, page: "settings" as NavPage, href: "/settings" },
];

export function AppShell({
  children,
  activePage,
  dark: propDark,
  onThemeChange: propOnThemeChange,
  onNavigate,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { dark: contextDark, toggleTheme } = useTheme();
  const { user, logout, token } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] =
    useState<RoomMeetingSearchResponse | null>(null);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const searchRequestIdRef = useRef(0);

  const isDark = propDark !== undefined ? propDark : contextDark;
  const handleThemeChange = propOnThemeChange || toggleTheme;

  const currentActivePage: string =
    activePage ||
    (pathname.startsWith("/rooms") || pathname.startsWith("/room")
      ? "room"
      : pathname.startsWith("/profile")
        ? "profile"
        : pathname.startsWith("/settings")
          ? "settings"
          : "dashboard");

  const handleNavClick = (item: (typeof nav)[0]) => {
    setMobileMenuOpen(false);

    if (onNavigate) {
      onNavigate(item.page);
    } else {
      router.push(item.href);
    }
  };

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await logout();

    if (onNavigate) {
      onNavigate("landing");
    } else {
      router.push("/");
    }
  };

  const handleBrandClick = () => {
    if (onNavigate) {
      onNavigate("dashboard");
    } else {
      router.push("/dashboard");
    }
  };

  useEffect(() => {
    const requestId = ++searchRequestIdRef.current;
    const query = searchQuery.trim();
    if (!token || !query) {
      setSearchResults(null);
      setSearchError("");
      setIsSearching(false);
      return;
    }

    setSearchResults(null);
    setSearchError("");
    setIsSearching(true);
    const timer = setTimeout(() => {
      searchMyRoomsAndMeetings(token, query)
        .then((results) => {
          if (requestId === searchRequestIdRef.current) {
            setSearchResults(results);
          }
        })
        .catch((error: unknown) => {
          if (requestId === searchRequestIdRef.current) {
            setSearchError(
              error instanceof Error ? error.message : "Không thể tìm kiếm.",
            );
          }
        })
        .finally(() => {
          if (requestId === searchRequestIdRef.current) {
            setIsSearching(false);
          }
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      if (requestId === searchRequestIdRef.current) {
        searchRequestIdRef.current += 1;
      }
    };
  }, [searchQuery, token]);

  const openRoom = (roomId: string) => {
    setSearchQuery("");
    router.push(`/rooms/${roomId}`);
  };

  const openMeeting = (meetingId: string, roomId: string) => {
    setSearchQuery("");
    router.push(`/meetings/${meetingId}?roomId=${encodeURIComponent(roomId)}`);
  };

  return (
    <div className={isDark ? "app-shell dark-app" : "app-shell"}>
      {mobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <button className="brand" onClick={handleBrandClick}>
          <span className="brand-mark">
            <GraduationCap size={23} />
          </span>
          <span>RusSra</span>
        </button>
        <nav className="mt-9 space-y-1.5" aria-label="Điều hướng chính">
          <p className="nav-eyebrow">KHÔNG GIAN CỦA BẠN</p>
          {nav.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${currentActivePage === item.page ? "active" : ""
                }`}
              onClick={() => handleNavClick(item)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto">
          <div className="help-card">
            <span className="help-icon">
              <BookOpen size={19} />
            </span>
            <p className="font-semibold">Cần trợ giúp?</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Xem hướng dẫn để bắt đầu học nhóm.
            </p>
            <button>Tìm hiểu thêm</button>
          </div>
          <button className="nav-item mt-3" onClick={handleLogout}>
            <LogOut size={19} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="topbar">
          <button
            className={`icon-button menu-toggle-btn ${mobileMenuOpen ? "active" : ""}`}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={mobileMenuOpen}
            type="button"
          >
            <Menu size={20} />
          </button>
          <div className="search-box">
            <Search size={18} />
            <input
              aria-label="Tìm kiếm phòng học và cuộc họp"
              placeholder="Tìm phòng học, cuộc họp..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {searchQuery.trim() && (
              <div className="global-search-results">
                {isSearching && (
                  <p className="global-search-status">Đang tìm kiếm...</p>
                )}
                {searchError && (
                  <p className="global-search-status error">{searchError}</p>
                )}
                {!isSearching &&
                  !searchError &&
                  searchResults &&
                  searchResults.rooms.length === 0 &&
                  searchResults.meetings.length === 0 && (
                    <p className="global-search-status">
                      Không tìm thấy phòng học hoặc cuộc họp.
                    </p>
                  )}
                {searchResults?.rooms.map((room) => (
                  <button
                    className="global-search-result"
                    key={`room-${room.id}`}
                    type="button"
                    onClick={() => openRoom(room.id)}
                  >
                    <UsersRound size={15} />
                    <span>
                      <strong>{room.name}</strong>
                      <small>Phòng học</small>
                    </span>
                  </button>
                ))}
                {searchResults?.meetings.map((meeting) => (
                  <button
                    className="global-search-result"
                    key={`meeting-${meeting.id}`}
                    type="button"
                    onClick={() => openMeeting(meeting.id, meeting.roomId)}
                  >
                    <Video size={15} />
                    <span>
                      <strong>{meeting.title}</strong>
                      <small>Cuộc họp · {meeting.roomName}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="icon-button" onClick={handleThemeChange} aria-label="Đổi giao diện">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-button notification" aria-label="Thông báo">
              <Bell size={19} />
              <span />
            </button>
            <div className="user-divider" />
            <button className="user-menu" onClick={() => router.push("/profile")}>
              <span className="avatar">{(user?.displayName || user?.username || "U")
                .slice(0, 2)
                .toUpperCase()}</span>
              <span className="hidden text-left sm:block">
                <strong>{user?.displayName || user?.username || "Chưa cập nhật"}</strong>
                <small>Sinh viên</small>
              </span>
              <ChevronDown size={16} className="hidden sm:block" />
            </button>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}

export default AppShell;
