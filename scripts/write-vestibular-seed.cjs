// Gera o SQL da carga inicial de leituras de vestibular a partir de supabase/seed/vestibular-lists-2026-11-25.json.
// Uso: node scripts/write-vestibular-seed.cjs > (arquivo). O SQL é idempotente (upsert) e roda no SQL Editor do Supabase, com autorização.
const fs = require('node:fs'), path = require('node:path');
const SOURCE = path.join(__dirname, '..', 'supabase', 'seed', 'vestibular-lists-2026-11-25.json');
function seedSql(data = JSON.parse(fs.readFileSync(SOURCE, 'utf8'))) {
  const q = value => value == null ? 'null' : `'${String(value).replace(/'/g, "''")}'`;
  const lines = ['-- Gerado por scripts/write-vestibular-seed.cjs. Leituras de vestibular, carga inicial (fontes oficiais em source_url).', 'begin;'];
  for (const [id, url] of Object.entries(data.watch)) lines.push(`update public.vestibulares set watch_url = ${q(url)}, active = ${data.inactive.includes(id) ? 'false' : 'true'} where id = ${q(id)};`);
  for (const list of data.lists) {
    const books = JSON.stringify(list.books.map(([title, author, note], i) => ({ position: i + 1, title, author, ...(note ? { note } : {}) })));
    lines.push(`insert into public.vestibular_reading_lists (vestibular_id, exam_year, source_url, books) values (${q(list.vestibular_id)}, ${list.exam_year}, ${q(list.source_url)}, $json$${books}$json$::jsonb)`
      + ` on conflict (vestibular_id, exam_year) do update set source_url = excluded.source_url, books = excluded.books, updated_at = now();`);
  }
  lines.push('commit;');
  return lines.join('\n') + '\n';
}
module.exports = { seedSql, SOURCE };
if (require.main === module) process.stdout.write(seedSql());
