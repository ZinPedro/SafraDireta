import { MOCK_API, mockDelay } from "../../dev/mockApi";

export type RegistrationIntent = "buyer" | "seller";

export interface RegistrationValues {
  name: string;
  email: string;
  phone: string;
  password: string;
  acceptedTerms: boolean;
}

export type RegistrationErrors = Partial<Record<keyof RegistrationValues, string>>;

export interface RegistrationRequest extends RegistrationValues {
  intent: RegistrationIntent;
}

// The adapter is the integration boundary. Only a confirmed backend response
// may produce "registered"; the local screen never creates a session.
export type RegistrationResult =
  | { status: "registered" }
  | { status: "unavailable" }
  | { status: "error"; message: string; fieldErrors?: RegistrationErrors };

export type RegisterAccount = (request: RegistrationRequest) => Promise<RegistrationResult>;

export const registerAccount: RegisterAccount = async () => {
  if (MOCK_API) {
    await mockDelay();
    return { status: "registered" };
  }
  return { status: "unavailable" };
};

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 3) return digits;
  const area = digits.slice(0, 2);
  const number = digits.slice(2);
  const split = number.length > 8 ? 5 : 4;
  return `(${area}) ${number.slice(0, split)}${number.length > split ? `-${number.slice(split)}` : ""}`;
}

export function validateRegistration(values: RegistrationValues): RegistrationErrors {
  const errors: RegistrationErrors = {};
  if (values.name.trim().length < 2) errors.name = "Informe seu nome completo.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Informe um e-mail válido, como nome@exemplo.com.";
  }
  const phone = values.phone.replace(/\D/g, "");
  if (!/^[1-9][0-9][0-9]{8,9}$/.test(phone)) {
    errors.phone = "Informe um telefone brasileiro com DDD (10 ou 11 números).";
  }
  if (values.password.length < 8) errors.password = "Use pelo menos 8 caracteres.";
  if (!values.acceptedTerms) errors.acceptedTerms = "Marque a opção de aceite para continuar.";
  return errors;
}

export function toRegistrationRequest(values: RegistrationValues, intent: RegistrationIntent): RegistrationRequest {
  return {
    ...values,
    name: values.name.trim().replace(/\s+/g, " "),
    email: values.email.trim().toLowerCase(),
    phone: `+55${values.phone.replace(/\D/g, "")}`,
    intent,
  };
}
