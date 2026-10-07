const TZ = "America/Mexico_City";

const shortDateFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "short",
  timeZone: TZ,
});

const longDateFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "long",
  timeZone: TZ,
});

const shortDateTimeFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: TZ,
});

const longDateTimeFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: TZ,
});

const mediumDateTimeFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: TZ,
});

export function fmtDateShort(d: Date | string): string {
  return shortDateFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function fmtDateLong(d: Date | string): string {
  return longDateFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function fmtDateTimeShort(d: Date | string): string {
  return shortDateTimeFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function fmtDateTimeLong(d: Date | string): string {
  return longDateTimeFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function fmtDateTimeMedium(d: Date | string): string {
  return mediumDateTimeFmt.format(typeof d === "string" ? new Date(d) : d);
}

/**
 * Para campos Prisma `@db.Date` — Postgres DATE se devuelve como midnight UTC.
 * Extraer componentes UTC directamente evita que UTC-6 cruce al día anterior.
 */
export function fmtDateOnly(d: Date | string): string {
  const iso = typeof d === "string" ? d : d.toISOString();
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
