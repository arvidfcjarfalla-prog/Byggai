import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Logga in – Byggplattformen",
  description:
    "Logga in för att fortsätta arbeta med dina projekt och följa upp beslut.",
};

export default function LoginPage() {
  return <LoginForm />;
}
