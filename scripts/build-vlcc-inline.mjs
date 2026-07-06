// Gera um dist/vlcc.html AUTO-CONTIDO: todo o código do jogo embutido no HTML.
// Sem arquivos externos → sem 404 por cache de versões diferentes (CDN/celular).
import { build } from 'esbuild';
import fs from 'fs';

const res = await build({
  entryPoints: ['vlcc/main.ts'],
  bundle: true,
  minify: true,
  target: 'es2015',
  format: 'iife',
  write: false,
});
let js = res.outputFiles[0].text;
js = js.replace(/<\/script>/g, '<\\/script>');

let html = fs.readFileSync('vlcc.html', 'utf8');
const tag = '<script type="module" src="/vlcc/main.ts"></script>';
if (!html.includes(tag)) {
  console.error('ERRO: tag do módulo não encontrada em vlcc.html');
  process.exit(1);
}
html = html.replace(tag, () => `<script>\n${js}\n</script>`);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/vlcc.html', html);
console.log(`dist/vlcc.html auto-contido: ${(html.length / 1024).toFixed(0)} KB`);
