import fs from "node:fs";
import path from "node:path";

// Pós-export Web. Os livros embutidos já entram no `dist` pelo Metro (require.context em BundledEpubCatalog/BundledPdfCatalog →
// dist/assets/assets/Livros/<nome>.<hash>), que é o único caminho que o app requisita. A cópia antiga para dist/assets/Livros
// (≈93 MB, nomes sem hash) não era referenciada por nenhum código e dobrava o tamanho do deploy (revisão de qualidade, onda 2).
// Este script não decide quais livros vão: isso continua sendo o conteúdo de assets/Livros.
const projectRoot = process.cwd();
const vercelSrc = path.join(projectRoot, "vercel.json");
const vercelDest = path.join(projectRoot, "dist", "vercel.json");
const staleCopy = path.join(projectRoot, "dist", "assets", "Livros");

if (fs.existsSync(staleCopy)) {
  // `expo export` recria o dist; isto só cobre um dist antigo reaproveitado.
  fs.rmSync(staleCopy, { recursive: true, force: true });
}

if (fs.existsSync(vercelSrc)) {
  fs.copyFileSync(vercelSrc, vercelDest);
  console.log("vercel.json copiado com sucesso para dist/vercel.json.");
}
