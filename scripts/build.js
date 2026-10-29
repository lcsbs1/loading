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
  'supabase/migrations/20261028202100_author_display_from_profile.sql',
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
  'emailRedirectTo',
  'isAuthCallbackUrl',
  'leaveAuthCallback',
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

if (/RAWG_KEY\s*:\s*['"][a-f0-9]{32}['"]/i.test(configContent) || /icloud\.com/i.test(configContent)) {
  fail('config.js ainda publica chave RAWG ou e-mail');
}
if (!configContent.includes("API_BASE_URL: '/api/rawg'")) {
  fail('config.js deve apontar o catálogo para /api/rawg');
}
ok('Config pública sem chave RAWG e sem e-mail');

const localConfig = fs.readFileSync(path.join(ROOT, 'reload/js/config.local.js'), 'utf8');
if (/[a-f0-9]{32}/i.test(localConfig) || /@/.test(localConfig)) {
  fail('config.local.js não pode carregar segredo');
}
ok('config.local.js sem segredo');

if (appContent.includes('api.rawg.io') || appContent.includes('key=${') || appContent.includes('state.key')) {
  fail('app.js ainda chama a RAWG direto ou envia key');
}
if (!appContent.includes('/api/rawg')) {
  fail('app.js deve usar o proxy /api/rawg');
}
ok('app.js usa o proxy da RAWG');

const i18nContent = fs.readFileSync(path.join(ROOT, 'reload/js/i18n.js'), 'utf8');
if (i18nContent.includes('api.mymemory.translated.net') || i18nContent.includes('innerHTML')) {
  fail('i18n.js ainda chama MyMemory direto ou usa innerHTML');
}
if (!i18nContent.includes('/api/translate')) {
  fail('i18n.js deve usar /api/translate');
}
ok('i18n.js usa o proxy de tradução');

const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const rawgRoutes = JSON.stringify(vercelConfig.rewrites || []);
if (!rawgRoutes.includes('/api/rawg/games/:id') || !rawgRoutes.includes('screenshots')) {
  fail('vercel.json deve reescrever a ficha e os screenshots para /api/rawg');
}
if (vercelConfig.outputDirectory !== 'reload') {
  fail('vercel.json deve publicar só a pasta reload');
}
if (!String(vercelConfig.headers?.[0]?.headers?.map(h => h.key)).includes('Content-Security-Policy')) {
  fail('vercel.json sem Content-Security-Policy');
}
ok('Deploy estático restrito a reload/');

const upstream = require(path.join(ROOT, 'lib', 'upstream'));
if (upstream.rawgSegmentsAllowed(['games', '..', 'screenshots'])) {
  fail('proxy aceitou path traversal');
}
if (!upstream.rawgSegmentsAllowed(['games', '123', 'screenshots'])) {
  fail('proxy recusou screenshots de jogo');
}
if (upstream.rawgSegmentsAllowed(['games', 'not-a-number'])) {
  fail('proxy aceitou id de jogo inválido');
}
const rewritten = upstream.rewriteRawgPaging('https://api.rawg.io/api/games?key=secretkey&page=2&page_size=15');
if (!rewritten || rewritten.includes('key=') || !rewritten.startsWith('/api/rawg/games?')) {
  fail('paginação da RAWG ainda pode devolver a chave');
}
ok('Proxy da RAWG recusa caminhos e tira a chave da paginação');

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

if (!serveContent.includes('resolveSafePath') || !serveContent.includes('startsWith(rootWithSep)')) {
  fail('serve.js deve bloquear path traversal fora da raiz do projeto');
}
ok('serve.js bloqueia path traversal');

const authorDisplayMigration = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/20261028202100_author_display_from_profile.sql'),
  'utf8'
);
if (!authorDisplayMigration.includes('set_author_display_from_profile')) {
  fail('migration de author_display ausente/incompleta');
}
ok('Migration author_display a partir do profile verificada');

console.log('\nBuild verificado com sucesso.');
