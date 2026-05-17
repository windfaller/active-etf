export function assertTradeDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error(`Invalid tradeDate: ${value}`);
  }

  return value;
}

export function todayInTaipei(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(new Date());
}

export function todayRocInTaipei(): string {
  const [year, month, day] = todayInTaipei().split("-").map(Number);
  return `${year - 1911}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

export function rocDateToIsoDate(value: string): string {
  const trimmed = value.trim();
  const match = /^(\d{2,3})\/(\d{2})\/(\d{2})$/u.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid ROC date: ${value}`);
  }

  const year = Number(match[1]) + 1911;
  return `${year}-${match[2]}-${match[3]}`;
}

export function isoDateToRocDate(value: string): string {
  const iso = assertTradeDate(value);
  const [year, month, day] = iso.split("-").map(Number);
  return `${year - 1911}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

export function addDaysIsoDate(value: string, days: number): string {
  const iso = assertTradeDate(value);
  const date = new Date(`${iso}T00:00:00.000+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function sourceDateToIsoDate(value: string): string {
  const trimmed = value.trim();
  const dotNetMatch = /^\/Date\((-?\d+)\)\/$/u.exec(trimmed);
  if (dotNetMatch) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(Number(dotNetMatch[1])));
  }

  if (/^\d{4}-\d{2}-\d{2}T/u.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  if (/^\d{2,3}\/\d{2}\/\d{2}$/u.test(trimmed)) {
    return rocDateToIsoDate(trimmed);
  }

  throw new Error(`Unsupported source date: ${value}`);
}
