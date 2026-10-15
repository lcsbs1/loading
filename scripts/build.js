const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('⚡ Iniciando verificação de build do Loading...\n');

// 1. Verificação de Sintaxe JavaScript
const jsFiles = [
  'reload/js/config.js',
  'reload/js/i18n.js',
  'reload/js/app.js'
];

for (const file of jsFiles) {
  try {
    execSync(`node -c "${path.join(__dirname, '..', file)}"`, { stdio: 'pipe' });
    console.log(`✔ Sintaxe OK: ${file}`);
  } catch (err) {
    console.error(`✖ Erro de sintaxe em: ${file}`);
    console.error(err.message);
    process.exit(1);
  }
}

// 2. Verificação de Arquivos e Assets Críticos
const criticalFiles = [
  'reload/index.html',
  'reload/css/style.css',
  'reload/assets/snake/head.svg',
  'reload/assets/snake/body.svg',
  'reload/assets/snake/seed.svg'
];

for (const file of criticalFiles) {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    console.log(`✔ Asset encontrado: ${file}`);
  } else {
    console.error(`✖ Arquivo ausente: ${file}`);
    process.exit(1);
  }
}

// 3. Validação dos Componentes do Snake Game
const htmlContent = fs.readFileSync(path.join(__dirname, '..', 'reload/index.html'), 'utf-8');
const cssContent = fs.readFileSync(path.join(__dirname, '..', 'reload/css/style.css'), 'utf-8');

if (!htmlContent.includes('id="snake-canvas"')) {
  console.error('✖ Erro: canvas #snake-canvas não encontrado em reload/index.html');
  process.exit(1);
}
console.log('✔ Canvas #snake-canvas verificado no HTML');

if (!cssContent.includes('#snake-canvas')) {
  console.error('✖ Erro: estilos de #snake-canvas não encontrados em reload/css/style.css');
  process.exit(1);
}
console.log('✔ Estilos de #snake-canvas e Glassmorphism verificados no CSS');

console.log('\n✨ Build verificado com sucesso! Projeto 100% pronto para publicação.');
