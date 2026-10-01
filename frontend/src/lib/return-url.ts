// Chỉ nhận đường dẫn nội bộ như "/join/ABCD2345", còn lại về /dashboard (chống open redirect).
// Không tự kiểm chuỗi bằng startsWith: trình duyệt tự bỏ tab/xuống dòng và coi "\" như "/",
// nên "/\t/evil.com" vẫn thành "//evil.com". Dùng chính bộ phân tích URL của trình duyệt rồi so origin.
// Chỉ gọi phía trình duyệt (cần window) — trong event handler / useEffect.
export function safeReturnUrl(value: string | null): string {
  if (!value) return '/dashboard';
  try {
    const url = new URL(value, window.location.origin);
    // "/.//evil.com" vẫn cùng origin nhưng pathname = "//evil.com" → trình duyệt hiểu là domain khác
    if (url.origin === window.location.origin && !url.pathname.startsWith('//')) {
      return url.pathname + url.search + url.hash;
    }
  } catch {
    // Không phân tích được thành URL → coi như không hợp lệ
  }
  return '/dashboard';
}
