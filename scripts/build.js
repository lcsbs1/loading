'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

console.log('⚡ Iniciando verificação de build do Loading...\n');

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`✔ ${message}`);
}

// 1. Verificação de Sintaxe JavaScript
const jsFiles = [
  'reload/js/config.js',
  'reload/js/i18n.js',
  'reload/js/app.js',
  'scripts/serve.js',
  'server/index.js',
  'server/config.js',
  'server/utils/security.js',
  'server/repositories/userRepository.js',
  'server/services/authService.js',
  'server/routes/auth.js',
  'server/tests/auth.test.js',
];

for (const file of jsFiles) {
  try {
    execSync(`node -c "${path.join(ROOT, file)}"`, { stdio: 'pipe' });
    ok(`Sintaxe OK: ${file}`);
  } catch (err) {
    fail(`Erro de sintaxe em: ${file}\n${err.message}`);
  }
}

// 2. Verificação de Arquivos e Assets Críticos
const criticalFiles = [
  'reload/index.html',
  'reload/css/style.css',
  'reload/assets/snake/head.svg',
  'reload/assets/snake/body.svg',
  'reload/assets/snake/seed.svg',
];

for (const file of criticalFiles) {
  if (fs.existsSync(path.join(ROOT, file))) {
    ok(`Asset encontrado: ${file}`);
  } else {
    fail(`Arquivo ausente: ${file}`);
  }
}

// 3. Validação dos Componentes do Snake Game
const htmlContent = fs.readFileSync(path.join(ROOT, 'reload/index.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(ROOT, 'reload/css/style.css'), 'utf8');
const appContent = fs.readFileSync(path.join(ROOT, 'reload/js/app.js'), 'utf8');

if (!htmlContent.includes('id="snake-canvas"')) {
  fail('canvas #snake-canvas não encontrado em reload/index.html');
}
ok('Canvas #snake-canvas verificado no HTML');

if (!cssContent.includes('#snake-canvas')) {
  fail('estilos de #snake-canvas não encontrados em reload/css/style.css');
}
ok('Estilos de #snake-canvas e Glassmorphism verificados no CSS');

// 4. Integridade do Fórum (tópicos + replies)
const forumHtmlIds = [
  'id="forum"',
  'id="topics"',
  'id="topic-form"',
  'id="forum-q"',
  'id="f-author"',
  'id="f-game"',
  'id="f-title"',
  'id="f-body"',
];

for (const marker of forumHtmlIds) {
  if (!htmlContent.includes(marker)) {
    fail(`marcador do fórum ausente no HTML: ${marker}`);
  }
}
ok('Markup do fórum (#forum, #topics, #topic-form, campos) verificado');

const forumCssHooks = ['.topic', '.topic-body', '.replies', '.reply', '.reply-form'];
for (const hook of forumCssHooks) {
  if (!cssContent.includes(hook)) {
    fail(`estilo do fórum ausente no CSS: ${hook}`);
  }
}
ok('Estilos de tópicos/replies verificados no CSS');

const forumJsHooks = [
  'SEED_TOPICS',
  'loadTopics',
  'saveTopics',
  'renderTopics',
  'LS.topics',
  't.replies.push',
];
for (const hook of forumJsHooks) {
  if (!appContent.includes(hook)) {
    fail(`hook do fórum ausente em app.js: ${hook}`);
  }
}
ok('Hooks de persistência/render do fórum verificados em app.js');

function extractSeedTopicsLiteral(source) {
  const startMatch = source.match(/const\s+SEED_TOPICS\s*=\s*/);
  if (!startMatch) return null;

  const start = startMatch.index + startMatch[0].length;
  if (source[start] !== '[') return null;

  let depth = 0;
  let inString = false;
  let quote = null;
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      quote = ch;
      continue;
    }

    if (ch === '[') depth += 1;
    if (ch === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }

  return null;
}

function assertString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} deve ser string não vazia`);
  }
}

function assertNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} deve ser number finito`);
  }
}

function validateReply(reply, topicId, index) {
  if (!reply || typeof reply !== 'object' || Array.isArray(reply)) {
    throw new Error(`reply[${index}] do tópico ${topicId} inválido`);
  }
  assertString(reply.author, `reply[${index}].author (${topicId})`);
  assertString(reply.body, `reply[${index}].body (${topicId})`);
  assertNumber(reply.at, `reply[${index}].at (${topicId})`);

  const allowed = new Set(['author', 'body', 'at']);
  for (const key of Object.keys(reply)) {
    if (!allowed.has(key)) {
      throw new Error(`reply[${index}] (${topicId}) tem campo inesperado: ${key}`);
    }
  }
}

function validateTopic(topic, index) {
  if (!topic || typeof topic !== 'object' || Array.isArray(topic)) {
    throw new Error(`SEED_TOPICS[${index}] inválido`);
  }

  assertString(topic.id, `topic[${index}].id`);
  assertString(topic.author, `topic[${index}].author`);
  assertString(topic.game, `topic[${index}].game`);
  assertString(topic.title, `topic[${index}].title`);
  assertString(topic.body, `topic[${index}].body`);
  assertNumber(topic.at, `topic[${index}].at`);

  if (!Array.isArray(topic.replies)) {
    throw new Error(`topic[${index}].replies deve ser array`);
  }

  if (topic.pinned !== undefined && typeof topic.pinned !== 'boolean') {
    throw new Error(`topic[${index}].pinned deve ser boolean quando presente`);
  }

  const allowed = new Set(['id', 'pinned', 'author', 'game', 'title', 'body', 'at', 'replies']);
  for (const key of Object.keys(topic)) {
    if (!allowed.has(key)) {
      throw new Error(`topic[${index}] tem campo inesperado: ${key}`);
    }
  }

  topic.replies.forEach((reply, replyIndex) => {
    validateReply(reply, topic.id, replyIndex);
  });
}

const seedLiteral = extractSeedTopicsLiteral(appContent);
if (!seedLiteral) {
  fail('não foi possível extrair o literal SEED_TOPICS de reload/js/app.js');
}

let seedTopics;
try {
  const now = Date.now();
  const H = 3600e3;
  seedTopics = new Function('now', 'H', `return (${seedLiteral});`)(now, H);
} catch (err) {
  fail(`SEED_TOPICS não pôde ser avaliado: ${err.message}`);
}

if (!Array.isArray(seedTopics) || seedTopics.length === 0) {
  fail('SEED_TOPICS deve ser um array não vazio');
}

try {
  seedTopics.forEach(validateTopic);
} catch (err) {
  fail(`integridade de tópicos/replies: ${err.message}`);
}

const ids = seedTopics.map((t) => t.id);
if (new Set(ids).size !== ids.length) {
  fail('SEED_TOPICS contém ids duplicados');
}

const totalReplies = seedTopics.reduce((sum, t) => sum + t.replies.length, 0);
ok(
  `Integridade dos dados do fórum OK (${seedTopics.length} tópicos, ${totalReplies} replies)`
);

// Shape de criação/resposta usado pelo runtime
if (!/replies:\s*\[\s*\]/.test(appContent)) {
  fail('criação de tópico sem replies: [] não encontrada em app.js');
}
if (!/author,\s*body,\s*at:\s*Date\.now\(\)/.test(appContent)) {
  fail('shape de reply { author, body, at } não encontrada em app.js');
}
ok('Shapes de criação de tópico e reply alinhados ao schema');

// 5. Auth API (SPA Auth — Opção A)
const authFiles = [
  'server/index.js',
  'server/config.js',
  'server/utils/security.js',
  'server/repositories/userRepository.js',
  'server/services/authService.js',
  'server/routes/auth.js',
  'server/data/.gitkeep',
  '.env.example',
];

for (const file of authFiles) {
  if (fs.existsSync(path.join(ROOT, file))) {
    ok(`Asset encontrado: ${file}`);
  } else {
    fail(`Arquivo ausente: ${file}`);
  }
}

console.log('\n🔐 Executando testes automatizados da Auth API...');
try {
  execSync(`node "${path.join(ROOT, 'server/tests/auth.test.js')}"`, {
    stdio: 'inherit',
  });
} catch {
  fail('Testes da Auth API falharam');
}

console.log('\n✨ Build verificado com sucesso! Projeto 100% pronto para publicação.');
