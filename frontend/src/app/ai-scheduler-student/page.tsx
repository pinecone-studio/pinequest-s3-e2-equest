import type { Metadata } from "next";
import { AiStudentPersonalScheduler } from "./_components/AiStudentPersonalScheduler";

export const metadata: Metadata = {
  title: "Сурагчийн AI хуваарь",
  description:
    "Сурагчийн батлагдсан давтлага, секц болон хувийн төлөвлөгөөг нэг календар дээр давхарлан харуулна.",
};

export default function AiSchedulerStudentPage() {
  return <AiStudentPersonalScheduler />;
}

