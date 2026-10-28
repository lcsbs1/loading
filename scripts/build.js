'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

console.log('Iniciando verificacao de build do Loading...\n');

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`OK ${message}`);
}

const jsFiles = [
  'reload/js/config.js',
  'reload/js/config.local.js',
  'reload/js/supabaseClient.js',
  'reload/js/i18n.js',
  'reload/js/app.js',
  'scripts/serve.js',
];

for (const file of jsFiles) {
  try {
    execSync(`node -c "${path.join(ROOT, file)}"`, { stdio: 'pipe' });
    ok(`Sintaxe OK: ${file}`);
  } catch (err) {
    fail(`Erro de sintaxe em: ${file}\n${err.message}`);
  }
}

const criticalFiles = [
  'reload/index.html',
  'reload/css/style.css',
  'reload/assets/snake/head.svg',
  'reload/assets/snake/body.svg',
  'reload/assets/snake/seed.svg',
  'supabase/migrations/20261028152110_forum_feedback_auth.sql',
  '.env.example',
];

for (const file of criticalFiles) {
  if (fs.existsSync(path.join(ROOT, file))) {
    ok(`Asset encontrado: ${file}`);
  } else {
    fail(`Arquivo ausente: ${file}`);
  }
}

const htmlContent = fs.readFileSync(path.join(ROOT, 'reload/index.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(ROOT, 'reload/css/style.css'), 'utf8');
const appContent = fs.readFileSync(path.join(ROOT, 'reload/js/app.js'), 'utf8');
const configContent = fs.readFileSync(path.join(ROOT, 'reload/js/config.js'), 'utf8');
const migrationContent = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20261028152110_forum_feedback_auth.sql'),
  'utf8'
);

if (!htmlContent.includes('id="snake-canvas"')) {
  fail('canvas #snake-canvas nao encontrado em reload/index.html');
}
ok('Canvas #snake-canvas verificado no HTML');

if (!cssContent.includes('#snake-canvas')) {
  fail('estilos de #snake-canvas nao encontrados em reload/css/style.css');
}
ok('Estilos de #snake-canvas verificados no CSS');

const forumHtmlIds = [
  'id="forum"',
  'id="topics"',
  'id="topic-form"',
  'id="forum-q"',
  'id="f-author-display"',
  'id="f-game"',
  'id="f-title"',
  'id="f-body"',
  'id="feedback-form"',
  'id="fb-author-display"',
  'id="fb-message"',
];

for (const marker of forumHtmlIds) {
  if (!htmlContent.includes(marker)) {
    fail(`marcador do forum/feedback ausente no HTML: ${marker}`);
  }
}
ok('Markup do forum/feedback verificado');

if (htmlContent.includes('id="f-author"') || htmlContent.includes('id="fb-author"') || htmlContent.includes('id="fb-clear"')) {
  fail('campos anonimos/limpar feedback legado ainda presentes no HTML');
}
ok('Campos anonimos e fb-clear removidos');

if (!htmlContent.includes('@supabase/supabase-js') || !htmlContent.includes('js/supabaseClient.js')) {
  fail('scripts Supabase ausentes em reload/index.html');
}
ok('CDN e supabaseClient.js referenciados no HTML');

const forumCssHooks = ['.topic', '.topic-body', '.replies', '.reply', '.reply-form'];
for (const hook of forumCssHooks) {
  if (!cssContent.includes(hook)) {
    fail(`estilo do forum ausente no CSS: ${hook}`);
  }
}
ok('Estilos de topicos/replies verificados no CSS');

const forumJsHooks = [
  'loadTopicsFromServer',
  'loadFeedbacksFromServer',
  'renderTopics',
  'requireAuth',
  'signInWithPassword',
  'signUp',
  "from('forum_topics')",
  "from('forum_replies')",
  "from('feedbacks')",
];
for (const hook of forumJsHooks) {
  if (!appContent.includes(hook)) {
    fail(`hook Supabase ausente em app.js: ${hook}`);
  }
}
ok('Hooks de forum/feedback/auth Supabase verificados em app.js');

if (appContent.includes('localStorage.setItem(LS.topics') || appContent.includes("localStorage.getItem(LS.topics")) {
  fail('persistencia localStorage de topics ainda presente');
}
if (appContent.includes('loading.feedbacks') || appContent.includes('/api/auth/')) {
  fail('legado localStorage feedbacks ou /api/auth ainda presente em app.js');
}
ok('Legado localStorage forum/feedback e /api/auth removidos');

if (!configContent.includes('SUPABASE_URL') || !configContent.includes('SUPABASE_ANON_KEY')) {
  fail('CONFIG.SUPABASE_URL / SUPABASE_ANON_KEY ausentes em config.js');
}
ok('Config Supabase presente');

const migrationHooks = [
  'create table public.profiles',
  'create table public.forum_topics',
  'create table public.forum_replies',
  'create table public.feedbacks',
  'enable row level security',
  'forum_rate_limit_ok',
  'handle_new_user',
];
for (const hook of migrationHooks) {
  if (!migrationContent.toLowerCase().includes(hook.toLowerCase())) {
    fail(`migration incompleta: ausente "${hook}"`);
  }
}
ok('Migration SQL do forum/feedback verificada');

const serveContent = fs.readFileSync(path.join(ROOT, 'scripts/serve.js'), 'utf8');
if (!serveContent.includes('AUTH_MOVED') || !serveContent.includes('410')) {
  fail('serve.js deve responder 410 em /api/auth/*');
}
ok('serve.js retira Auth API local (410)');

console.log('\nBuild verificado com sucesso.');
