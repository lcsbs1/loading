const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Verificando build do Loading...\n');

const jsFiles = [
  'reload/js/config.js',
  'reload/js/data.js',
  'reload/js/i18n.js',
  'reload/js/app.js',
  'scripts/lib/catalog.js',
];

for (const file of jsFiles) {
  try {
    execSync(`node -c "${path.join(__dirname, '..', file)}"`, { stdio: 'pipe' });
    console.log(`OK sintaxe: ${file}`);
  } catch (err) {
    console.error(`Erro de sintaxe: ${file}`);
    console.error(err.message);
    process.exit(1);
  }
}

const criticalFiles = [
  'reload/index.html',
  'reload/css/style.css',
  'reload/js/config.js',
  'reload/js/data.js',
  'reload/js/i18n.js',
  'reload/js/app.js',
  'LICENSE',
];

for (const file of criticalFiles) {
  const fullPath = path.join(__dirname, '..', file);
  if (!fs.existsSync(fullPath)) {
    console.error(`Arquivo ausente: ${file}`);
    process.exit(1);
  }
  console.log(`OK asset: ${file}`);
}

const html = fs.readFileSync(path.join(__dirname, '..', 'reload/index.html'), 'utf-8');
const forbidden = ['snake-canvas', 'api-key', 'MODO OFFLINE + CLOUD', 'CLOUD ENGINE'];
for (const token of forbidden) {
  if (html.includes(token)) {
    console.error(`HTML ainda contém residual: ${token}`);
    process.exit(1);
  }
}

if (!html.includes('id="platforms"')) {
  console.error('Filtro #platforms ausente no HTML');
  process.exit(1);
}
if (!html.includes('js/data.js')) {
  console.error('Script data.js ausente no HTML');
  process.exit(1);
}
if (!html.includes('github.com/lcsbs1/loading')) {
  console.error('Link do GitHub do projeto ausente no footer');
  process.exit(1);
}

const config = fs.readFileSync(path.join(__dirname, '..', 'reload/js/config.js'), 'utf-8');
if (/RAWG_KEY:\s*'[a-f0-9]{32}'/i.test(config)) {
  console.error('Chave RAWG commitada em config.js — use config.local.js');
  process.exit(1);
}
if (config.includes('@icloud.com') || config.includes('@gmail.com')) {
  console.error('E-mail pessoal detectado em config.js');
  process.exit(1);
}

console.log('\nBuild verificado com sucesso.');
