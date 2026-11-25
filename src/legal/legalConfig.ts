export const LEGAL_DOCUMENT_VERSION = "0.12";
export const LEGAL_EFFECTIVE_DATE = "19 de novembro de 2026";
export const LEGAL_REVIEW_STATUS = "Implementação jurídica inicial — revisão profissional pendente";

const configuredController = process.env.EXPO_PUBLIC_LEGAL_CONTROLLER_NAME?.trim() ?? "";
// Public contact (25/11/2026, owner: only @aldusreader.com.br addresses, never the personal one); never used for authorization.
const configuredContact = process.env.EXPO_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() || "contato@aldusreader.com.br";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const legalIdentity = {
  controllerName: configuredController || null,
  contactEmail: emailPattern.test(configuredContact) ? configuredContact : null,
};

export function controllerDescription(): string {
  return legalIdentity.controllerName
    ? legalIdentity.controllerName
    : "A identificação formal do responsável pelo Aldus Reader será publicada após a validação cadastral e jurídica.";
}

export function legalContactDescription(): string {
  return legalIdentity.contactEmail
    ? legalIdentity.contactEmail
    : "O canal dedicado para solicitações legais e de privacidade será exibido aqui assim que for validado.";
}
