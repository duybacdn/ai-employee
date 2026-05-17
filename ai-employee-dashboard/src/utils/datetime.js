const VN_TZ = "Asia/Ho_Chi_Minh";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function parseServerDate(input) {
  if (!input) return null;

  // Nếu backend trả "YYYY-MM-DDTHH:mm:ss" (không timezone),
  // mặc định hiểu là UTC để convert sang giờ VN chuẩn.
  const hasTz = /([zZ]|[+\-]\d{2}:\d{2})$/.test(input);
  const normalized = hasTz ? input : `${input}Z`;

  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatVN(date, withDate = false) {
  const options = withDate
    ? {
        timeZone: VN_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    : {
        timeZone: VN_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      };

  return new Intl.DateTimeFormat("vi-VN", options).format(date);
}

export function formatVNDateTimeSmart(input) {
  const d = parseServerDate(input);
  if (!d) return "";

  const diff = Date.now() - d.getTime();
  return diff > ONE_DAY_MS ? formatVN(d, true) : formatVN(d, false);
}

export function formatVNDateTimeFull(input) {
  const d = parseServerDate(input);
  if (!d) return "";
  return formatVN(d, true);
}
