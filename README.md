# Sinal Fantasma

Jogo de dedução social (Rebeldes x Infiltrados) ambientado em Nova Aurora, 2089.
Página única (`index.html`), sem build. Mídia em `media/`.

## Rodar local
Sirva a pasta (`npx serve`) e abra no navegador. O modo **No mesmo aparelho** funciona de cara.

## Ligar o Online local (Supabase)
1. Crie um projeto em supabase.com.
2. No **SQL Editor**, cole e execute `supabase/schema.sql`.
3. Em **Project Settings > API**, copie a *Project URL* e a chave *anon public*.
4. Cole os dois em `config.js` (`supabaseUrl` e `supabaseKey`).
5. Publique de novo. Sem esses dados, o Online local aparece como indisponível.

A chave anon é pública por desenho. As partidas funcionam na confiança entre amigos (como no Claude): quem abre o jogo lê e grava na tabela `docs`.
Para limpar partidas antigas: `select public.purge_old_games();` (ou agende no pg_cron).

## Publicar a página
GitHub Pages, Netlify ou Vercel: aponte para a raiz do repositório (sem build, sem comando).

## Dentro do Claude
Se o jogo roda como artefato do Claude, ele usa o banco do próprio Claude e ignora o Supabase.

## Testes
- `node tests/harness.js index.html` deve terminar com `TUDO OK` (simula partidas locais e online).
- `node tests/adapter-test.js index.html` deve terminar com `ADAPTADOR OK` (testa a camada do Supabase com um banco simulado).

## Estrutura
- `index.html`: jogo (HTML, CSS e JS)
- `config.js`: chaves do Supabase
- `supabase/schema.sql`: tabela, política e tempo real
- `media/`: músicas, vídeos e imagens das histórias
- `tests/`: testes automáticos
