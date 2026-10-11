# Revisão da integração do Atlas — 11/10/2026

## Escopo

A cadeia de rascunhos #145 (Atlas), #147 (cobertura/Saeb) e #149 (calibração e frequência escolar) foi reconciliada localmente com a main `19036c99b9ebec1a6040028d110057c233de081b`. A revisão preserva os capítulos e as entregas de Crédito/Energia da main. Nenhuma atualização da main, merge de PR ou publicação em produção integra esta etapa.

O GitHub havia retornado `mergeable: false` para #145. Com os históricos recuperados, a reconciliação Git ocorreu automaticamente, sem conflito textual ou descarte manual de lados. A atualização é propagada da base para os dois rascunhos dependentes, mantendo a cadeia de revisão.

## Rastreabilidade do comparador

O comparador de frequência escolar ganhou expansão “Como conferir esta comparação”: idade, sexo e cor/raça totais, ano, códigos municipais, tabela/variável e consultas originais das capitais, Brasil e metadados. As ressalvas sobre redes públicas/privadas e sobre a natureza contextual permanecem visíveis fora da expansão.

## Evidências e condições de publicação

- CI completo do comparador anterior (`d46c04735c6941f0a213b1e41f241aa1963b8af7`): sucesso confirmado antes desta reconciliação.
- Testes focados da nova árvore e status dos novos commits: registrados nos PRs. Não transferir automaticamente o CI do commit anterior aos novos.
- Sequência de integração: #145 → #147 → #149. Após cada merge autorizado, conferir a base e o CI do seguinte; não publicar apenas o laboratório sobre uma homepage antiga.
- Inspeção visual, teclado, quatro larguras (320/390/768/1440) e zoom 200% continuam pendentes: a prévia redireciona ao login da Vercel. Não houve avaliação visual 9/10.
- Escores reais continuam indisponíveis: cobertura, referências e aprovação metodológica ainda pendentes. A frequência escolar é contexto e não preenche os componentes da cesta.
- Antes da publicação: concluir revisão visual, exigir CI verde nos commits finais e obter autorização de merge/publicação para esta cadeia.
