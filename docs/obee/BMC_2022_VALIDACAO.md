# Validação local da BMC 2022

13/10/2026. A entrega permanece bloqueada pela aquisição do universo de 318 municípios e pela API do GitHub. Este registro não declara a BMC concluída nem substitui o relatório final do PR.

## Evidência verificada

| Critério | Resultado desta execução |
| --- | --- |
| 208 observações das capitais | Aprovado, igualdade numérica com as entradas auditadas |
| 318 municípios sem Brasília | Bloqueado, seed não adquirido |
| Recusa de C e marca de B | Aprovado nos contratos Python e TypeScript |
| Precisão e ressalva em valores e CSV | Aprovado no recorte adquirido |
| Pares sem variável de resultado | Aprovado, população e região são as únicas variáveis aceitas |
| 54 hashes da v3 | Aprovado, manifesto e arquivos originais preservados |
| Neutralidade dos novos textos e cores | Aprovado no teste do módulo |
| Aceite integral e PR | Pendente dos dados e da aplicação da configuração de rede |

Comandos executados:

```sh
python3.12 -m unittest pipeline.tests.test_base_comparavel_2022.ContratoBMCTest pipeline.eficiencia_resultados.test_revisao_v3
```

13 testes aprovados, sendo nove do recorte BMC e quatro do verificador da v3.

```sh
npx vitest run src/tests/base-comparavel-2022.test.ts src/tests/obee-panorama-atlas.test.ts src/tests/obee-distribuicao-atlas.test.ts --maxWorkers=2 --testTimeout=30000 -t 'ContratoBMC|Panorama municipal|Distribuição das capitais'
```

49 testes aprovados. O teste do universo ampliado ficou fora desta seleção, identificado como ignorado pelo filtro, e permanece necessário para o aceite. Não é contado como aprovado.

```sh
npx tsc --noEmit
npm run lint
python3.12 -m compileall -q pipeline/eficiencia_comparavel
python3.12 -m pipeline.eficiencia_comparavel.run --somente-capitais --check
```

Todos concluíram com código zero. A reprodução do recorte manteve 208 observações e os 54 hashes.

```sh
python3.12 -m pipeline.eficiencia_comparavel.run --check
```

Recusado com `Seed dos 318 municípios ausente; adquirir o SIDRA antes de promover a BMC`. Essa é a dependência que impede o build obrigatório. A suíte Python integral e o ciclo de build com Vitest integral não foram apresentados como verificados para esta branch.

## Interface examinada

Chromium, com os dados reais das 26 capitais. Foram exercitados 320, 390, 768 e 1440 px, seleção das cidades, URL, voltar no histórico, seleção de pares, navegação da distribuição por teclado, abertura da tabela e alvos de pelo menos 44 px. Não houve rolagem horizontal nem exceção JavaScript. O axe não encontrou violações nos critérios WCAG 2 A, AA e 2.1 AA examinados no componente BMC.

O zoom de 200% passou nos extremos de largura após correção do reflow. A ação para abrir a distribuição move o foco para o título da referência. Leitor de tela não foi exercitado, e nenhuma conformidade integral é declarada. A densidade com 318 observações ainda precisa ser examinada depois da aquisição.

Autoavaliação, sem revisão independente: direção de arte 9, hierarquia 9, tipografia 9, densidade 8, didática 9, comparabilidade visual 9 no recorte examinado, interação 9 e responsividade 9. Densidade da referência completa permanece não verificada; a nota não compensa a dependência de cobertura nem autoriza concluir o aceite.

## Impedimento externo e continuação

O rascunho do ambiente contém `apisidra.ibge.gov.br`, `servicodados.ibge.gov.br` e `api.github.com`. A instância ainda informa revisão de configuração 1 e nenhum destino personalizado aplicado. A tentativa de SIDRA retornou recusa CONNECT com HTTP 403; a leitura da API do GitHub retornou Forbidden. A gravação do rascunho não aplica nem publica a configuração.

Depois de aplicada a rede, repetir a aquisição pelo coletor, validar 319 incluindo Brasília e 318 sem ela, conferir os seis recortes SIDRA contra as capitais, reproduzir JSON e CSV, executar os testes do universo e os comandos integrais exigidos, atualizar os resultados e só então criar o PR em rascunho.

Não houve merge, deploy, revisão independente, aprovação de pesos, solicitação de microdados controlados ou criação de escore. Os números de 657 municípios e o universo informado de 318 são hipóteses fornecidas no pedido até a readquisição oficial nesta máquina.
