import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

// Pós-export Web. Os livros embutidos já entram no `dist` pelo Metro (require.context em BundledEpubCatalog/BundledPdfCatalog →
// dist/assets/assets/Livros/<nome>.<hash>), que é o único caminho que o app requisita. A cópia antiga para dist/assets/Livros
// (≈93 MB, nomes sem hash) não era referenciada por nenhum código e dobrava o tamanho do deploy (revisão de qualidade, onda 2).
// Acervo (etapa 3): todo arquivo em assets/Livros precisa estar declarado em bundledBookManifest.json (domínio público) com o
// SHA-256 conferido. Os 33 títulos de legacyBundledAssets.json saíram do pacote e não podem voltar; senão o export falha.
const projectRoot = process.cwd();
const srcDir = path.join(projectRoot, "assets", "Livros");
const vercelSrc = path.join(projectRoot, "vercel.json");
const vercelDest = path.join(projectRoot, "dist", "vercel.json");
const staleCopy = path.join(projectRoot, "dist", "assets", "Livros");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(projectRoot, file), "utf8"));

if (fs.existsSync(staleCopy)) {
  // `expo export` recria o dist; isto só cobre um dist antigo reaproveitado.
  fs.rmSync(staleCopy, { recursive: true, force: true });
}

if (fs.existsSync(srcDir)) {
  const active = readJson("src/data/library/bundledBookManifest.json");
  const legacy = readJson("src/data/library/legacyBundledAssets.json");
  const problems = [];
  let activeCount = 0;
  for (const name of fs.readdirSync(srcDir)) {
    if (!/\.(pdf|epub)$/i.test(name)) continue;
    const entry = active.find((item) => item.fileName === name);
    const hash = createHash("sha256").update(fs.readFileSync(path.join(srcDir, name))).digest("hex");
    if (legacy.some((item) => item.fileName === name || item.hash === hash)) problems.push(`${name}: título do acervo antigo (protegido) não pode voltar ao pacote`);
    else if (!entry) problems.push(`${name}: não declarado em bundledBookManifest.json`);
    else if (entry.hash !== hash) problems.push(`${name}: hash diferente do declarado`);
    else activeCount++;
  }
  if (problems.length) {
    console.error(`Acervo embutido recusado para o site:\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`assets/Livros: ${activeCount} em domínio público (hashes conferidos).`);
}

if (fs.existsSync(vercelSrc)) {
  fs.copyFileSync(vercelSrc, vercelDest);
  console.log("vercel.json copiado com sucesso para dist/vercel.json.");
}
