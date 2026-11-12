# Log de 11/11/2026 (movido do PROJECT_CONTEXT.md §10, sem edição)

### 11/11/2026 — Melhorias, Onda C: voz alta, lembrete de revisão e "Abrir com Aldus" (Claude)
- Dependências nativas novas (justificadas, via `expo install`, compatíveis com SDK 57): `expo-speech` ~57.0.3 (voz do sistema, offline) e
  `expo-notifications` ~57.0.25 (notificação local; manifesto do pacote já declara POST_NOTIFICATIONS e BOOT_COMPLETED). Avisos de licença regenerados.
- C1 `speechText.ts`/`useReadAloud`: "Ouvir a partir desta página" (Conforto) lê o capítulo atual desde a frase da posição proporcional da página,
  no idioma declarado do capítulo, em trechos ≤3000; aviso com "Parar"; não vira páginas. O teste pegou um defeito real (pulava a frase
  seguinte quando a posição caía entre frases); corrigido para recuar ao início da frase.
- C2 `reviewReminder.ts`: lembrete diário 8h/12h/19h/21h no Estudo (desligado por padrão, um agendamento por vez, grava só após agendar, explica
  bloqueio; texto sem números; oculto na Web); tocar abre `/study` (`useReviewReminderNavigation`, só rotas permitidas).
- C3 "Abrir com Aldus" no lugar do "Compartilhar" (SEND exigiria módulo nativo de terceiros): filtro VIEW `content://` para PDF/EPUB no
  `AndroidManifest.xml` versionado e espelhado em `app.json`; `app/+native-intent.tsx` leva a `/open-file`, que valida o endereço, exige conta e
  usa o importador existente (formato pelos bytes). VALIDADO: ver §3. NÃO TESTADO: tudo no Android.
