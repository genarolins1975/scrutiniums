# Cobertura de Saúde nas capitais — 28/10/2026

Prioridade confirmada pelo usuário: completar primeiro todos os indicadores das capitais. A ampliação territorial fica depois. Esta entrega amplia a consulta da base preservada; **não encerra as lacunas do módulo** e não representa uma nova captura das fontes.

## Ampliação da APS

A captura oficial do Relatório APS, de 09/10/2026, já contém janeiro/2021 a julho/2026 para cada uma das 26 capitais: 67 competências, 1.742 registros capital/mês. Antes, a interface expunha somente os dezembros de 2021–2025. A consulta mensal separada mostra 11 campos: cobertura potencial, capacidade, população de referência, sete tipos de equipe e cadastros vinculados às equipes especiais. Esses campos não são 11 novos indicadores independentes.

- Rota: `/eficiencia-estatal/saude-capitais/rede-e-atencao-primaria#aps-mensal`.
- Modos: meses de uma capital ou capitais no mesmo mês; medida, capital, ano e competência preservados na URL, em parâmetros `aps_*` independentes do recorte anual.
- Download: `/eficiencia/series/saude_aps_mensal.csv`, todas as capitais, meses e medidas, com fonte, captura e hash. Dicionário em `saude_dicionario_das_colunas.csv`.
- Gold: campo `aps_mensal`, com versão e hash próprios. `meta.hash_dados` e `meta.observacoes` continuam descrevendo as 8.777 observações anuais, cujo conteúdo permanece igual.
- 2021: método anterior; não comparar sua mudança com os anos seguintes.
- 2026: cadastro vinculado incompleto; registros **provisórios**, inclusive quando todos os campos são numéricos. Não entram nas comparações anuais.
- População: preservada exatamente como recebida; não inferir o ano da população pelo código `DOU`. Mudanças do denominador também alteram a cobertura.
- Sem interpolação, soma de estoques ou truncamento em 100%. Cadastro/capacidade não é atendimento, acesso ou qualidade. Distrito Federal continua fora do perímetro municipal.
- Corrigida a expansão de eAPP para **Equipe de Atenção Primária Prisional**, também nos rótulos anuais e no catálogo.

O transporte ao navegador usa tuplas; os valores e os estados são preservados sem arredondamento. Uma competência faltante dentro do calendário aparece como ausência, nunca desaparece entre dois meses.

## Inventário e lacunas

Dados e métodos passa a exibir um inventário dos 23 indicadores avaliados, com períodos, capitais com algum valor e registros com/sem valor. As contagens incluem componentes e bases monetárias; não atestam completude ou comparabilidade.

| Frente | Situação da base preservada | O que falta |
| --- | --- | --- |
| Indicadores publicados | 20, com ressalvas; recursos 2021–2025, resultados 2021–2024 | Atualizar fontes e períodos sem misturar perímetros |
| Natureza da despesa | 42 registros sem valor: três componentes em 14 pares capital/ano | Resolver divergências MSC × DCA; não preencher por rateio |
| Fonte de recursos | Dois registros sem valor | Conferir a declaração e a reconciliação no SIOPS |
| Produção da APS | Não publicável | Obter série municipal estável, agregada, com conceito documentado |
| Profissionais/carga horária | Não publicável | Obter extração agregada viável do CNES, sem persistir nomes de profissionais |
| Despesa por atendimento | Não publicável por incompatibilidade de perímetros | Só calcular se numerador e denominador cobrirem o mesmo serviço e executor |
| ICSAP 2025 | Ainda não integrado | Capturar, validar e distinguir provisório de consolidado |
| História financeira 2019–2020 | Ainda não integrada | Capturar e conferir DCA/RREO, população e correção monetária |
| UBS | Histórico de estabelecimentos hoje classificados como tipos 01/02 | Resolver viés de seleção/reclassificação; não extrapolar cadastro atual |
| ACS, saúde bucal, eMulti, Siaps | Fontes avaliadas, fora da publicação comparável | Resolver duplicatas e mudanças de método, validar períodos/conceitos |
| Revisão metodológica externa | Não realizada nesta rodada | Parecer de especialista; não confundir testes de software com validação epidemiológica |

## Bloqueio de nova coleta

Em 28/10/2026, tentativas de conexão a Relatório APS, OpenDataSUS, DEMAS/S3, Tesouro/Siconfi e Banco Mundial retornaram `Tunnel connection failed: 403 Forbidden` do proxy do ambiente. A política ativa continua restrita, sem domínios adicionais. Nenhum erro foi tratado como inexistência do dado.

Os domínios oficiais necessários foram salvos no **rascunho** da configuração do ambiente, preservando os anteriores. A aplicação depende de revisão, salvamento e publicação pela configuração do ambiente. Salvar o rascunho não libera a rede. Não houve desvio do proxy nem tentativa de coletar por outra rota após a negação.

## Reprodução e validação

```sh
bash scripts/preparar-sessao.sh
python -m pipeline.eficiencia_saude.run
python -m unittest pipeline.tests.test_saude_aps_mensal pipeline.tests.test_eficiencia_saude
npx vitest run src/tests/obee-saude-mensal.test.ts src/tests/obee-saude.test.ts
npm run build
I18N_CHROMIUM_EXECUTABLE=/usr/bin/chromium node scripts/obee/saude-cobertura-verificacao.mjs
```

A construção mensal verifica o SHA-256 do **conteúdo descomprimido** de cada seed (contrato do manifesto), município, competência, unicidade, números finitos/não negativos, inteiros para contagens, denominador positivo e reconciliação das fórmulas. Falha interrompe a construção antes da promoção. A validação S17 documenta essa etapa. Os testes conferem também a igualdade dos dezembros com a série anual, CSV, ausência versus zero, dados provisórios, meses ausentes e transporte compacto.

A publicação de produção e o resultado final dos testes/evidências devem ser confirmados no PR; este documento não é prova de deploy.

O panorama do Atlas foi regenerado para atualizar somente o hash da fonte de Saúde; seus valores permanecem iguais. O piloto congelado de resultados de 2022 passa a apontar para uma cópia preservada do panorama anterior, com o mesmo hash de referência, mantendo sua reprodução independente das atualizações do painel.

## Resultado local da rodada

- Build de produção aprovado; 75 testes Python de Saúde e 11 do piloto histórico aprovados.
- Verificação visual: 16 combinações de rota/sessão/largura, sem violações axe ou erros de console; navegação mensal, CSV, URL, recolhimento e rolagem conferidos pelo script de interações.
- `verificar:rapido`: lint, tipos, derivados e cobertura bilíngue aprovados. Última suíte: 210 arquivos aprovados e um com timeout de 5 segundos em Cadastro Único; 6.603 testes aprovados, 12 ignorados e um todo. Não foi uma execução integralmente verde.
- Repetição isolada dos arquivos `painel-molde-obee-a.test.ts` e `obee-panorama-atlas.test.ts`: 25 testes aprovados, sem alterações para aumentar timeout ou relaxar asserções.
- O primeiro erro de hash do Atlas foi corrigido pela regeneração do resumo e CSV. O arquivo congelado do piloto mantém seu hash original.
- API do GitHub também bloqueada por `403 Forbidden`: sem PR, CI remoto, merge ou deploy confirmado nesta entrega.
