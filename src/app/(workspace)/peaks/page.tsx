import type { Route } from "next";
import { redirect } from "next/navigation";

export default function PeaksPage() {
  redirect("/analysis" as Route);
}
