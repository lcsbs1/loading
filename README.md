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

As chaves do Supabase ficam em `reload/js/config.js` (anon/publishable). Opcionalmente sobrescreva em `reload/js/config.local.js`.

### Setup Supabase (já aplicado no projeto `loading`)
1. Schema/RLS: `supabase/migrations/20261028152110_forum_feedback_auth.sql`
2. Auth → Email ligado; em lab local, desative **Confirm email**
3. Site URL / Redirect: `http://localhost:3000` e `http://localhost:3000/reload/index.html`

### Scripts
- `npm start` — servidor estático
- `npm test` / `npm run build` — checagens de sintaxe e integridade do markup

> A API local `/api/auth/*` foi descontinuada (HTTP 410). Contas e posts usam o Supabase.
