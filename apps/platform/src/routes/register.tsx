import { createFileRoute } from "@tanstack/react-router";
import { RegisterForm } from "../modules/auth/components/register-form";

export const Route = createFileRoute("/register")({
  component: RegisterForm,
});
