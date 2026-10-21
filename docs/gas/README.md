# Observatório Brasileiro de Gás Natural

Sexto domínio da Scrutiniums, em `/gas-natural`. Responde, em páginas de uma pergunta cada, quanto gás o Brasil produz, quanto chega ao mercado, de onde vem o importado e quanto custa em cada elo até o consumidor. Inclui o gás de cozinha (GLP) em página própria, com a distinção entre GLP e gás natural no topo.

Referência de escopo: o [Observatório do Gás Natural](https://observatoriodogas.fgv.br/) (Movimento Brasil Competitivo, com apoio técnico do FGV CERI), organizado em oferta e demanda, abertura, comercialização, escoamento e processamento, transporte, distribuição e regulação. A Scrutiniums não reproduz números daquele observatório: tudo sai de dados abertos primários, pelo pipeline deste repositório.

## Páginas

| Rota | Pergunta | Fontes |
| --- | --- | --- |
| `/gas-natural` | Do poço ao consumidor: quanto gás o Brasil tem, usa e paga | todas |
| `/gas-natural/producao` | Quanto gás o Brasil produz e onde? | ANP, produção por UF e localização |
| `/gas-natural/aproveitamento` | Quanto do gás produzido chega ao mercado? | ANP, produção, reinjeção, queima, consumo próprio, disponível |
| `/gas-natural/importacao` | Quanto gás o Brasil importa e de onde ele vem? | ANP, importação; MDIC, Comex Stat |
| `/gas-natural/precos` | Quanto custa o gás antes de chegar à distribuidora? | ANP, comercialização; Banco Mundial, Pink Sheet; BCB, PTAX |
| `/gas-natural/gas-de-cozinha` | Quanto custa o botijão de gás no seu estado? | ANP, levantamento de preços e vendas de GLP; IBGE, IPCA |
| `/gas-natural/gnv-e-gas-encanado` | Quanto pagam motoristas e residências pelo gás natural? | ANP, levantamento de preços; IBGE, IPCA |
| `/gas-natural/mercado` | Mais empresas estão comprando e vendendo gás? | ANP, movimentação em gasodutos e comercialização |
| `/gas-natural/infraestrutura` | Por onde o gás chega ao consumidor? | ANP, movimentação e autorizações |
| `/gas-natural/regulacao` | Quem define as regras do gás no Brasil? | atos oficiais (Planalto, MME) |
| `/gas-natural/dados` | De onde vêm os números e como conferir cada um? | meta da gold |
| `/gas-natural/metodologia` | Como ler os números deste observatório? | (página aberta) |

Os painéis exigem conta, como os demais observatórios. Só `/gas-natural/metodologia` é aberta (`src/lib/rotasPublicas.ts`). O catálogo das páginas é `src/lib/gas/navegacao.ts`: cabeçalho, inicial, vitrine da home e sitemap leem dele.

## Pipeline

```bash
python3 -m pipeline.gas.run                 # reconstrói a gold a partir do seed (sem rede)
python3 -m pipeline.gas.run --coleta        # recoleta as 18 fontes e reconstrói
python3 -m unittest pipeline.tests.test_gas
```

- `pipeline/gas/fontes.py`: catálogo das fontes (órgão, conjunto, página, licença, frequência, nota) e coleta. O seed (`pipeline/gas/seed`, cerca de 700 KB) guarda o arquivo inteiro comprimido ou, quando o original é grande, o recorte declarado; o manifesto registra URL, sha256 e tamanho do original e a data da captura. Arquivo idêntico ao já integrado não altera o manifesto.
- `pipeline/gas/ler.py`: leitura tipada do seed, sem cálculo.
- `pipeline/gas/gold.py`: uma gold por página em `public/gas/gold` e 14 séries em `public/gas/series`. Todo indicador traz rótulo, unidade, natureza (observado ou calculado), fontes, período e, quando calculado, a fórmula.
- `pipeline/gas/validacoes.py`: identidades e cobertura. Falha de identidade interrompe a publicação; problema de cobertura da fonte vira marca publicada.
- Workflow `.github/workflows/atualizar-gas.yml`, dias 3 e 18 de cada mês, publica só com os testes verdes.

Só a biblioteca padrão do Python, inclusive para ler `.xlsx` (`pipeline/gas/xlsx.py`).

## Decisões de método

1. **Volumes em milhões de m³ por dia.** A ANP publica mil m³ por mês; a média diária divide pelos dias do mês. Nenhum fator de poder calorífico é aplicado.
2. **Preço em dólar** usa a PTAX média de venda do mesmo mês (SGS 3698). O preço da ANP inclui impostos; as referências do Banco Mundial não. A página diz isso ao lado da figura.
3. **Correção pela inflação** do botijão e do GNV usa o IPCA índice geral, com base no último mês de preço.
4. **Balanço da produção.** Reinjeção, queima, consumo próprio e disponível devem somar a produção. Julho de 2005 falha (o disponível por UF é inconsistente na origem) e fica sem as parcelas. Desde 2023 há diferença pequena, publicada como indicador.
5. **Movimentação em gasodutos.** O conjunto tem lacunas (NTS sem volume em agosto a outubro de 2025, erro de escala em abril de 2025) e mudanças de patamar sem nota nos metadados. Por isso:
   - o total de carregadores fica sem valor nos meses de cobertura incompleta;
   - participação da Petrobras, HHI e total nacional entregue **não são publicados**, porque a quebra de série mudaria a leitura;
   - o volume por transportadora aparece com as quebras listadas na própria página.
6. **Comex Stat e ANP** medem a importação em unidades diferentes (kg e m³) e não são convertidos um no outro.
7. **GLP** só na página do gás de cozinha, com a nota de que não é gás natural.

## Lacunas conhecidas

- Demanda por segmento (industrial, residencial, comercial, automotivo, cogeração) não tem conjunto aberto estruturado; o Boletim Mensal do MME traz em PDF.
- Lista de consumidores livres, comercializadores e carregadores autorizados, limites estaduais de consumo livre, modelos tarifários e contratos de concessão: sem base nacional estruturada. A página Regulação declara a lacuna.
- Reservas provadas: a ANP publica a tabela por campo com volume in situ (VGIP), não com reservas 1P, 2P e 3P; o boletim com as reservas é PDF.

## Contrato gas 0.2.0

A revisão de 14/10/2026 acrescenta `incompleto` a `aproveitamento.serie.situacao`.
Nesse estado, parcelas, percentuais e diferença são nulos; a produção continua publicada, calculada como média diária da própria série.
O CSV de destinos acrescenta `situacao`. Zero publicado continua distinto de ausência.
Importação exige todos os meses e valores da janela, separadamente para volume e dispêndio.
Uma lacuna interna ganha linha mensal nula. O encadeamento do IPCA para na primeira falta.
Contagens por transportadora também ficam nulas nos pares reprovados pela cobertura.
A participação do importado, mensal e de 12 meses, só usa o gás disponível de meses com o balanço da produção aprovado (`situacao` igual a `ok`); jul/2005 fica sem participação.
A contagem de atos passa a CALCULADO, com fórmula explícita.

Indicadores adicionais: `soma_parcelas_mmd_12m` em aproveitamento;
`oferta_12m` e `disponivel_participacao_12m` em importação. Todos declaram fonte,
unidade, período e fórmula. A composição da inicial requer períodos idênticos e valores válidos;
a interface só calcula dimensões gráficas, nunca indicadores novos.
A gold foi reconstruída a partir do mesmo seed, sem nova coleta ou revisão das fontes.
A semântica de ausência de linhas estaduais permanece uma limitação documentada na avaliação.

Verificação inicial: doze rotas em quatro larguras, total de 48 casos, todos com
HTTP 200, um H1, nenhum erro de JavaScript e nenhum transbordamento horizontal
da página. Resultado em `VERIFICACAO_ANTES_2026-10-14.json`. Isso não certifica WCAG.
