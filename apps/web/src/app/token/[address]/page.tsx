import { redirect } from "next/navigation";

export default function TokenRedirect() {
  redirect("/debug");
}
