# Arquitetura da plataforma de dois observatórios

## Princípio

Um domínio analítico novo dentro da mesma plataforma. Nada de segundo site: autenticação, conta, preferências, banco, tokens, primitivas, SEO, deploy, pipeline e telemetria são os da Scrutiniums. O que muda é a dimensão **domínio** (`credito`, `energia`), presente em rotas, componentes, dados e eventos.

```
Scrutiniums  (marca, conta, método, infraestrutura)
├── Observatório Brasileiro de Crédito        domínio credito   rota /observatorio (SPA existente)
└── Observatório Brasileiro do Setor Elétrico domínio energia   rota /setor-eletrico (Next, Server Components)
```

## Registro de domínios

`src/lib/dominios.ts` é a fonte única de nome, pergunta, descrição, chips, rota raiz, acento e rótulo curto de cada observatório. Consomem o registro: cards da home, tela "Escolha seu observatório", switcher do cabeçalho, telemetria e metadados. Acrescentar um terceiro observatório é acrescentar uma entrada.

## Decisão: Setor Elétrico em Next, não na SPA

| Opção | Decisão |
| --- | --- |
| Estender a SPA de 1,25 MB | Rejeitada: acopla domínios, menu estático, testes que travam 8 grupos de menu |
| Páginas Next estáticas lendo a gold no build | **Adotada**: mesmo padrão de `/dados` e `/observatorio-do-credito`, HTML indexável, JavaScript de cliente só onde há interação (gráficos, modos de profundidade, drawer de proveniência) |

A SPA do Crédito continua intacta; recebe apenas o switcher de observatório no cabeçalho lateral e no cabeçalho móvel.

## Camadas

```
pipeline/energia/         coleta, silver com vintages, gold, governança de previsão (Python stdlib)
  seed/                   capturas primárias versionadas (CCEE PLD horário, com sha256)
data/energia/             bronze e silver locais (fora do git; cache do CI)
public/energia/gold/      gold publicada (JSON)          ← lida no build pelas páginas
public/energia/series/    séries completas para download (CSV)
src/lib/energia/          tipos, leitura da gold, regras editoriais, conteúdo didático com fontes
src/components/evidencia/ design system de evidência compartilhado (selo, proveniência, bloco editorial, indisponível)
src/components/energia/   componentes do domínio (gráficos, diagrama do PLD, mapa de submercados)
src/app/setor-eletrico/   rotas do observatório
```

## Identidade e conta compartilhadas

* Uma conta, uma sessão, um cookie. O middleware continua protegendo só `/app/*`; o Setor Elétrico é público para leitura, como o Crédito.
* Pós login sem destino explícito: `/app/observatorios` (tela de escolha). Com `?de=` válido, o destino é respeitado.
* Última escolha guardada em cookie não sensível `scrutiniums_observatorio` (`credito` ou `energia`, sem PII), usado apenas para destacar "último acessado" na tela de escolha.

## Telemetria

* Seções passam a ter domínio: `credito:*` no lugar de `obs:*` para novas seções e `energia:*` para o Setor Elétrico. Seções antigas `obs:*` continuam aceitas e são atribuídas ao domínio `credito` por `dominioDaSecao()`.
* O painel de administração agrega visitas por domínio.

## O que não muda

URLs públicas do Crédito (`/observatorio/*`, `/observatorio-do-credito`, `/dados/*`, `/resumo`, `/imprensa`, `/glossario`), gold do Crédito, workflow do Crédito, contratos testados da SPA.
