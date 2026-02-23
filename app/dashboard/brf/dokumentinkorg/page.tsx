import { redirect } from "next/navigation";
import { routes } from "../../../lib/routes";

export default function BrfDokumentinkorgLegacyPage() {
  redirect(routes.brf.documentsIndex());
}
