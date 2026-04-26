"use server";

import { z } from "zod";
import { createAppointment, listAppointments, listDoctors } from "@/lib/db";
import { addMinutes, toNiceDate } from "@/lib/time";

const schema = z.object({
  doctorId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  severity: z.enum(["emergency", "severe", "normal"]),
  patientName: z.string().min(2).max(80),
  phone: z.string().min(8).max(20),
  email: z.string().email(),
  age: z.coerce.number().int().min(0).max(120),
  gender: z.string().min(1).max(30),
  problemText: z.string().min(3).max(1000),
});

function parseWeekday(date: string) {
  return new Date(`${date}T00:00:00`).getDay();
}

export async function scheduleAppointment(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const doctors = listDoctors();
  const doctor = doctors.find((d) => d.id === parsed.data.doctorId);
  if (!doctor) return { ok: false as const, error: { doctorId: ["Invalid"] } };

  const weekday = parseWeekday(parsed.data.date);
  if (!doctor.workingDays.includes(weekday)) {
    return {
      ok: false as const,
      error: { date: ["Doctor not available on this date"] },
    };
  }

  const created = createAppointment(parsed.data);
  const dayQueue = listAppointments(created.doctorId, created.date);

  const estimatedStartTime = addMinutes(
    doctor.startTime,
    (created.queueNumber - 1) * doctor.slotMins
  );
  const arriveBy = addMinutes(estimatedStartTime, -10);

  return {
    ok: true as const,
    appointment: {
      ...created,
      niceDate: toNiceDate(created.date),
      estimatedStartTime,
      arriveBy,
      queueCount: dayQueue.length,
    },
  };
}

