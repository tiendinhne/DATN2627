"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import type { Collaborator, ExcalidrawImperativeAPI, SocketId } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import { API_BASE_URL } from "@/services/api";
import { WB_ELEMENT_TYPES, WB_MAX_BATCH_BYTES, WB_MAX_BATCH_ELEMENTS } from "@shared/whiteboard";

// Chu kỳ gửi nét vẽ / con trỏ — throttle, KHÔNG debounce: đang kéo hình vẫn gửi đều (spec §1 câu 7)
const SEND_INTERVAL_MS = 50;
// Con trỏ người khác im quá 5 s thì ẩn
const POINTER_IDLE_MS = 5000;

type ExcalidrawLib = typeof import("@excalidraw/excalidraw");

// Envelope server gửi xuống (PROJECT_CONTEXT §9) — chỉ đọc field cần
interface Envelope<T> {
  meetingId: string | null;
  data: T;
}

// Throttle tối giản: lần đầu chạy ngay, các lần gọi trong chu kỳ gộp thành 1 lần chạy cuối chu kỳ
function throttle(fn: () => void, ms: number) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    last = Date.now();
    timer = null;
    fn();
  };
  const call = () => {
    if (timer) return;
    const wait = ms - (Date.now() - last);
    if (wait <= 0) run();
    else timer = setTimeout(run, wait);
  };
  call.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return call;
}

const encoder = new TextEncoder();
const noop = () => {};

export function useWhiteboardSync({
  token,
  meetingId,
  api,
}: {
  token?: string | null;
  meetingId?: string;
  api: ExcalidrawImperativeAPI | null;
}) {
  const [notice, setNotice] = useState("");
  // Hàm thật gắn vào onChange / onPointerUpdate — đổi mỗi khi socket đổi
  const handlersRef = useRef<{ onChange: () => void; onPointer: (x: number, y: number) => void }>({
    onChange: noop,
    onPointer: noop,
  });
  // id → version đã gửi đi hoặc nhận về gần nhất: chỉ gửi phần đổi + chống echo (spec §9)
  const syncedVersions = useRef(new Map<string, number>());

  useEffect(() => {
    // Chưa có meeting / token / Excalidraw chưa sẵn sàng → bảng chạy local
    if (!api || !token || !meetingId) return;

    let lib: ExcalidrawLib | null = null;
    let disposed = false;
    const synced = syncedVersions.current;
    const warned = new Set<string>();
    const collaborators = new Map<SocketId, Collaborator>();
    const lastSeen = new Map<SocketId, number>();
    let pointer: { x: number; y: number } | null = null;
    // Server từ chối 403 mọi wb:ops / wb:pointer trước khi join xong → chỉ gửi sau khi nhận snapshot
    let joined = false;

    // Kết nối sau khi tải xong thư viện → snapshot không bao giờ tới trước reconcileElements
    const socket = io(`${API_BASE_URL}/meeting`, {
      auth: { token },
      transports: ["websocket"],
      autoConnect: false,
    });

    // Áp element nhận được: reconcile (giữ element mình đang gõ / kéo / vẽ dở) → không vào undo/redo
    const applyRemote = (remote: unknown[]) => {
      if (!lib || remote.length === 0) return;
      let restored: OrderedExcalidrawElement[];
      try {
        restored = lib.restoreElements(remote as OrderedExcalidrawElement[], null) as OrderedExcalidrawElement[];
      } catch {
        // 1 element lỗi không được làm hỏng cả bảng: thử từng cái, bỏ cái ném lỗi
        restored = [];
        for (const item of remote) {
          try {
            restored.push(...(lib.restoreElements([item as OrderedExcalidrawElement], null) as OrderedExcalidrawElement[]));
          } catch {
            setNotice("Bỏ qua một đối tượng bảng vẽ bị lỗi.");
          }
        }
      }
      // Version cũ để hoàn tác nếu updateScene lỗi (đã phải ghi TRƯỚC updateScene để onChange không echo lại)
      const previous = new Map<string, number | undefined>();
      try {
        const elements = lib.reconcileElements(
          api.getSceneElementsIncludingDeleted(),
          restored as RemoteExcalidrawElement[],
          api.getAppState(),
        );
        // Chỉ ghi version của element nhận về đã được áp; element local đang sửa dở giữ nguyên để còn gửi
        const reconciledById = new Map(elements.map((element) => [element.id, element]));
        for (const element of restored) {
          if (reconciledById.get(element.id)?.version === element.version) {
            previous.set(element.id, synced.get(element.id));
            synced.set(element.id, Math.max(synced.get(element.id) ?? 0, element.version));
          }
        }
        api.updateScene({ elements, captureUpdate: lib.CaptureUpdateAction.NEVER });
      } catch (error) {
        // Không áp được → bỏ version đã ghi, phần chưa áp không bị coi là đã đồng bộ
        for (const [id, version] of previous) {
          if (version === undefined) synced.delete(id);
          else synced.set(id, version);
        }
        setNotice("Không áp được dữ liệu bảng vẽ.");
        console.error(error);
      }
    };

    // Gửi element có version mới hơn bản đã đồng bộ, chia batch theo số lượng + byte
    const flush = () => {
      if (!socket.connected || !joined) return; // mất mạng / chưa join: chưa ghi version → snapshot sau reconnect sẽ gửi
      const batches: OrderedExcalidrawElement[][] = [];
      let batch: OrderedExcalidrawElement[] = [];
      let batchBytes = 2; // "[]"
      for (const element of api.getSceneElementsIncludingDeleted()) {
        if (element.version <= (synced.get(element.id) ?? 0)) continue;
        synced.set(element.id, element.version); // ghi lúc gửi, không chờ server
        const bytes = encoder.encode(JSON.stringify(element)).length;
        // Lọc trước khi gửi: loại không đồng bộ (vd embeddable) hoặc quá lớn → chỉ ở máy mình (spec §6, §9)
        if (!WB_ELEMENT_TYPES.includes(element.type) || bytes > WB_MAX_BATCH_BYTES - 2) {
          if (!warned.has(element.id)) {
            warned.add(element.id);
            setNotice("Đối tượng này chỉ hiện trên máy bạn, không đồng bộ.");
          }
          continue;
        }
        if (batch.length > 0 && (batch.length === WB_MAX_BATCH_ELEMENTS || batchBytes + bytes + 1 > WB_MAX_BATCH_BYTES)) {
          batches.push(batch);
          batch = [];
          batchBytes = 2;
        }
        batch.push(element);
        batchBytes += bytes + 1; // + dấu phẩy
      }
      if (batch.length) batches.push(batch);
      for (const elements of batches) socket.emit("wb:ops", { meetingId, elements });
    };

    const scheduleFlush = throttle(flush, SEND_INTERVAL_MS);
    const sendPointer = throttle(() => {
      if (pointer && socket.connected && joined) socket.emit("wb:pointer", { meetingId, ...pointer });
    }, SEND_INTERVAL_MS);
    const showCollaborators = () => api.updateScene({ collaborators: new Map(collaborators) });

    socket.on("connect", () => {
      joined = false;
      socket.emit("meeting:join", { meetingId });
    });
    socket.on("disconnect", () => {
      joined = false;
    });
    socket.on("meeting:snapshot", (envelope: Envelope<{ elements: unknown[] }>) => {
      if (envelope.meetingId !== meetingId) return;
      setNotice("");
      joined = true; // trước applyRemote / flush để flush không bị chặn
      // Snapshot là sự thật của server — xoá map để phần chỉ có ở máy mình (op đang bay lúc mất kết nối,
      // op bị từ chối tạm thời) được gửi lại ở flush() ngay sau
      synced.clear();
      applyRemote(envelope.data.elements);
      flush(); // gửi phần đã vẽ lúc mất mạng
    });
    socket.on("wb:ops", (envelope: Envelope<{ elements: unknown[] }>) => {
      if (envelope.meetingId === meetingId) applyRemote(envelope.data.elements);
    });
    socket.on(
      "wb:pointer",
      (envelope: Envelope<{ userId: string; displayName: string; x: number; y: number }>) => {
        if (envelope.meetingId !== meetingId) return;
        const id = envelope.data.userId as SocketId;
        collaborators.set(id, {
          id: envelope.data.userId,
          username: envelope.data.displayName,
          pointer: { x: envelope.data.x, y: envelope.data.y, tool: "pointer" },
        });
        lastSeen.set(id, Date.now());
        showCollaborators();
      }
    );
    socket.on("error", (error: { message?: string | string[] }) => {
      const message = Array.isArray(error?.message) ? error.message.join(", ") : error?.message;
      setNotice(message || "Lỗi đồng bộ bảng vẽ.");
    });
    socket.on("connect_error", () => setNotice("Mất kết nối bảng vẽ, đang thử lại..."));

    // Ẩn con trỏ người im lâu
    const idleTimer = setInterval(() => {
      let changed = false;
      for (const [id, at] of lastSeen) {
        if (Date.now() - at > POINTER_IDLE_MS) {
          lastSeen.delete(id);
          collaborators.delete(id);
          changed = true;
        }
      }
      if (changed) showCollaborators();
    }, 1000);

    handlersRef.current = {
      onChange: scheduleFlush,
      onPointer: (x, y) => {
        pointer = { x, y };
        sendPointer();
      },
    };

    // Next.js SSR: chỉ tải thư viện ở trình duyệt (giống WhiteboardCanvas dùng next/dynamic)
    void import("@excalidraw/excalidraw").then((module) => {
      lib = module;
      if (!disposed) socket.connect();
    });

    return () => {
      disposed = true;
      handlersRef.current = { onChange: noop, onPointer: noop };
      flush(); // gửi nốt phần ≤ 50 ms chưa kịp gửi, trước khi huỷ throttle và rời kênh
      scheduleFlush.cancel();
      sendPointer.cancel();
      clearInterval(idleTimer);
      if (socket.connected) socket.emit("meeting:leave", { meetingId });
      socket.disconnect();
    };
  }, [api, token, meetingId]);

  const onChange = useCallback(() => handlersRef.current.onChange(), []);
  const onPointerUpdate = useCallback(
    (payload: { pointer: { x: number; y: number } }) =>
      handlersRef.current.onPointer(payload.pointer.x, payload.pointer.y),
    []
  );
  const clearNotice = useCallback(() => setNotice(""), []);

  return { onChange, onPointerUpdate, notice, clearNotice };
}
