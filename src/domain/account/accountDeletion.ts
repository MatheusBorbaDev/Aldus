/**
 * Exclusão de conta (pedido do dono em 17/11/2026; exigência da Google Play para apps com cadastro e direito do titular na LGPD).
 * A exclusão é feita no servidor (função account-delete). Aqui ficam a frase de confirmação, o que sai e o que fica, e as mensagens.
 */
export const ACCOUNT_DELETE_CONFIRMATION = "EXCLUIR MINHA CONTA";

export function confirmationMatches(input: string): boolean {
  return input.trim().toUpperCase() === ACCOUNT_DELETE_CONFIRMATION;
}

/** O que sai do servidor com a conta (verificado nas migrations: tudo da conta é removido em cascata). */
export const ACCOUNT_DELETE_REMOVES: readonly string[] = [
  "Os arquivos dos livros guardados na nuvem da conta.",
  "A biblioteca da conta, o progresso, os marcadores, os grifos e as notas sincronizados.",
  "O perfil, o @usuário, o plano e as preferências da conta.",
  "Na Comunidade: o perfil publicado, quem você segue e quem te segue, bloqueios, denúncias enviadas, os clubes que você criou (com o que foi publicado neles), suas participações, comentários, tópicos e respostas.",
  "As batalhas de flashcards da conta.",
];

/** O que não sai: dito com clareza para não prometer o que o servidor não faz. */
export const ACCOUNT_DELETE_KEEPS: readonly string[] = [
  "As cópias guardadas neste aparelho (livros baixados, anotações locais) continuam aqui até você remover o app ou apagar os dados dele nas configurações do sistema.",
  "O registro interno das ações da administração sobre a conta (por exemplo, um plano concedido) é mantido para auditoria.",
];

export type AccountDeleteError = "session" | "confirmation" | "admin" | "files" | "delete" | "unavailable" | "body" | "method" | "network";

export function accountDeleteMessage(code: AccountDeleteError | string | null | undefined): string {
  switch (code) {
    case "session": return "Sua sessão expirou. Entre de novo e repita a exclusão.";
    case "confirmation": return `Digite ${ACCOUNT_DELETE_CONFIRMATION} para confirmar.`;
    case "admin": return "Contas da administração do Aldus não podem ser excluídas pelo app. Fale com o responsável pelo serviço.";
    case "files": return "Não foi possível remover os arquivos da conta agora. Nada foi excluído; tente de novo em alguns minutos.";
    case "delete": return "Os arquivos foram removidos, mas a conta ainda não foi excluída. Tente de novo; se continuar, fale com o suporte.";
    case "network": return "Sem conexão com o servidor. Nada foi excluído; tente quando estiver on-line.";
    default: return "A exclusão de conta está indisponível no momento. Nada foi excluído; tente mais tarde ou fale com o suporte.";
  }
}
