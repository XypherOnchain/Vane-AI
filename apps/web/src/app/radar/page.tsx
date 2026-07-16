import { redirect } from "next/navigation";

/** Legacy intel surface removed — product is Vane Debug. */
export default function RadarRedirect() {
  redirect("/debug");
}
