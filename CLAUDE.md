# Scrutiniums: instruções para agentes

Este arquivo é lido em toda sessão. O conteúdo vale igualmente para o `AGENTS.md`.

## Regra principal

Todo trabalho em página, painel, observatório, gráfico, tabela, texto exibido, navegação, logos de empresas, artefato didático, PR, merge ou conferência em produção segue a skill **`.claude/skills/observatorio-layout/SKILL.md`**. Ler o arquivo inteiro antes de começar, mesmo que o pedido seja curto ("faz o merge", "está no ar?", "melhora essa página"). A skill registra o que o dono da plataforma pede e o que ele já reprovou.

## O essencial da skill, para não esquecer

- Prioridade: clareza > narrativa > didatismo > credibilidade > quantidade de funcionalidades. Público leigo, rigor máximo, páginas organizadas por perguntas importantes para a sociedade.
- Nunca anunciar o que não existe; ausência de dado não vira zero nem estimativa; toda medida com unidade, período, fonte e ressalva.
- Página de entrada: primeira tela para o leitor, destino mais procurado a um clique, artefato didático do mecanismo, método recolhido no fim.
- Painéis só com conta (`src/lib/rotasPublicas.ts`); mudança de navegação é conferida logado e deslogado.
- O trabalho termina em produção: PR, CI verde, merge só com autorização do usuário, deploy confirmado e links das rotas na resposta.

## Comandos do repositório

- Testes da interface: `npx vitest run` (os de navegador dependem do Chromium do Playwright); tipos: `npx tsc --noEmit`; lint: `npm run lint`; build: `npm run build`.
- Testes do pipeline: `python3 -m unittest discover -s pipeline/tests -t .`.
- Inventário de tradução (arquivo gerado, regenerar em todo conflito): `node scripts/cobertura-i18n.mjs`.
- Golds derivadas do Setor Elétrico (`public/energia/gold/{metricas,arquivos,manifesto}.json`): `python3 pipeline/energia/executar_modulo.py <módulo> --sem-coleta`.

## Idioma e tom

Responder em português do Brasil, tom executivo e direto, sem jargão desnecessário. Separar evidência, inferência e recomendação; todo número com fonte e data de referência.
