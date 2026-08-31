import type { Route } from "next";
import { redirect } from "next/navigation";

export default function ResultPage() {
  redirect("/analysis" as Route);
}
