# Diagnóstico de Clima Organizacional

Aplicação Node.js self-hosted para condução e compilação de entrevistas de clima, usando PostgreSQL 17.

## Desenvolvimento

1. Copie `.env.example` para `.env` e ajuste `DATABASE_URL` (o arquivo `.env` não é versionado).
2. Abra o túnel SSH para o PostgreSQL, quando necessário.
3. Execute `npm run db:migrate` explicitamente.
4. Execute `npm run dev`.

### Migrations

O Supabase CLI é usado exclusivamente como gerenciador das migrations do PostgreSQL próprio. As migrations novas devem ser criadas em `supabase/migrations` com o nome `YYYYMMDDHHMMSS_descricao.sql`.

```sh
supabase migration new descricao_da_alteracao
npm run db:migrate
```

Não use `schema_migrations`, não insira registros manuais nesse schema/tabela e não altere migrations já aplicadas. O comando `npm run db:migrate` executa somente `supabase db push`; a aplicação nunca altera o schema no startup.

## Produção

```sh
npm ci
npm run build
npm run db:migrate
npm run start
```

O servidor respeita `HOST` e `PORT`. O endpoint `GET /health` verifica a aplicação e a conexão com PostgreSQL usando `SELECT 1`.

## Docker

Crie `.env.production` somente na VPS (não commite) e execute:

```sh
docker compose -f compose.prod.yml up -d --build
```

O compose usa a rede externa `infra_backend`, não cria banco e publica a aplicação apenas em `127.0.0.1:3003`.

## Segurança e anonimato

- O navegador acessa somente a API; `DATABASE_URL` fica no servidor.
- Queries recebem parâmetros posicionais.
- Comentários originais são preservados separadamente de versões normalizadas.
- Consultas analíticas aplicam um tamanho mínimo de amostra (padrão: 5).
- Migrations nunca são executadas durante o startup da aplicação.

## Administração implementada

- CRUD de empresas e diagnósticos;
- kickoff por diagnóstico com parâmetros e critérios;
- setores, cargos, lideranças e diretores;
- categorias ordenáveis, perguntas, opções, pesos e favorabilidade;
- categorias e tópicos LCOD;
- criação, filtro e retomada de entrevistas anônimas;
- perfil demográfico sem cadastro nominal;
- entrevista alimentada pelas configurações persistidas;
- autosave e validações de pertencimento no servidor.

### Migration 003

`003_configuration_crud.sql` adiciona os campos administrativos, vínculo de pessoas por diagnóstico, obrigatoriedade de perguntas, ordenação de tópicos LCOD e a constraint `UNIQUE NULLS NOT DISTINCT` que torna o autosave idempotente também para perguntas gerais. Ela também amplia a posição de relacionamento para acomodar até três lideranças e uma diretoria relacionada.

Integração real de IA, áudio/vídeo e relatórios sofisticados continuam fora desta etapa. O texto original permanece separado e nunca é sobrescrito.

## Análises e compilação

A camada analítica é calculada no servidor e no PostgreSQL, sem transferir a base completa de respostas ao navegador. Estão disponíveis:

- compilação geral e métricas de coleta;
- favorabilidade e média por diagnóstico, categoria, pergunta e pessoa avaliada;
- filtros combinados por sexo, tempo, setor, cargo, liderança e diretoria;
- detalhes de categorias e perguntas;
- rankings de perguntas e categorias;
- compilação de lideranças e diretoria;
- comentários anônimos e LCOD analítico;
- pontos fortes e pontos de atenção baseados em limites configurados;
- bloqueio de detalhes quando a amostra é inferior ao mínimo do diagnóstico.

`004_analytics_performance.sql` adiciona somente índices de suporte às agregações, mantendo as migrations anteriores intactas.

## Dados de demonstração

O seed [demo.sql](seeds/demo.sql) contém somente uma organização e pessoas fictícias. Ele é separado das migrations, idempotente e nunca roda no startup.

```sh
npm run db:migrate
npm run db:seed:demo
npm run dev
```

O comando cria a **Empresa Demonstração**, o **Diagnóstico de Clima 2026**, 30 perguntas, 38 entrevistas em diferentes estados, respostas, comentários tratados e classificações LCOD revisadas. Executar novamente substitui apenas essa demonstração identificada por UUIDs reservados.

Por segurança, o comando é bloqueado quando `NODE_ENV=production`. Para uma execução deliberada em um ambiente de demonstração marcado como produção, também é necessário definir `DEMO_SEED_CONFIRM=YES`.
