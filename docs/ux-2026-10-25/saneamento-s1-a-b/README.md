# Saneamento, Onda S1: pacotes A e B

Escopo autorizado em 25/10/2026: edição do SINISA, ressalvas e apresentação das notas do capítulo 15. O pacote C não integra esta entrega. A base é `main` em `3e3b770a4`.

## Evidência antes e depois

As capturas em `antes/` usam `next dev`, Chromium local e uma sessão real em banco PGlite temporário. Reproduzem as alturas do roadmap de 25/10/2026. A conferência final usa o build de produção, com e sem sessão.

| Antes | Depois | Por quê |
|---|---|---|
| Ano dos dados usado como nome da edição | Edição e ano de referência lidos de `meta.json` | SINISA 2025 é a edição com referência 2024 |
| “Não permite concluir” seguido de verbos como “somar” | “Não permite:” seguido da ação vedada | A ressalva deve formar uma frase compreensível |
| Notas de pesquisa dentro da identificação do leilão | Fatos na linha, notas em detalhes no HTML | Comparar valores sem perder a auditoria |
| Grau apresentado apenas como letra | Conferência por extenso, preservando a natureza da fonte | Uma notícia de imprensa conferida não vira fonte oficial |

| Rota com sessão | Altura antes, 390 px | Altura antes, 1440 px |
|---|---:|---:|
| `/saneamento` | 9.160 | 5.099 |
| `/saneamento/municipio/2611606` | 13.314 | 7.887 |
| `/saneamento/contratado` | 38.739 | 23.541 |

## Precisão da classificação das fontes

O pedido associava todo grau V a “conferido na fonte oficial”. A gold classifica como imprensa algumas fontes V: IstoÉ no leilão dos blocos 1, 2 e 4 da CEDAE; InfoMoney no Amapá; Agência iNFRA na PPP da Saneago; CNN em Rondônia. A apresentação usa “conferido na fonte consultada” nesses casos e “conferido na fonte oficial” para documentos e notícias oficiais. O grau original, a fonte, o seed e os valores permanecem intactos.

## Limites e reprodução

- As quatro skills obrigatórias estão presentes. Os executáveis de `impeccable` e `design-taste-frontend` não foram copiados para o projeto, conforme seus arquivos `ORIGEM.md`. A revisão usa o Playwright e os componentes do próprio projeto. A identidade editorial da `observatorio-layout` prevalece sobre regras genéricas conflitantes.
- `VIABILIDADE.md` já difere do catálogo em assuntos fora dos rótulos: situação do capítulo 14, ausência do capítulo 7.1 e redação do capítulo 15. A atualização desta entrega se restringe às células que nomeiam a edição, geradas a partir de `meta.json`; a revisão integral da matriz fica fora do escopo.
- Não houve alteração de números, fórmulas, golds, seeds, acesso às rotas, instruções de agentes ou skills.
- Leitor de tela e aparelhos físicos não foram usados. Capturas locais não comprovam implantação em produção.

Os resultados dos comandos estão abaixo. As 24 combinações de rota, largura e sessão estão em [evidencias.md](evidencias.md), com capturas e auditoria automatizada.

## Medição final do capítulo 15

Build de produção, Chromium local, sessão real temporária. As 24 notas foram encontradas em todas as larguras. A região rolou com ArrowRight e a primeira nota abriu e fechou com Espaço. Nenhuma largura apresentou rolagem horizontal da página.

| Largura | Altura final | Largura do documento |
|---|---:|---:|
| 320 | 32.606 | 320 |
| 390 | 29.619 | 390 |
| 768 | 23.782 | 768 |
| 1440 | 20.795 | 1440 |

A meta de menos de 30.000 px se aplica a 390 px e foi atendida. O ganho nessa largura foi de 9.120 px (23,5%). A captura inicial usou desenvolvimento; a final usa produção. As notas expandidas aumentam a altura por escolha do leitor.

As [medidas](detalhes/medidas.json) e capturas de identificação, valores, notas abertas e fim da página estão em `detalhes/`. A conferência visual cobriu início, meio e fim, incluindo uma nota expandida. A tabela mantém identificação fixa, números alinhados e indicação textual de rolagem; detalhes nativos preservam foco e semântica. Não é uma certificação completa de acessibilidade.

## Proveniência legada preservada

A normalização ocorre na apresentação. Permanecem intactos:

- `pipeline/observatorio_saneamento/tarifas.py`: notas de associação aos prestadores, linhas 386, 387, 477, 681, 728, 753 e 776.
- `pipeline/observatorio_saneamento/controle.py`: critério de vínculo à CVM, linha 148, e `seed/cvm/manifesto.json`.
- `pipeline/observatorio_saneamento/gold.py`: descrições do CSV, linhas 1384 a 1417, e chaves originais de planilha, linhas 631, 755 e 1308.
- `pipeline/saneamento_divida/coleta.py`: critério, linha 165; `pipeline/saneamento_divida/gold.py`: motivo de exclusão, linha 174.
- Golds e JSON consumidos pela aplicação, inclusive `meta.json` e `src/lib/saneamento/dados/tarifas.json`.

A edição congelada de contratado deriva de `referencia_posicao` da própria gold. Assim, uma atualização futura do SINISA municipal não renomeia retrospectivamente o snapshot de contratos.

## Comandos rodados e resultado

- `bash scripts/preparar-sessao.sh`: executado antes dos testes.
- `npm run verificar:pr`: executado integralmente. Passaram lint, tipos, testes Python, verificações OBEE, build, 224 verificações de navegador em 68 telas do Judiciário e cobertura bilíngue. Vitest: 402 arquivos passaram e dois falharam; 9.628 testes passaram, dois falharam, 12 já estavam ignorados e um já estava marcado como pendente.
- A falha nova detectou dois textos legados na página de dívida dos prestadores. Foram corrigidos na apresentação. A outra falha foi timeout de 5 segundos em qualificação de Trabalho e Renda, sem relação com arquivos alterados.
- `npx vitest run src/tests/painel-molde-pr2-trabalho-assistencia-alimentar.test.ts`: 21 testes aprovados sem mudar asserções ou timeout; o corpo dos testes levou 1,81 s na repetição.
- `npm run verificar:pr -- --etapas tipos,build`: aprovado após a correção, inclusive guarda da árvore de trabalho. O build final não tem o aviso de importação nomeada de JSON. A primeira tentativa havia encontrado incompatibilidade da sintaxe de regex Unicode com o alvo TypeScript; foi corrigida sem alterar a configuração ou o teste.
- `npm run verificar:rapido`: aprovado sobre o build final. Lint, tipos, derivados, cobertura e 163 arquivos de teste aprovados: 4.274 testes passaram; sete ignorados e um pendente já existentes. Inclui os testes novos de A e B e a prova do HTML corrigido.
- `npm run evidencias -- --rotas /saneamento /saneamento/municipio/2611606 '/saneamento/municipio?ibge=2611606' /saneamento/acesso /saneamento/contratado /saneamento/metodologia --larguras 390,1440 --saida docs/ux-2026-10-25/saneamento-s1-a-b`: aprovado, 24 capturas de página e 24 de primeira tela. Zero violações axe WCAG 2.1 A/AA, erros de console, requisições de recursos ao login e rolagem horizontal da página. Os redirecionamentos anônimos esperados constam na tabela.
- Busca adicional em todos os 26 HTML estáticos de Saneamento: zero ocorrências de “SINISA 2024”. Rotas dinâmicas são conferidas no teste de edição com servidor real.
- `git diff --check`: aprovado. Nenhum teste foi removido, afrouxado ou marcado como ignorado nesta entrega.

A suíte completa não foi repetida integralmente após a correção: repetiram-se o teste que excedeu tempo, tipos, build e os 163 arquivos afetados. Portanto, a rodada completa original não é apresentada como verde. A execução completa de CI será a conferência seguinte no PR.
