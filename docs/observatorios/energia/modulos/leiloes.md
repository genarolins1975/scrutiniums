# Módulo Leilões (ACR e transmissão)

Documento de método do módulo `leiloes` (rotas `/setor-eletrico/leiloes` e `/setor-eletrico/leiloes/transmissao`, família de silver `aneel_leiloes`, ordem 65). Estado em 16/10/2026: dados e interface entregues; a inspeção visual em navegador está registrada na seção 7.

Arquivos do módulo:

| Camada | Caminho |
| --- | --- |
| Coleta, silver e gold | `pipeline/energia/modulos/leiloes.py` |
| Leitura e classificação (CSV da ANEEL, situação, controle, IPCA) | `pipeline/energia/fontes/aneel_leiloes.py` |
| Métricas (6 medidas) | `pipeline/energia/metricas/leiloes.py` |
| Testes Python (22, sem rede) | `pipeline/tests/test_energia_leiloes.py`, recortes reais em `pipeline/tests/dados/energia_leiloes/` |
| Gold | `public/energia/gold/leiloes.json` (cerca de 245 KB) |
| Downloads | `public/energia/series/leiloes_empreendimentos.csv`, `leiloes_por_leilao.csv`, `leiloes_preco_fonte_ano.csv`, `leiloes_grupos_controle.csv`, `leiloes_transmissao_real.csv` |
| Leitura sob demanda | `public/energia/series/leiloes_empreendimentos.json` (dispersão de preço por empreendimento) |
| Tipos e lógica pura | `src/lib/energia/tipos-leiloes.ts`, `src/lib/energia/leiloes.ts`, `src/lib/energia/logos-servidor.ts` |
| Páginas | `src/app/setor-eletrico/leiloes/page.tsx` e `transmissao/page.tsx` (force-static) |
| Componentes | `LeiloesPagina.tsx` (servidor), `LeiloesLabs.tsx`, `LeiloesOpcoes.tsx`, `LeiloesDispersao.tsx` (cliente) |
| Testes da interface | `src/tests/energia-leiloes.test.ts`, com o manifesto de logos de exemplo em `src/tests/fixtures/logos-manifesto-exemplo.json` |

Execução: `python3 pipeline/energia/executar_modulo.py leiloes` (coleta e gold) ou `--sem-coleta` (só a gold, a partir do silver e dos CSV publicados pelos módulos Expansão e Empresas). Em 16/10/2026 a gold sai em cerca de 2 s.

## 1. Painéis e estado

| Página | O que entrega | Estado |
| --- | --- | --- |
| Leilões do ACR | Energia contratada por ano, fonte e tipo; preço médio nominal e corrigido pelo IPCA por fonte e ano, dispersão por empreendimento sob demanda; deságio por empreendimento e por ano; mapa por UF; vencedoras como publicadas e grupo que controla a usina no cadastro mais recente, com logotipo quando o manifesto tiver; situação atual das usinas contratadas e entrada em operação contra o ano A; frases citáveis; tabela dos 48 leilões; diagrama do ACR, linha do tempo dos produtos e laboratório do leilão descendente | Concluído com limitação declarada (seção 5) |
| Leilões de transmissão | RAP vencedora por ano nominal e corrigida, investimento previsto corrigido, deságio por lote (histograma, mediana e quartis por ano), vencedores com mais lotes, frases citáveis | Concluído com a mesma limitação do módulo Expansão: o arquivo aberto termina no leilão de 27/09/2024 |

## 2. Fontes verificadas (consulta em 16/10/2026)

| Fonte | Recurso | Publicação pela fonte | Período e grão | Licença |
| --- | --- | --- | --- | --- |
| ANEEL, Resultado de Leilões, https://dadosabertos.aneel.gov.br/dataset/resultado-de-leiloes | `resultado-leiloes-geracao.csv` (422.878 bytes, Windows-1252, `;`, vírgula decimal; `DatGeracaoConjuntoDados` = 01/10/2026) e o dicionário "Resultados dos Leilões de Geração" (PDF, versão 1.0 de 30/03/2023) | last_modified 01/10/2026 05:00 | 1.552 linhas, uma por empreendimento vencedor em cada leilão; 48 leilões de 16/12/2005 a 22/08/2025 | ODbL |
| IBGE, SIDRA tabela 1737, variável 2266 (número-índice do IPCA), https://sidra.ibge.gov.br/tabela/1737 | resposta JSON da API (122.546 bytes) | o IBGE não informa data de modificação na API | mensal, dez/1979 a set/2026 | dados públicos do IBGE com citação |
| Módulo Expansão (mesma execução) | `expansao_usinas_siga.csv` (SIGA de 30/09/2026), `expansao_encerramentos_outorga.csv` (atos até 25/09/2026, desde 2015), `expansao_carteira_ralie.csv` (RALIE de 18/09/2026), `expansao_leiloes_transmissao.csv` (lotes de 1999 a 27/09/2024) | sha256 registrado em `insumos` da gold | usina e lote | ODbL |
| Módulo Empresas (mesma execução) | `empresas_ativos.csv` (proprietários do SIGA com participação e grupo), `empresas_cadeia.json` (cadeia de controladores declarada à ANEEL), `empresas_grupos.csv` | sha256 registrado em `insumos` da gold | usina × proprietário; CNPJ | ODbL |

O dicionário descreve o conjunto como "os resultados dos Leilões de Energia do Ambiente de Contratação Regulada, realizados desde 2005" e o tipo de leilão como "energia nova (A-3 a A-7), leilão de energia reserva, Leilão estruturante ou Leilão de fontes Alternativas". O arquivo de 01/10/2026 traz A-3, A-4, A-5, A-6, LER, FA e Estruturante.

O IPCA vem do IBGE (número-índice), e não da série 433 do SGS do Banco Central (variação mensal com duas casas): o índice evita acumular arredondamentos e é a mesma fonte usada pelos módulos PLD e Conta de luz. A série 433 entra só no teste, como caminho independente (seção 4).

## 3. Método

### 3.1 Leitura

Codificação Windows-1252: o travessão do nome da vencedora de Belo Monte ("Companhia Hidro Elétrica do São Francisco – CHESF") é o byte 0x96, que em Latin-1 seria caractere de controle. Números com vírgula decimal e sem zero à esquerda (",72"). `SigTipoGeracao` vem às vezes com espaço ("EOL "), aparado.

Unidades conferidas nas próprias linhas: `VlrEnergiaVendida` em MWmédio (Belo Monte 3.199, Jirau 1.382, Santo Antônio 1.552, a energia vendida ao ACR nos leilões estruturantes); `VlrDesagio` em percentual (Costa Pinto, 1º LEN: teto 140,00, preço 138,99, deságio 0,72); `MdaGarantiaFisicaSEL` em MWmédio (Belo Monte 4.571); investimento em reais nominais.

Zeros que são campo não preenchido viram ausência: preço 0 (Paraúna, 7º LEN, com deságio 100% e sem CEG), garantia física 0 com energia vendida (Pecém II e Camaçari Muricy II, 2º LEN) e investimento 0 (80 linhas). Deságio zero é valor (60 linhas venderam no teto).

Categoria de fonte: `DscFonteEnergia`, com a hídrica separada em UHE e em PCH ou CGH pelo `SigTipoGeracao`; "Resíduos Sólidos Urbanos" entra em "Biomassa e resíduos".

Chave da linha no silver: leilão, núcleo do CEG, nome do empreendimento e vencedora (o par leilão × núcleo se repete em 4 casos, seção 5).

### 3.2 Medidas

* Energia contratada = Σ `VlrEnergiaVendida` (MWmédio); soma entre leilões porque cada linha é um contrato. Potência (MW) só por leilão: uma usina vendida em mais de um leilão repete a potência (Porto das Águas aparece em cinco leilões).
* Preço médio = Σ preço × energia ÷ Σ energia das linhas com preço. Nas termelétricas por disponibilidade o campo é o ICB, como diz o dicionário.
* Preço corrigido = preço × I(último mês do IPCA) ÷ I(mês do leilão). Fator de 16/12/2005 até set/2026: 7.695,82 ÷ 2.535,40 = 3,0354.
* Deságio agregado = 100 × (1 − Σ preço × energia ÷ Σ teto × energia); distribuição por empreendimento com quartis.
* Ano A dos produtos A-x = ano do leilão + x.

### 3.3 Situação atual (o que foi entregue)

Pelo núcleo do CEG, nesta ordem: fase do SIGA (Operação, Construção, Construção não iniciada); fora do SIGA, ato de revogação ou extinção publicado desde 2015 (outorga encerrada); senão, sem situação identificada; linha sem CEG à parte. A fase do SIGA prevalece sobre o ato: 9 contratos de usinas em operação têm ato de encerramento (Pecém II, revogada em 2023 e em operação no SIGA desde 01/10/2024; conversão de regime ou nova outorga). Jambo foi revogada em 2019 e vendeu de novo em 2025; está em construção.

Entrada em operação contra o ano A (só produtos A-x e usinas em operação): antes do leilão (ampliação ou usina existente), até 31/12 do ano A, depois do ano A, sem data. A data do SIGA é da usina inteira.

### 3.4 Quem venceu e quem controla

A vencedora é publicada como texto (`DscEmpresaVencedora`: "repetição da empresa vencedora ou nome do cotista do consórcio"), sem CNPJ; 631 grafias distintas, nenhuma fundida.

À parte, o grupo que controla a usina no cadastro mais recente: proprietário com mais de 50% da usina no SIGA (vínculo pelo CNPJ publicado no mesmo registro) e o topo da sua cadeia de controladores únicos declarada à ANEEL, a mesma regra da capacidade sob controle do módulo Empresas. Usina sem proprietário com mais de 50% fica sem grupo (Glória, núcleo 1034: 70,07% de três empresas do mesmo grupo, nenhuma com maioria). A gold publica, para cada grupo, a cadeia de CNPJs do topo para baixo (`cadeia_cnpjs`), usada para o logotipo.

Logotipo: a página lê `public/energia/logos/manifesto.json` no build. Mostra o logotipo quando o CNPJ do grupo, ou o de uma holding da cadeia (a mais alta primeiro), está no manifesto; nunca por semelhança de nome. Sem o manifesto, ou com arquivo não publicado, só o nome. Formatos aceitos: `{ logos: [...] }`, `{ itens: [...] }` ou lista; CNPJs em `cnpj_holding`, `cnpj_grupo`, `cnpj`, `holding_cnpj`, `grupo_cnpj` ou `cnpjs`; arquivo em `arquivo`, `src` ou `url`, relativo a `/energia/logos/`; caminhos com `..` ou endereço externo são recusados.

### 3.5 Transmissão

Lotes contratados de `expansao_leiloes_transmissao.csv`. Deságio por lote = 100 × (1 − RAP vencedora ÷ RAP do edital), recalculado das RAPs (dois lotes têm deságio publicado divergente, listados pelo módulo Expansão). RAP e investimento corrigidos pelo IPCA do mês do leilão.

## 4. Evidências de aceite

| Conferência | Valor da gold | Referência | Resultado |
| --- | --- | --- | --- |
| Energia vendida ao ACR em Belo Monte, Jirau e Santo Antônio | 3.199, 1.382 e 1.552 MWmédio | resultados conhecidos dos leilões estruturantes | igual |
| Deságio publicado contra 100 × (1 − preço ÷ teto) | 1.551 de 1.551 linhas com preço e teto | tolerância de 0,05 ponto percentual (duas casas da fonte) | aprovado |
| Fator do IPCA dez/2005 a set/2026 | 3,0354 (índice do IBGE) | produto das 249 variações mensais da série 433 do Banco Central: 3,0354 | diferença menor que 0,05% |
| RAP vencedora nominal por ano | soma por ano deste módulo | soma por ano calculada pelo módulo Expansão (outro código) | igual, tolerância de 0,11 R$ milhão |
| Preço médio do 39º LEN (3 PCH do recorte) | ponderado pela energia | releitura do arquivo original com `csv` | igual |
| Situações exaustivas | 1.552 contratos em 6 situações | total de linhas | igual |

Números publicados (gold de 16/10/2026): 48 leilões, 1.552 contratos, 40.167,5 MWmédio; 82,6% da energia (33.194,4 MWmédio) de usinas em operação no SIGA de 30/09/2026, 7,1% (2.871,8) de outorgas encerradas desde 2015, 7,9% (3.192,5) sem situação identificada (térmicas a óleo de 2007 e 2008, como MC2 Macaíba, fora do SIGA e sem ato desde 2015); último leilão, 39º LEN (A-5, 22/08/2025): 384,5 MWmédio a R$ 392,84/MWh, deságio agregado de 3,16%; deságio mediano por empreendimento de 13,22%; transmissão: 421 lotes contratados, deságio mediano por lote de 32,85%.

## 5. Limitações

* Cobertura: a base não traz leilões de energia existente, de ajuste, de reserva de capacidade, de sistemas isolados nem procedimentos competitivos simplificados. A numeração da CCEE presente tem lacunas (LEN 9, 14, 24, 31, 32 e 38; LER 9), e a base não tem leilão em 2020, 2023 e 2024; o observatório não verificou o que cada número ausente foi. A CCEE, que publica resultados consolidados, responde 403 ("Acesso bloqueado") a este ambiente.
* Situação não é cumprimento de contrato: prazos alterados por ato, excludentes de responsabilidade, rescisões, descontratações e substituições não estão nos arquivos. Atos de encerramento só desde 2015.
* CEG repetido no mesmo leilão em 4 pares: Salto Pilão (duas linhas com a mesma potência e vencedoras diferentes, mantidas como publicadas), MC2 Camaçari 3 e MC2 Governador Mangabeira, Icaraí I e II, Jandaia e São Januário (usinas diferentes sob o mesmo CEG); a situação e o grupo vêm da usina do CEG.
* Energia vendida acima da garantia física publicada em 5 linhas, mantidas.
* O preço corrigido é régua de comparação, não o preço vigente do contrato. O ICB não é o custo da energia gerada.
* O grupo de controle é o do cadastro mais recente, não a vencedora na data do leilão.
* Nomes dos vencedores de transmissão com "?" no lugar de letras acentuadas vêm do arquivo (ex.: "CHESF - COMPANHIA HIDRO ELE?TRICA").

## 6. Pedidos ao integrador

* Navegação: destino `leiloes` no grupo "Preços e mercado" (`navegacao.ts`), cartão da página inicial (`mapa.ts`, com o nó "Contratos" do mapa conceitual apontando para Leilões), sinônimos de busca e siglas (CCEAR, CER, LEN, LER, LFA, ICB, UHE, PCH, CGH). Os testes que contam destinos passaram de 20 para 21.
* Logotipos: o manifesto `public/energia/logos/manifesto.json` é escrito pela frente de empresas listadas; esta página o lê no build e funciona sem ele. Quando ele chegar, conferir que cada item tem CNPJ (holding ou grupo) e arquivo publicado.
* `metricas.json`, `arquivos.json` e `manifesto.json` foram regenerados por `executar_modulo.py` e devem ser regenerados de novo depois de juntar outra frente que crie módulo.

## 7. Verificação da interface

Capturas em 390 e 1440 px das duas páginas estão no scratchpad da sessão (`leiloes/`). Teclado e toque conferidos nos controles nativos (rádios, caixas de seleção, deslizantes); a dispersão sob demanda percorre os pontos pelas setas. Leitor de tela não foi testado.
