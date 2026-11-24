import { aldusProfilePath } from './aldusProfilePath';

/**
 * Medalha do Aldus (perfil de Aldo Manúcio), a mesma da marca em assets/brand/aldus-medalha.svg. Os vetores entram uma vez na
 * página (MedalDefs) e cada uso referencia o símbolo; as cores vêm de variáveis CSS para servir no papel e na tinta.
 */
export function MedalDefs() {
  return <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
    <defs>
      <clipPath id="al-medal-clip"><circle cx="470" cy="712" r="360" /></clipPath>
      <path id="al-medal-profile" fillRule="evenodd" d={aldusProfilePath} />
    </defs>
    <symbol id="al-medal" viewBox="90 332 760 760">
      <circle cx="470" cy="712" r="372" fill="var(--al-medal-ring, #A64E32)" />
      <circle cx="470" cy="712" r="360" fill="var(--al-medal-face, #EFE6D6)" />
      <g clipPath="url(#al-medal-clip)"><use href="#al-medal-profile" fill="var(--al-medal-ink, #1B1C30)" /></g>
    </symbol>
  </svg>;
}

export function Medal({ className }: { className?: string }) {
  return <svg className={className ? `al-medal ${className}` : 'al-medal'} aria-hidden="true" focusable="false"><use href="#al-medal" /></svg>;
}
