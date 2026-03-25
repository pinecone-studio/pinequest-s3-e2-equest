import { DbClient } from "./index";
import { students } from "./schema";

export const seedStudents = async (db: DbClient) => {
  const mockStudents = [
    { id: "S001", name: "Очко", className: "10А" },
    { id: "S002", name: "Ану", className: "10А" },
    { id: "S003", name: "Цоож", className: "10Б" },
    { id: "S004", name: "Тэмүүлэн", className: "10Б" },
    { id: "S005", name: "Билгүүн", className: "11А" },
    { id: "S999", name: "Мийгаа", className: "10С" },
  ];

  for (const student of mockStudents) {
    await db.insert(students).values(student).onConflictDoNothing();
  }
};
