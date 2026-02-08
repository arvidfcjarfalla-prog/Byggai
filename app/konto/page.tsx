import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Skapa konto – Byggplattformen",
  description:
    "Skapa ett konto för att spara projekt, följa upp beslut och dela underlag med andra.",
};

export default function KontoPage() {
  return <SignupForm />;
}
