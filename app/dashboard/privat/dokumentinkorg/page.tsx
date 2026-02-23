import { redirect } from "next/navigation";
import { routes } from "../../../lib/routes";

export default function PrivatDokumentinkorgLegacyPage() {
  redirect(routes.privatperson.documentsIndex());
}
