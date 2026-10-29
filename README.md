# Loading...

> Fórum e acervo de todos os jogos: do Atari ao PlayStation 5, do DOS à Steam. Sem anúncios, sem rastreadores.

## Sobre o Projeto
O **Loading...** é uma enciclopédia aberta e fórum comunitário focado em clareza, velocidade e dados de jogos.

### Funcionalidades
- **Acervo de Jogos:** Catálogo com visualização fluida, plataformas, desenvolvedoras, gêneros e notas do Metacritic.
- **Preview Dinâmico (Hover):** Transição suave revelando capturas de gameplay ao passar o cursor sobre as capas.
- **Fórum Comunitário:** Avaliações e respostas permanentes no Supabase; publicação exige conta.
- **Feedback:** Sugestões da comunidade persistidas no Supabase (conta obrigatória).
- **Autenticação:** Supabase Auth (e-mail/senha) com perfil em `profiles` e RLS.
- **Temas:** Alternador claro/escuro no cabeçalho (FAB).
- **Integração RAWG:** Biblioteca ampliada via API RAWG.

## Como Executar

```bash
npm start
```

Abra `http://localhost:3000/reload/index.html`.

Copie `.env.example` para `.env` e preencha `RAWG_KEY` e, se quiser a cota maior do MyMemory, `MYMEMORY_EMAIL`. Esses valores ficam no servidor (`/api/rawg` e `/api/translate`). O browser não recebe a chave.

As chaves do Supabase ficam em `reload/js/config.js` (anon/publishable). Opcionalmente sobrescreva em `reload/js/config.local.js`. Na Vercel, defina `RAWG_KEY` e `MYMEMORY_EMAIL` em Production e Preview. O deploy publica só a pasta `reload/` mais essas funções; SQL, README e `scripts/` não têm URL.

### Setup Supabase (já aplicado no projeto `loading`)
1. Schema/RLS: `supabase/migrations/20261028152110_forum_feedback_auth.sql`
2. Auth → Email ligado. Em produção a confirmação de e-mail permanece ativa. No lab local, pode desativar **Confirm email**.
3. URL Configuration:
   - **Site URL:** `https://loading-lcsbs.vercel.app`
   - **Redirect URLs:** `https://loading-lcsbs.vercel.app/**`, `https://loading-virid.vercel.app/**`, `http://localhost:3000/**`, `http://127.0.0.1:3000/**`
4. O cadastro envia `emailRedirectTo` com a origem da página (`origin` + `pathname`). O link de confirmação só volta para essa origem se ela estiver na lista acima.

### Scripts
- `npm start` — servidor estático
- `npm test` / `npm run build` — checagens de sintaxe e integridade do markup

> A API local `/api/auth/*` foi descontinuada (HTTP 410). Contas e posts usam o Supabase.
