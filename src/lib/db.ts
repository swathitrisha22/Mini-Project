import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

export type Doctor = {
  id: string;
  name: string;
  specialty: string;
  workingDays: number[]; // 0=Sun..6=Sat
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  slotMins: number;
};

export type Appointment = {
  id: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  date: string; // YYYY-MM-DD
  queueNumber: number;
  priority: number; // 2=high, 1=normal
  patientName: string;
  phone: string;
  email: string;
  age: number;
  gender: string;
  problemText: string;
  createdAt: string;
};

let _db: Database.Database | null = null;

function ensureDbDir(dbFilePath: string) {
  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function getDb() {
  if (_db) return _db;

  const dbFile = path.join(process.cwd(), "data", "app.db");
  ensureDbDir(dbFile);

  const db = new Database(dbFile);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      working_days TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      slot_mins INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      doctor_id TEXT NOT NULL,
      date TEXT NOT NULL,
      queue_number INTEGER NOT NULL,
      priority INTEGER NOT NULL,
      patient_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      problem_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    );

    CREATE INDEX IF NOT EXISTS idx_appt_doctor_date ON appointments(doctor_id, date);
  `);

  const count = db.prepare("SELECT COUNT(*) as c FROM doctors").get() as {
    c: number;
  };
  if (count.c === 0) seedDoctors(db);

  _db = db;
  return db;
}

function seedDoctors(db: Database.Database) {
  const doctors: Doctor[] = [
    {
      id: "doc_001",
      name: "Dr. Asha Rao",
      specialty: "General Physician",
      workingDays: [1, 2, 3, 4, 5],
      startTime: "09:30",
      endTime: "13:00",
      slotMins: 15,
    },
    {
      id: "doc_002",
      name: "Dr. Kiran Mehta",
      specialty: "Dermatology",
      workingDays: [1, 3, 5],
      startTime: "15:00",
      endTime: "18:30",
      slotMins: 15,
    },
    {
      id: "doc_003",
      name: "Dr. Neha Iyer",
      specialty: "Pediatrics",
      workingDays: [2, 4, 6],
      startTime: "10:00",
      endTime: "14:00",
      slotMins: 20,
    },
    {
      id: "doc_004",
      name: "Dr. Sameer Khan",
      specialty: "Orthopedics",
      workingDays: [1, 2, 4, 6],
      startTime: "11:00",
      endTime: "15:00",
      slotMins: 20,
    },
    {
      id: "doc_005",
      name: "Dr. Priya Sharma",
      specialty: "ENT",
      workingDays: [1, 2, 3, 4, 5],
      startTime: "16:00",
      endTime: "19:00",
      slotMins: 15,
    },
  ];

  const insert = db.prepare(`
    INSERT INTO doctors (id, name, specialty, working_days, start_time, end_time, slot_mins)
    VALUES (@id, @name, @specialty, @working_days, @start_time, @end_time, @slot_mins)
  `);

  const tx = db.transaction(() => {
    for (const d of doctors) {
      insert.run({
        id: d.id,
        name: d.name,
        specialty: d.specialty,
        working_days: d.workingDays.join(","),
        start_time: d.startTime,
        end_time: d.endTime,
        slot_mins: d.slotMins,
      });
    }
  });
  tx();
}

export function listDoctors(): Doctor[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name, specialty, working_days, start_time, end_time, slot_mins FROM doctors ORDER BY specialty, name`
    )
    .all() as Array<{
    id: string;
    name: string;
    specialty: string;
    working_days: string;
    start_time: string;
    end_time: string;
    slot_mins: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    specialty: r.specialty,
    workingDays: r.working_days
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isFinite(n)),
    startTime: r.start_time,
    endTime: r.end_time,
    slotMins: r.slot_mins,
  }));
}

export function createAppointment(input: {
  doctorId: string;
  date: string;
  severity: "emergency" | "severe" | "normal";
  patientName: string;
  phone: string;
  email: string;
  age: number;
  gender: string;
  problemText: string;
}): Appointment {
  const db = getDb();

  const doctor = db
    .prepare(`SELECT * FROM doctors WHERE id = ?`)
    .get(input.doctorId) as
    | {
        id: string;
        name: string;
        specialty: string;
        working_days: string;
        start_time: string;
        end_time: string;
        slot_mins: number;
      }
    | undefined;
  if (!doctor) throw new Error("Doctor not found");

  const priority = input.severity === "normal" ? 1 : 2;
  const apptId = createId("appt");
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO appointments
      (id, doctor_id, date, queue_number, priority, patient_name, phone, email, age, gender, problem_text, created_at)
     VALUES
      (@id, @doctor_id, @date, @queue_number, @priority, @patient_name, @phone, @email, @age, @gender, @problem_text, @created_at)`
  ).run({
    id: apptId,
    doctor_id: input.doctorId,
    date: input.date,
    queue_number: 999999, // temporary; will be recomputed
    priority,
    patient_name: input.patientName,
    phone: input.phone,
    email: input.email,
    age: input.age,
    gender: input.gender,
    problem_text: input.problemText,
    created_at: createdAt,
  });

  recomputeQueueNumbers(db, input.doctorId, input.date);

  const row = db
    .prepare(
      `SELECT a.*, d.name as doctor_name, d.specialty as specialty
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       WHERE a.id = ?`
    )
    .get(apptId) as any;

  return {
    id: row.id,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    specialty: row.specialty,
    date: row.date,
    queueNumber: row.queue_number,
    priority: row.priority,
    patientName: row.patient_name,
    phone: row.phone,
    email: row.email,
    age: row.age,
    gender: row.gender,
    problemText: row.problem_text,
    createdAt: row.created_at,
  };
}

function recomputeQueueNumbers(db: Database.Database, doctorId: string, date: string) {
  const rows = db
    .prepare(
      `SELECT id, priority, created_at
       FROM appointments
       WHERE doctor_id = ? AND date = ?
       ORDER BY priority DESC, created_at ASC`
    )
    .all(doctorId, date) as Array<{ id: string; priority: number; created_at: string }>;

  const update = db.prepare(
    `UPDATE appointments SET queue_number = @queue_number WHERE id = @id`
  );
  const tx = db.transaction(() => {
    rows.forEach((r, idx) => {
      update.run({ id: r.id, queue_number: idx + 1 });
    });
  });
  tx();
}

export function listAppointments(doctorId: string, date: string): Appointment[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.*, d.name as doctor_name, d.specialty as specialty
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       WHERE a.doctor_id = ? AND a.date = ?
       ORDER BY a.queue_number ASC`
    )
    .all(doctorId, date) as any[];

  return rows.map((row) => ({
    id: row.id,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    specialty: row.specialty,
    date: row.date,
    queueNumber: row.queue_number,
    priority: row.priority,
    patientName: row.patient_name,
    phone: row.phone,
    email: row.email,
    age: row.age,
    gender: row.gender,
    problemText: row.problem_text,
    createdAt: row.created_at,
  }));
}

