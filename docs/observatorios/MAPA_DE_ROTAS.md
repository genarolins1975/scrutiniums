# Mapa de rotas

Regra: nenhuma URL pública existente muda de destino. Rotas novas vivem sob `/setor-eletrico` (domínio `energia`) e `/app/observatorios` (área logada).

## Preservadas (Crédito e plataforma)

| Rota | Comportamento | Mudança |
| --- | --- | --- |
| `/` | Home | Passa a apresentar os dois observatórios; com sessão, redireciona a `/app/observatorios` |
| `/observatorio`, `/observatorio/*` | SPA do Crédito | Nenhuma no roteamento; cabeçalho ganha switcher |
| `/observatorio-do-credito` | Vitrine do Crédito | Nenhuma |
| `/dados`, `/dados/[slug]`, `/resumo`, `/imprensa`, `/glossario` | Páginas públicas do Crédito | Nenhuma |
| `/entrar`, `/cadastro/*`, `/app/conta`, `/app/admin` | Conta | Destino pós login sem `?de=` vira `/app/observatorios` |
| `/app` | Redirecionamento | Passa de `/observatorio` para `/app/observatorios` (rota logada, não pública) |
| `/metodologia`, `/fontes` | Redirecionam à metodologia do Crédito | Nenhuma |

## Novas

| Rota | Conteúdo | Nível |
| --- | --- | --- |
| `/app/observatorios` | Escolha seu observatório | logada |
| `/credito` | Atalho simétrico, redireciona a `/observatorio` | pública |
| `/setor-eletrico` | Mapa do Observatório: o sistema em seis passos, a pergunta de cada página, trilhas por perfil, como ler e fontes (molde do Mapa do Crédito). Âncoras da antiga visão geral (`#sistema`, `#observar` e demais) redirecionam para `/setor-eletrico/visao-geral` | pública |
| `/setor-eletrico/visao-geral` | Visão geral: o sistema em poucos minutos, com os números do dia | pública |
| `/setor-eletrico/pld` | PLD explicado: entender, analisar, auditar | pública |
| `/setor-eletrico/pld/previsoes` | Histórico de previsões (arquivo imutável) e estado atual | pública |
| `/setor-eletrico/pld/modelos` e `/setor-eletrico/pld/modelos/[modelo]` | Registro de modelos e model card | pública |
| `/setor-eletrico/agua-e-clima` | EAR, ENA, comparação sazonal | pública |
| `/setor-eletrico/geracao` | Matriz verificada por fonte e trajetória | pública |
| `/setor-eletrico/carga` | Carga do SIN e dos subsistemas | pública |
| `/setor-eletrico/rede` | Intercâmbios e descolamento de preços | pública |
| `/setor-eletrico/mercado`, `/empresas`, `/expansao`, `/regulacao` | Módulos planejados: escopo, perguntas e datasets catalogados; sem números até a integração | pública |
| `/setor-eletrico/aprenda` e `/setor-eletrico/aprenda/[conceito]` | Base de conhecimento | pública |
| `/setor-eletrico/dados` e `/setor-eletrico/dados/[dataset]` | Catálogo de datasets com estado de integração | pública |
| `/setor-eletrico/metodologia` | Metodologia, regras de classificação, taxonomia, linhagem | pública |
| `/energia/gold/*.json`, `/energia/series/*.csv` | Arquivos estáticos publicados | pública |

## Profundidade sem páginas duplicadas

Os três níveis (Entender, Analisar, Auditar) são modos da mesma página, controlados por `?modo=` refletido no cliente e por âncoras. Sem JavaScript, todo o conteúdo aparece em ordem (Entender primeiro).

## SEO

`sitemap.ts` inclui as rotas públicas de `/setor-eletrico`; `robots.ts` segue bloqueando `/app` e `/api`. Cada página tem `title`, `description` e canonical próprios.
