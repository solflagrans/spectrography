import type { Route } from "next";
import { redirect } from "next/navigation";

export default function IdentificationPage() {
  redirect("/analysis" as Route);
}
