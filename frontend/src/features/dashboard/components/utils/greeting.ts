const TZ = "Asia/Ho_Chi_Minh";

export function getGreeting(date: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: TZ }).format(date)
  );
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 13) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

export function formatEyebrow(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  })
    .format(date)
    .toLocaleUpperCase("vi-VN");
}