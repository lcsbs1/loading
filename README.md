# Loading...

> Acervo tátil de jogos (seed offline + RAWG opcional) e fórum local no navegador. Sem anúncios, sem rastreadores.

## Sobre

O **Loading...** é um site estático (HTML/CSS/JS) com:

- **Top 9** curado + ciclo semanal de jogos em alta (cache de 7 dias)
- **Filtros por plataforma** (PC, PlayStation, Xbox, Nintendo)
- **Preview no hover** e ficha técnica com galeria
- **Fórum local** em `localStorage` (não sincroniza entre aparelhos)
- **RAWG opcional** para busca/paginação ampliada
- Temas claro / escuro / auto

## Como executar

```bash
npm start
```

Abra [http://localhost:3000/reload/index.html](http://localhost:3000/reload/index.html).

Também é possível abrir `index.html` no navegador, mas a chave RAWG via `config.local.js` / `RAWG_KEY` funciona melhor com `npm start`.

## Chave RAWG (opcional)

1. Crie uma chave em [rawg.io/apidocs](https://rawg.io/apidocs)
2. Copie o exemplo e preencha:

```bash
copy reload\js\config.local.example.js reload\js\config.local.js
```

Ou inicie com variável de ambiente:

```bash
set RAWG_KEY=sua_chave_32_hex
npm start
```

`config.local.js` está no `.gitignore` — **não** commitar chaves.

## Scripts

| Comando | Função |
|---------|--------|
| `npm start` | Servidor estático em `127.0.0.1:3000` (path-safe) |
| `npm run build` | Checagens de sintaxe, assets e higiene (sem secrets no repo) |
| `npm test` | Testes unitários de catálogo / notas / paginação |

## Estrutura

```
reload/
  index.html
  css/style.css
  js/config.js          # público (sem segredos)
  js/config.local.js    # local (gitignored)
  js/data.js            # seed + trending
  js/i18n.js
  js/app.js
scripts/
  serve.js
  build.js
  test.js
  lib/catalog.js
```

## Licença

MIT — ver [LICENSE](LICENSE).
