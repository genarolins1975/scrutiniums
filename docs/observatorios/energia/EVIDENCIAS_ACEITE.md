# Evidências de aceite

Gerado por `scripts/energia_avaliacao.py` (rodada 2026-10-08-r7). Mapeia cada item da definição final de pronto (seção 17 da especificação) para a evidência que existe e para o estado real do item. Item marcado como atendido em parte ou não verificado não é cumprimento integral.

Resumo: 2 atendido, 13 atendido em parte, 1 não atendido, 4 não verificado nesta rodada, de 20 itens.

| Item da seção 17 | Estado | Evidência e limite |
| --- | --- | --- |
| A home é o mapa didático do observatório, com propósito, perguntas, utilidade e conexão de todos os destinos. | atendido em parte | Página inicial medida: nota ponderada 8,9; J1 cumprida (12 de 12 passos). Os painéis vivos da home (task 19 da Fase 2) ainda não foram portados. |
| Todos os módulos obrigatórios existem e têm conteúdo real e útil. | atendido em parte | 19 entregas publicadas e medidas com resposta 200 em 94 rotas; a utilidade do conteúdo é lida pela revisão didática de cada página, não por contagem de módulos. |
| Todos os painéis obrigatórios foram concluídos, incluindo os itens de execução posterior do Anexo A. | não atendido | 16 de 71 painéis concluídos (2 sem limitação, 14 com limitação declarada), segundo status_paineis.json; o denominador é fixo em 71. |
| Mercado, Empresas, Expansão e Regulação deixaram de ser módulos vazios. | atendido em parte | As quatro páginas publicam conteúdo lido das golds; o contrato de painel da seção 7.2 foi adotado só no Mercado (P032 a P035). Ver nota de Completude de cada página. |
| Conta de luz, Perdas, Qualidade, Inclusão e Transição estão plenamente integrados à experiência. | atendido em parte | As páginas existem e foram medidas; a adoção do contrato de painel e a conclusão dos painéis correspondentes seguem pendentes em status_paineis.json. |
| O mapa de perdas funciona com geografia, indicadores e referências corretos. | atendido em parte | Interações do mapa exercitadas por roteiro (J6 cumprida (19 de 19 passos); J7 cumprida (18 de 18 passos)); a geografia e as referências não foram reconferidas contra a fonte nesta avaliação. |
| Os conceitos pendentes foram tratados e as fontes conferidas. | atendido em parte | Os 48 verbetes do Aprenda estão conferidos na fonte primária (GSF, REE e constrained-off em 07/10/2026, em documentos do MME, da EPE e do ONS); a definição regulatória do GSF, o texto original da REN ANEEL nº 1.030/2022 e os Procedimentos de Rede do ONS não foram acessados, e cada verbete declara isso. |
| Não há números de demonstração no caminho de produção. | não verificado nesta rodada | Não foi objeto desta avaliação; os testes de governança e de contrato das golds cobrem parte do requisito. |
| As comparações não misturam datas, universos ou denominadores incompatíveis. | não verificado nesta rodada | Não foi objeto desta avaliação além da nota de Correção por gold; a revisão adversarial das interfaces publicadas segue pendente. |
| Gráfico, tabela, texto e exportação derivam da mesma consulta e versão. | atendido em parte | J4 cumprida (10 de 10 passos): o agregado exibido foi recalculado a partir do CSV exportado. |
| O usuário consegue comprovar números e reproduzir agregados. | atendido em parte | Ficha Comprove aberta por roteiro em cada página que a oferece (ver Interatividade e Rastreabilidade); J3 cumprida (8 de 8 passos); J4 cumprida (10 de 10 passos). Reprodução por terceiros, fora do ambiente, não foi exercitada. |
| Todas as interações prometidas foram executadas em teste. | atendido em parte | Controles visíveis acionados por roteiro em 390 e 1440 px em cada página (nota de Interatividade); as interações específicas de cada painel seguem nos testes de cada módulo. |
| As telas foram inspecionadas em desktop e celular, inclusive estados extremos e vazios legítimos. | atendido em parte | Capturas de 1440 e 390 px de 94 páginas abertas por revisores em contexto limpo; estados vazios e defasados: J9 interrompida (5 de 13 passos). |
| A atualização e o tratamento de falhas foram testados. | atendido em parte | Testes do pipeline com falha simulada, revisão e período parcial (nota de Atualidade); sem exercício completo em produção. |
| O módulo de previsão cumpre as etapas aplicáveis de validação e publicação, sem contorná-las. | não verificado nesta rodada | Não foi objeto desta avaliação; J10 cumprida (14 de 14 passos) verificou a inspeção do arquivo de emissões. |
| Backtest, prospectivo, observado, estimado e cenário estão corretamente separados. | não verificado nesta rodada | Não foi objeto desta avaliação. |
| Avaliação por página e evidências estão registradas, sem notas inventadas. | atendido | 94 páginas com nota por dimensão, evidência, deduções e tetos em avaliacao.json; dimensão sem teste ou revisão fica como não avaliada (0 ocorrências). |
| Não há regressão conhecida nas áreas afetadas do Scrutiniums. | atendido em parte | Vitest: 3238 testes em 153 arquivos, 0 falhas. Python: 1367 testes, 1 falhas (test_energia_carga: test_arquivos_das_evidencias_existem_ou_sao_declarados_indisponiveis). |
| Build e verificações exigidas passaram. | atendido em parte | tsc: sem erro; next lint: sem aviso nem erro; next build de 08/10/2026 concluído sem erro. Vitest: 3238 testes em 153 arquivos, 0 falhas. Python: 1367 testes, 1 falhas (test_energia_carga: test_arquivos_das_evidencias_existem_ou_sao_declarados_indisponiveis). |
| Qualquer limitação externa remanescente está descrita sem ser apresentada como cumprimento integral. | atendido | Limites da avaliação em avaliacao.json e em AVALIACAO_PAGINAS.md; limitações de cada painel em status_paineis.json e em DECISOES_E_LIMITACOES.md. |

## Onde está a evidência

- Notas, deduções, tetos e defeitos por página: `public/energia/gold/avaliacao.json` e `/setor-eletrico/metodologia/avaliacao`.
- Medição por navegador (condensada): `docs/observatorios/energia/avaliacao/inspecao.json`; jornadas: `jornadas.json`; revisão visual e didática: `revisao_visual.json`; testes: `testes.json`; rodadas: `rodadas.json`.
- Reprodução: `PW_CORE=... node scripts/energia-avaliacao.mjs --base http://localhost:3100 --rotas rotas.txt --saida saida`, `node scripts/energia-jornadas.mjs ...` e `python3 scripts/energia_avaliacao.py --relatorio saida/relatorio.json --jornadas jornadas/jornadas.json`.
