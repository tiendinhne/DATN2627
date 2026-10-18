"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Search, Users } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/context/auth.context";
import { searchRoomUsers } from "@/services/room.service";
import type { RoomUserSearchResult } from "@/types/backend";

interface InviteDialogProps {
  copied: boolean;
  joinCode?: string;
  roomId: string;
  onCopy: () => void;
  onClose: () => void;
  onInvite: (email: string) => void | Promise<void>;
}

export function InviteDialog({
  copied,
  joinCode = "STUDY-6X2P",
  roomId,
  onCopy,
  onClose,
  onInvite,
}: InviteDialogProps) {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<RoomUserSearchResult | null>(null);
  const [result, setResult] = useState<{ query: string; users: RoomUserSearchResult[] } | null>(null);
  const [searchError, setSearchError] = useState<{ query: string; message: string } | null>(null);
  const [isSending, setIsSending] = useState(false);

  const normalizedQuery = query.trim();

  useEffect(() => {
    if (!token || normalizedQuery.length < 2) return;

    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      searchRoomUsers(token, roomId, normalizedQuery)
        .then((users) => {
          if (isActive) setResult({ query: normalizedQuery, users });
        })
        .catch((err) => {
          if (isActive) {
            setSearchError({
              query: normalizedQuery,
              message: err instanceof Error ? err.message : "Không tìm được người dùng.",
            });
          }
        });
    }, 300);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [normalizedQuery, roomId, token]);

  const visibleUsers = result?.query === normalizedQuery ? result.users : [];
  const hasSearchError = searchError?.query === normalizedQuery ? searchError.message : "";
  const isSearching = normalizedQuery.length >= 2 && result?.query !== normalizedQuery && !hasSearchError;

  const handleSubmit = async () => {
    if (!selected || isSending) return;
    setIsSending(true);
    try {
      await onInvite(selected.email);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      title="Thêm thành viên"
      subtitle="Tìm bạn học theo email hoặc username để thêm vào phòng."
      onClose={onClose}
    >
      <div className="invite-dialog">
        <label className="invite-search">
          <Search size={16} />
          <input
            placeholder="Nhập email hoặc username..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
              setResult(null);
              setSearchError(null);
            }}
            type="text"
            autoFocus
          />
        </label>
        {normalizedQuery.length < 2 ? (
          <p className="dialog-eyebrow">Nhập ít nhất 2 ký tự để tìm kiếm</p>
        ) : isSearching ? (
          <p className="dialog-eyebrow">Đang tìm người dùng...</p>
        ) : hasSearchError ? (
          <p className="dialog-eyebrow text-red-600">{hasSearchError}</p>
        ) : visibleUsers.length > 0 ? (
          <>
            <p className="dialog-eyebrow">KẾT QUẢ TÌM KIẾM</p>
            {visibleUsers.map((user) => {
              const displayName = user.displayName || user.username;
              const initials = displayName.slice(0, 2).toUpperCase();
              const isSelected = selected?.id === user.id;
              return (
                <button
                  className={`invite-result ${isSelected ? "selected" : ""}`}
                  key={user.id}
                  onClick={() => setSelected(user)}
                  type="button"
                >
                  <span>{initials}</span>
                  <p>
                    <strong>{displayName}</strong>
                    <small>{user.email} · @{user.username}</small>
                  </p>
                  <i>{isSelected && <Check size={13} />}</i>
                </button>
              );
            })}
          </>
        ) : result?.query === normalizedQuery ? (
          <p className="dialog-eyebrow">Không tìm thấy người dùng phù hợp.</p>
        ) : null}
        <div className="invite-divider">
          <span>hoặc chia sẻ mã phòng</span>
        </div>
        <div className="invite-code">
          <span>
            <Link2 size={16} />
            <p>
              <small>MÃ PHÒNG</small>
              <strong>{joinCode}</strong>
            </p>
          </span>
          <button onClick={onCopy} type="button">
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Đã sao chép" : "Sao chép"}
          </button>
        </div>
        <div className="dialog-actions">
          <button className="button secondary" onClick={onClose} type="button">
            Hủy
          </button>
          <button
            className="button primary"
            onClick={handleSubmit}
            disabled={!selected || isSending}
            type="button"
          >
            <Users size={16} /> {isSending ? "Đang thêm..." : "Thêm vào phòng"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default InviteDialog;
