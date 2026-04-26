export function addMinutes(hhmm: string, mins: number) {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  const total = h * 60 + m + mins;
  const hh = Math.floor((total % (24 * 60)) / 60)
    .toString()
    .padStart(2, "0");
  const mm = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");
  return `${hh}:${mm}`;
}

export function minutesBetween(startHHMM: string, endHHMM: string) {
  const [sh, sm] = startHHMM.split(":").map((x) => Number(x));
  const [eh, em] = endHHMM.split(":").map((x) => Number(x));
  return eh * 60 + em - (sh * 60 + sm);
}

export function toNiceDate(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

