> Registro histórico da fase inicial. A implementação atual e a conferência das fontes estão descritas em [FASE_3.md](FASE_3.md).

# Contas Públicas Estaduais — fase 1

Rota proposta: /contas-publicas-estaduais. Alteração independente do módulo federal em desenvolvimento no PR #153. Sem mudança no menu global ou nos dados dos demais observatórios.

## Entrega desta mudança

- Interface editorial: ficha estadual, trajetória anual, seis provas (PE, SP, MG, RS, AM e DF), matriz, catálogo pesquisável e método.
- Seleção de UF e exercício compartilhável na URL, com histórico de navegação.
- 48 contratos **preliminares**, transcritos do projeto: fórmula, fonte, frequência no texto, unidade e condição de interpretação. Ainda não são 48 indicadores implementados.
- 27 UFs × 48 contratos × 12 exercícios (2015–2026): matriz lógica. O CSV exporta 1.296 células de disponibilidade para o ano selecionado.
- 323 observações de DCL/RCL herdadas: 296 encerramentos anuais e 27 retratos de 2026 Q1. Série histórica com lacunas explícitas.
- API de catálogo, snapshot e exportação CSV com proveniência e estado de validação.
- Coletor Siconfi com paginação, bytes originais identificados por SHA-256, URLs, parâmetros e instante de captura. Não altera a publicação automaticamente.
- Testes dos denominadores, ausência/zero, negativos, recortes, CSV, sentinelas, paginação, duplicatas e perímetro.

## O que os dados permitem afirmar

A origem é o arquivo public/obs/data/gold/subnacional.json do commit b02f2367786a02a8d3a3016ca076488991f280f1, blob Git 3735c67b2dd6d34b3db117ee07578eb0109fcfe9. O snapshot publicado nesta fase é independente das futuras atualizações desse arquivo.

A gold de origem foi gerada em 24/09/2026. Essa data **não** identifica a captura primária do RGF. A indicação de coleta de outro tema no mesmo arquivo não foi transferida ao RGF.

O pipeline anterior prioriza RCL ajustada para endividamento e permite fallback para RCL. A gold não registra qual escolha ocorreu por UF/período. Por isso o percentual é rotulado como herdado e não como indicador CE-11 validado. O mapeamento candidato da nova coleta só aceita o código da RCL ajustada; não faz fallback.

Na aritmética interna de 2026 Q1, AM e TO excedem 0,05 p.p. entre DCL/RCL calculada e percentual preservado. A tolerância vem da casa decimal da gold. Não foi ampliada para absorver as diferenças, nem foram corrigidos valores automaticamente. Não se atribui a causa sem consultar a resposta original.

Validação primária de todos os indicadores permanece pendente nesta versão. O mapa mostra “não sondado” para os outros 47 contratos, nunca “fonte sem dados”. Ausência em uma versão da gold é “sem registro neste snapshot”.

## Reproduzir

```bash
python3 -m unittest pipeline.contas_estaduais.test_contratos -v
npx vitest run src/tests/contas-estaduais.test.ts
npx tsc --noEmit
npm run build
python3 -m pipeline.contas_estaduais.coletar --ano 2025 --ufs PE SP MG RS AM DF
python3 -m pipeline.contas_estaduais.coletar --ano 2026 --quadrimestre 1 --somente-rgf
```

O coletor cria uma pasta nova por captura. Diretório existente é recusado, evitando sobrescrever evidência. Falhas parciais ficam distintas de zero linhas; bytes já recebidos são preservados. O mapeamento recusa contas duplicadas e diferenças de UF, exercício, código ou período. Paginação inconclusiva impede sucesso.

Todo dia 5, `.github/workflows/atualizar-contas-estaduais.yml` refaz as 81 consultas arquivadas (`python3 -m pipeline.contas_estaduais.conferir`), acusa conteúdo diferente do arquivado e período novo disponível para as 27 UFs e guarda as respostas do dia como artefato; não promove nada. O workflow adicional roda testes Python e captura primária em PR, sem credenciais. Artefatos de CI duram 30 dias: devem ser incorporados a armazenamento permanente de evidências antes de qualquer promoção de dados. Nenhuma captura é automaticamente promovida ao painel.

## Passos de promoção

1. Conferir o manifesto da captura e identificar retificações, unidades, perímetro e versão do MDF.
2. Validar códigos e colunas nos demonstrativos originais, inclusive AM e TO; conferir RCL ajustada e tratamento do DF.
3. Promover observações com origem e hash completos em uma alteração de dados revisada.
4. Mapear RREO01 para previsão, dotação e estágios da despesa. O coletor já captura o anexo; ainda não o transforma em indicadores.
5. Expandir mapeamento para resultado primário, pessoal, caixa e investimento.
6. Vincular educação estadual a rede, etapa e exercício compatíveis no OBEE. Matrícula não será chamada de aluno único.
7. Integrar navegação e publicação após avaliação da experiência e das evidências.

## Revisão de experiência

Estados previstos: referência parcial/anual, dívida negativa, lacuna histórica, divergência aritmética, pesquisa sem resultados, DF e filtros compartilháveis. Gráfico e tabela mantêm a série anual separada do ponto parcial de 2026. O catálogo não atribui nota geral, ranking de governo, selo PEFA ou CAPAG analítica.

CSS utiliza fontes existentes, identidade Scrutiniums, tabelas com rolagem localizada, foco visível e controles nativos. A revisão no Chrome da prévia Vercel verificou larguras 320/390/768/1440 sem transbordamento horizontal da página. Filtros AM/DF e 2025/2026, busca sem acento, busca vazia, limpeza e abertura de contrato com Enter funcionaram. O gráfico adapta sua largura para preservar a fonte dos eixos; a tabela mantém rolagem localizada. Foram vistos início, ficha, provas, catálogo e método. Zoom 200% e leitor de tela ainda não verificados; não se declara conformidade WCAG integral.

Validação local em 12/10/2026: 7 testes Python e 8 testes TypeScript aprovados; tipos do novo módulo e lint aprovados. A coleta primária local falhou por resolução DNS e o servidor de prévia local não pôde abrir a porta (EPERM). A execução integral de CI e a revisão visual da prévia devem ser conferidas no commit da PR.


## Evidência de execução em 12/10/2026

- PR #155, código 8be39612df172c493ebc6735a78bd050ddbe0cf8: deploy de prévia Vercel concluído, workflow de contratos e captura aprovado.
- 18 consultas concluídas: seis RGF02 de encerramento de 2025, seis RREO01 de 2025 e seis RGF02 do primeiro quadrimestre de 2026. Todas retornaram registros. Os 12 RGF produziram mapeamentos candidatos, sem promoção automática para a publicação.
- O manifesto está em evidencias/manifesto-captura-20261012.json. Os bytes brutos permanecem no artefato de CI indicado, com expiração em 11/11/2026. Transferi-los para arquivo permanente antes da promoção.
- AM 2026 Q1: a nova consulta declara 20,65%, com DCL/RCL calculada de 20,6531677%. A gold fixa guarda 20,6%. Esta nova evidência permite investigar o arredondamento em duas etapas; o aviso do snapshot refere-se à sua conferência interna, não a uma irregularidade do ente. TO ainda não foi incluído na nova consulta de seis provas.
- A suíte integral do repositório estava em execução durante esta revisão. A aprovação da captura não equivale à aprovação de todo o CI.

Autoavaliação desta página de fase 1 (não independente): direção de arte 8; hierarquia 8; tipografia 8; densidade 8; didática 8; comparabilidade 9; interação 8; responsividade 9. A avaliação abrange o catálogo e as evidências desta fase, não um painel completo de gestão. Pendências materiais: revisão dos dados primários, integração orçamento-serviço, zoom e leitor de tela.
