# Módulo Empresas: cadastro, perfil da distribuidora, finanças e controle (P036 a P039)

Documento de método do módulo `empresas` (rotas `/setor-eletrico/empresas` e `/setor-eletrico/empresas/[entidade]`, família de silver `empresas`, ordem 60). Estado em 30/09/2026, fim da fase de dados: coleta, silver, gold, métricas, tipos TypeScript e testes prontos; as páginas ainda não foram escritas (fase de interface).

Arquivos do módulo:

| Camada | Caminho |
| --- | --- |
| Coleta, silver e gold | `pipeline/energia/modulos/empresas.py` |
| Leitura dos cadastros da ANEEL (SIGA, agentes, Agentes de Geração, Polímero) | `pipeline/energia/fontes/aneel_empresas.py` |
| Leitura da CVM (cadastro, DFP, ITR) | `pipeline/energia/fontes/cvm_empresas.py` |
| Métricas (14 medidas) | `pipeline/energia/metricas/empresas.py` |
| Testes (34, sem rede) | `pipeline/tests/test_energia_empresas.py`, recortes reais em `pipeline/tests/dados/energia_empresas/` |
| Gold | `public/energia/gold/empresas.json` (381 KB) |
| Downloads e leitura sob demanda | `public/energia/series/empresas_*.csv`, `empresas_ativos.json`, `empresas_cadeia.json`, `empresas_financas.json`, `empresas_evidencias.json` |
| Tipos | `src/lib/energia/tipos-empresas.ts` |

Execução: `python3 pipeline/energia/executar_modulo.py empresas` (coleta e gold, cerca de 200 s na primeira vez, com 24 arquivos da CVM) ou `--sem-coleta` (só gold, cerca de 15 s). Pico de memória medido: 709 MB na coleta (leitura do Polímero, 1,1 milhão de linhas, em duas passadas por lotes do Parquet; as árvores de todos os trimestres nunca ficam na memória ao mesmo tempo) e cerca de 650 MB na construção da gold. Zips da CVM e o Parquet do Polímero são descomprimidos do bronze em fluxo para um temporário; os CSV da CVM são lidos membro a membro e só as linhas cujo início é um CNPJ do universo passam pelo leitor de CSV.

## 1. Painéis e estado

| Painel | Dados | Estado |
| --- | --- | --- |
| P036 Cadastro e ativos | 9.956 pessoas jurídicas do Cadastro Institucional de Agentes (01/09/2026) com CNPJ, sigla e ramos; 25.042 usinas do SIGA (30/09/2026) com CEG, fase, potência, coordenadas e 25.375 parcelas de propriedade com CNPJ, participação e regime; cobertura dos vínculos: 99,91% da potência em operação e 98,95% das usinas com todos os proprietários identificados por CNPJ; 260 usinas em operação sem vínculo completo listadas pelo motivo; conferência usina a usina com o conjunto Agentes de Geração (24.902 de 24.905 iguais) | Dados concluídos com limitação declarada: ativos de transmissão sem vínculo a CNPJ na fonte aberta (seção 5). Página pendente |
| P037 Perfil da distribuidora | Índice de 123 distribuidoras (103 ativas; 71 concessionárias, 52 permissionárias) com CNPJ, sigla, siglas por fonte, razão social, UFs, slug estável, números de referência copiados das golds de Perdas, Qualidade e Conta de luz, cadeia de controle declarada à ANEEL e registro na CVM | Dados concluídos: a ficha e o comparador leem as golds de origem pelo mesmo CNPJ. Página e rota estática pendentes |
| P038 Finanças e investimentos | 151 companhias abertas do setor na CVM (105 ativas), DFP de 2010 a 2025 e ITR de 2021 a jun/2026, consolidado e individual separados, 11 contas fixas e a dívida bruta calculada, 512 documentos com mais de uma versão e 2.307 valores reapresentados identificados | Entregue em parte, com bloqueio documentado: as demonstrações regulatórias da ANEEL não estão acessíveis a cliente automatizado (seção 5); EBITDA não é publicado por não ser conta padronizada. Página pendente |
| P039 Controle e concentração | Capacidade proporcional e capacidade sob controle por proprietário direto e por grupo; grafo societário do Polímero (2º trimestre de 2026, 3.396 declarantes, 5.033 nós) com motivo de parada de cada cadeia; HHI, CR4 e CR10 por proprietário, por grupo e por grupo de controle, também por tipo de usina, sobre fronteira explícita | Dados concluídos com limitação declarada: participação econômica indireta (look-through) não calculada (seção 5). Página pendente |

Nenhum painel está declarado como entrega integral nesta fase: as páginas não existem, P038 depende de fonte regulatória bloqueada e P039 publica controle e partição proporcional, não a participação econômica indireta.

## 2. Fontes verificadas (consulta em 30/09/2026)

| Órgão e conjunto | Recurso usado | URL | Licença | Período e grão | Frequência |
| --- | --- | --- | --- | --- | --- |
| ANEEL, Agentes do Setor Elétrico (Cadastro Institucional, REN 1.004/2022) | `agentes-setor-eletrico.csv` (940 KB, UTF-8, `;`) e dicionário PDF (versão 1.0, 04/07/2023) | https://dadosabertos.aneel.gov.br/dataset/agentes-do-setor-eletrico | ODbL | fotografia de 01/09/2026; um CNPJ por linha (NumCnpj, SigPessoa, NomRazaoSocial, IdcAtivo, IdcComercializacao, IdcDistribuicao, IdcGeracao, IdcTransmissao) | mensal |
| ANEEL, SIGA | `siga-empreendimentos-geracao-diario.csv` (8,4 MB), reaproveitado da captura do módulo Expansão (família `aneel_geracao`, mesmo sha256 `139603153f57…`, registrado na família `empresas` com origem `reuso:aneel_geracao`) | https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel | ODbL | fotografia de 30/09/2026; uma linha por usina (núcleo do CEG) com DscPropriRegimePariticipacao | diária |
| ANEEL, Agentes de Geração de Energia Elétrica | `agentes-geracao-energia-eletrica.csv` (4,5 MB) e dicionário PDF | https://dadosabertos.aneel.gov.br/dataset/agentes-de-geracao-de-energia-eletrica | ODbL | fotografia de 01/09/2026; usina × agente (NumCPFCNPJ, PctParticipacao, DscRegimeExploracao); só usinas com outorga válida | mensal |
| ANEEL, Composição Societária (Polímero) | `composicao-societaria-polimero.parquet` (12,8 MB; o CSV equivalente tem 231 MB) e dicionário PDF (versão 1.2, 03/05/2024) | https://dadosabertos.aneel.gov.br/dataset/composicao-societaria-polimero | ODbL | 2018T1 a 2026T3 (2026T3 em preenchimento: 33 declarantes), gerado em 10 a 13/07/2026; árvore societária por agente e trimestre | trimestral |
| CVM, Cadastro de companhias abertas | `cad_cia_aberta.csv` (Latin-1, `;`); dicionário `meta_cad_cia_aberta.txt` consultado | https://dados.cvm.gov.br/dataset/cia_aberta-cad | ODbL | fotografia de 30/09/2026; 2.678 registros, 2.531 CNPJ | diária |
| CVM, DFP | `dfp_cia_aberta_AAAA.zip`, 2010 a 2026 (até 13 MB cada); dicionário `meta_dfp_cia_aberta_txt.zip` consultado | https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp (anos anteriores a 2021 em https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS/) | ODbL | exercícios 2010 a 2025 | anual, com reentregas |
| CVM, ITR | `itr_cia_aberta_AAAA.zip`, 2021 a 2026 (19 a 31 MB cada) | https://dados.cvm.gov.br/dataset/cia_aberta-doc-itr | ODbL | 1º trimestre de 2021 a 2º trimestre de 2026 | trimestral |
| Golds dos módulos Perdas, Qualidade e Conta de luz | `perdas.json`, `qualidade.json`, `conta.json` (lidas em `ctx['golds']`) | ver os documentos desses módulos | ODbL (ANEEL) | anos de referência de cada módulo | a de cada módulo |

Data de publicação pela fonte: o `last_modified` do CKAN para a ANEEL e o cabeçalho HTTP `Last-Modified` (GMT) para cada arquivo da CVM; nunca a data de captura.

Revisões: a política de recoleta registra cada captura; um arquivo idêntico não cria vintage. Os vínculos usina × CNPJ do SIGA e dos Agentes de Geração, o cadastro de agentes e as arestas do grafo societário ficam em `registros` (histórico por captura); os valores da CVM ficam em `observacoes` (revisão entre capturas registrada). Com uma captura por recurso até agora, nenhuma revisão entre capturas foi detectada; as versões de documentos da CVM (512 com mais de uma versão) e as reapresentações (2.307 valores) vêm da própria fonte.

Conjuntos consultados e não usados: SIGET (contratos de transmissão identificados por código interno, sem CNPJ); TFSEE (valores de taxa por agente, fora do escopo); FRE da CVM (posição acionária de companhias abertas; o Polímero cobre o setor inteiro com a marca de controlador).

## 3. Método

### 3.1 Identidade

Chave canônica: CNPJ de 14 dígitos (`pipeline/energia/entidades.py`). O vínculo usina × proprietário é o CNPJ publicado no mesmo registro do SIGA; o vínculo distribuidora × módulo é o CNPJ publicado pelo SAMP, pelos indicadores de continuidade e pelas tarifas. Nenhum vínculo por nome. Nomes são rótulos, com prioridade: razão social do cadastro de agentes, denominação na CVM, nome do sócio no Polímero, nome do proprietário no SIGA. Nome de pessoa física não é republicado em nenhum arquivo do módulo.

### 3.2 Vínculos de propriedade (P036)

O campo `DscPropriRegimePariticipacao` do SIGA tem o formato `<pct>% para <nome> - <CNPJ formatado ou vazio> (<REGIME>)`, com itens separados por vírgula. A leitura usa uma expressão ancorada: cada item precisa começar onde o anterior terminou e o último precisa terminar no fim do campo; qualquer sobra invalida a usina inteira (estado `nao_lido`, nenhum caso em 30/09/2026). Nomes com ` - ` interno (por exemplo "DME DISTRIBUICAO S.A. - DMED") são lidos corretamente porque o CNPJ formatado é a âncora do fim do item.

Estados por usina: `vinculado` (todas as parcelas com CNPJ e soma a 100% dentro de 0,005 p.p. por parcela, o arredondamento máximo de percentuais publicados com duas casas); `inclui_sem_documento` (soma válida, com proprietário pessoa física sem CPF no SIGA); `soma_divergente` (ex.: matriz e filial do mesmo CNPJ raiz com 100% cada, 16 usinas; o campo `mesma_raiz` diz quando é a mesma pessoa jurídica, sem consolidar); `sem_proprietario` ("Não Informado", 111 usinas).

Cobertura = 100 × Σ potência fiscalizada das usinas em operação vinculadas ÷ Σ potência fiscalizada das usinas em operação.

### 3.3 Capacidade proporcional e sob controle (P039)

* Capacidade proporcional do proprietário e = Σ_u potência fiscalizada(u) × pct(e, u) ÷ Σ pct(u), só usinas em operação com soma válida. A divisão pela soma publicada corrige resíduos de arredondamento aceitos pela tolerância (Machadinho soma 100,0001%) e faz a partição fechar exatamente.
* Capacidade sob controle direto = potência inteira das usinas em que o proprietário tem mais de 50%. As duas medidas nunca são somadas entre si.
* Grupo = topo da cadeia de controladores únicos declarada ao Polímero (seção 3.4). Capacidade sob controle do grupo = potência das usinas cujo proprietário majoritário está na cadeia que termina no grupo. Capacidade proporcional do grupo = soma das capacidades proporcionais dos proprietários diretos cujo topo é o grupo.
* Identidades verificadas a cada geração (violação vira stub): Σ proprietários + parcela sem CNPJ = fronteira; Σ grupos = Σ proprietários diretos (tolerância de ponto flutuante de 10⁻⁹ relativo).

### 3.4 Grafo societário (Polímero)

* Semântica do percentual, conferida nos dados: `PctParticipacaoNivelAcima` é relativo ao agente declarante (raiz da árvore), não ao nível imediatamente acima, como diz o dicionário ("em relação ao Agente/Primeiro Pai da Árvore Societária"). Em 967 de 968 casos do 1º trimestre de 2026 em que o pai tem participação entre 1% e 99% no nível 1, os sócios dele no nível 2 somam essa participação. O percentual direto de S em X é 100 × pct(S) ÷ pct(X) quando X aparece uma vez na árvore; X em dois caminhos deixa o direto indefinido (null).
* Trimestre de referência: o último cujo número de agentes declarantes distintos chega a 90% do maior dos quatro anteriores (2026T2: 2.900 declarantes contra 3.075 em 2025T4; 2026T3, com 33, ainda está em preenchimento).
* Declaração vigente de cada agente: a última dentro dos quatro trimestres até o de referência (3.396 agentes; 833 declararam só antes da janela e ficam fora).
* Sócios de um nó: a declaração do próprio nó quando existe; senão as listas em que ele aparece como pai nas árvores de outros agentes. Listas precisam concordar sobre quem é controlador em ao menos 90% dos casos (limiar publicado; percentuais de minoritários variam entre datas de declaração sem mudar o controle); abaixo disso o nó fica ambíguo (292 nós). Exemplo real: 99 de 110 listas dão a State Grid Brazil Power como controladora única da CPFL Energia; a CEMIG tem 47 listas com o Estado de Minas Gerais, 16 com outra empresa e 8 com outros conjuntos, e fica ambígua.
* Cadeia: sobe de controlador único em controlador único enquanto há um só sócio marcado como controlador e ele tem CNPJ. Para em: `compartilhado` (mais de um controlador), `pessoa_fisica`, `sem_cnpj` (controlador estrangeiro, governo ou fundo sem CNPJ; o nome aparece em `acima`), `sem_controlador`, `ambigua`, `sem_declaracao` e `ciclo`. O topo é o último CNPJ provado.
* Vigência de cada aresta: primeiro e último trimestre em que aparece em toda a base (CSV da cadeia). "Declaração de mudança societária relevante" (trimestre 0) informa só o ano e é contada à parte (1.426 agentes).

### 3.5 Concentração (P039)

Fronteira: potência fiscalizada das usinas em fase Operação no SIGA com participações válidas, Brasil, 30/09/2026: 220.501,8 MW em 22.665 usinas (de 220.658,9 MW em operação; 157,1 MW fora). Exclui micro e minigeração distribuída. HHI = Σ (cota em %)²; CR4 e CR10 = soma das maiores cotas. Participante sem CNPJ (pessoas físicas, 42,7 MW) fica no denominador e fora do numerador: o índice é limite inferior. Três níveis: proprietário direto (HHI 135), grupo pela capacidade proporcional (HHI 392, CR4 29,65%, CR10 46,72%) e grupo pela capacidade sob controle (HHI 390; 3.401,2 MW em 236 usinas sem CNPJ acima de 50% ficam fora do numerador). Por tipo de usina, só no nível de grupo (UHE: HHI 1.454, CR4 58,44%). Faixas descritivas (menor que 1.500, 1.500 a 2.500, maior que 2.500) das diretrizes de concentração horizontal de 2010; a fronteira não é mercado relevante de análise concorrencial.

### 3.6 Distribuidoras (P037)

Universo: CNPJ presente no SAMP (gold de Perdas), nos indicadores de continuidade (gold de Qualidade) ou nas tarifas (gold de Conta de luz). O indicador "distribuição" do cadastro de agentes não serve: é autodeclarado e inclui parques solares e a ANATEL. Sigla de exibição com prioridade tarifas, continuidade, SAMP, cadastro; todas ficam em `siglas`. Classificação e grupo do SAMP, conferidos contra a continuidade (nenhum conflito). UFs da relação conjunto elétrico × município (gold de Perdas); 20 distribuidoras sem conjuntos vigentes ficam sem UF. Slug: `slug(sigla)`; quando duas distribuidoras têm a mesma sigla (incorporada e incorporadora), a única ativa fica com o slug simples e as demais recebem a raiz do CNPJ (`rge-02016439`, `cpfl-santa-cruz-61116265`, `celesc-83878892`); siglas alternativas viram aliases quando não colidem (`rge-sul`, `cpfl-jaguari`). Os valores de perdas, qualidade e tarifa são cópias da gold de origem pelo CNPJ, sem recálculo, com a data de geração de cada gold em `golds_origem`.

### 3.7 Finanças (P038)

Universo: companhias do cadastro da CVM com setor "Energia Elétrica" ou "Emp. Adm. Part. - Energia Elétrica" (151 CNPJ), mais distribuidoras do índice com registro (todas já estavam nesses setores). Contas: só as fixas do plano padronizado (`ST_CONTA_FIXA = S`): 3.01, 3.05, 3.11, 3.11.01, 1, 1.01.01, 2.01.04, 2.02.01, 2.03, 6.01, 6.02; rótulo da 3.01 conferido. Escala: MIL × 1.000, UNIDADE × 1, outra descartada e contada (nenhuma). Versão: para cada documento vale a maior versão presente no arquivo (os arquivos da CVM trazem só a mais recente nos dados e todas no índice). Consolidado (`con`) e individual (`ind`) são séries separadas. DFP: só exercícios de 12 meses (1º de janeiro a 31 de dezembro). ITR: DRE com o trimestre (três meses) e o acumulado no ano; balanço no fim do trimestre; DFC acumulada; o 4º trimestre não é deduzido por diferença. Dívida bruta = 2.01.04 + 2.02.01 do mesmo escopo e data, ausente se faltar uma. Reapresentação: valor do exercício no comparativo da DFP seguinte (`PENÚLTIMO`) diferente do original em mais de R$ 1 mil (escala da fonte). Controladora aberta: primeira companhia aberta ativa na cadeia de controle declarada à ANEEL (55 companhias têm uma; ela consolida os números da controlada e nunca se somam).

### 3.8 Evidências ("Comprove este número")

`pipeline/energia/evidencia.py`: cobertura dos vínculos (P036) e HHI por grupo (P039) na gold; receita do último exercício de cada companhia (138 evidências) em `empresas_evidencias.json`, com arquivo, sha256, chave de origem (CNPJ, DT_REFER, VERSAO, membro do zip, CD_CONTA), documento e data de recebimento na CVM e reconciliação com o comparativo da DFP seguinte quando existe.

## 4. Evidências de aceite (conferências contra a fonte)

| Entidade e período | Valor da gold | Valor da fonte (caminho independente) | Diferença | Tolerância |
| --- | --- | --- | --- | --- |
| Vínculos SIGA 30/09/2026 × Agentes de Geração 01/09/2026 | 24.902 de 24.905 usinas iguais (CNPJ e percentual) | conjunto Agentes de Geração relido e comparado usina a usina | 3 usinas com CNPJ diferente (Salto Claudelino, núcleo 30538, Frascal): mudanças entre as duas datas | 0,01 p.p. por parcela |
| Proprietários do SIGA (14 usinas do recorte) | parcelas lidas pela expressão ancorada | releitura por outra técnica (corte por parêntese de regime e último " - ") no teste | 0 | 10⁻⁶ p.p. |
| Belo Monte, 30/09/2026 | 11.233,1 MW, 100% Norte Energia (12.300.288/0001-07) | linha original do SIGA: MdaPotenciaFiscalizadaKw 11233100 | 0 | 0 kW |
| Machadinho, DME Distribuição | 33,08 MW proporcionais (2,902% de 1.140 MW ÷ 100,0001%) | linha original: 2.9020% | 0,00003 MW (normalização) | tolerância de soma 0,035 p.p. |
| Potência EOL em operação no SIGA | 34.936,6 MW | agregado oficial "capacidade instalada por UF" de jun/2026 mais liberações até 30/09 (reconciliação do módulo Expansão, mesmo SIGA) | resíduo de 0,003 MW | 1% do agregado |
| CEMIG, receita consolidada 2024 | R$ 39.819.620 mil | `dfp_cia_aberta_DRE_con_2024.csv` relido com csv no teste (CD_CONTA 3.01, ÚLTIMO) e comparativo da DFP 2025 | 0 | R$ 1 mil |
| CEMIG, receita do 2º trimestre de 2025 | R$ 10.786.295 mil (trimestre) e R$ 20.630.526 mil (acumulado) | `itr_cia_aberta_DRE_con_2025.csv`, DT_INI 2025-04-01 e 2025-01-01 | 0 | R$ 1 mil |
| CEMIG, dívida bruta consolidada 31/12/2024 | R$ 12.279.300 mil | 2.01.04 (2.876.548) + 2.02.01 (9.402.752) relidos do BPP | 0 | R$ 1 mil |
| Axia Energia, ativo total 31/12/2011 | R$ 163.142.432 mil, reapresentado R$ 164.081.665 mil | DFP 2011 (ÚLTIMO) e DFP 2012 (PENÚLTIMO) | publicado nas duas colunas do CSV | R$ 1 mil |
| HHI por grupo | 392,1 | recalculado no teste a partir das cotas do CSV de grupos | menor que 0,1 ponto | 0,1 ponto (cotas com 4 casas) |
| CEMIG D (perdas, DEC, tarifa) | 12,12%; 8,98 h; R$ 903,29/MWh | golds perdas.json, qualidade.json, conta.json | 0 | cópia exata |
| Polímero, semântica do percentual | percentual direto de Enel Americas em Enel Brasil = 99,6696% | árvore da Ampla: 99,56 ÷ 99,89 | 0 | 10⁻⁹ |

Testes (`python3 -m unittest pipeline.tests.test_energia_empresas`): 34 aprovados em 30/09/2026. Cobrem entidade grande (Axia, Belo Monte) e pequena (CGH de 360 kW), multiestadual (CPFL Santa Cruz em MG, PR e SP), mudança societária (RGE e CPFL Santa Cruz incorporadas, com o motivo publicado pela gold de Conta), valor extremo (Machadinho com sete sócios), ausência (qualidade nula, conta livre, escala desconhecida, 4º trimestre não deduzido), versões de documento, pessoa física sem nome publicado, ciclo, controle compartilhado, controlador estrangeiro sem CNPJ e a regra de concordância.

## 5. Limitações materiais e bloqueios

* Demonstrações regulatórias (P038), bloqueio: o Balancete Mensal Padronizado e a base de sustentabilidade econômico-financeira das distribuidoras (link na página https://www.gov.br/aneel/pt-br/centrais-de-conteudos/relatorios-e-indicadores/tarifas-e-informacoes-economico-financeiras) são servidos por `git.aneel.gov.br`, que respondeu HTTP 403 com `cf-mitigated: challenge` (desafio do Cloudflare) em 30/09/2026 para `2026_1T_base_dados_sustentabilidade.zip` e para a listagem da pasta; `http://informacoesbmp.aneel.gov.br/` respondeu HTTP 503. O portal de dados abertos da ANEEL não tem conjunto equivalente (buscas "balancete", "econômico-financeiro", "demonstrações", "informações contábeis"). O acesso não foi contornado. O que se entrega são demonstrações societárias da CVM, rotuladas como tais; a comparação regulatório × societário não é possível.
* EBITDA (P038): não é conta fixa da DFP/ITR; o observatório não o calcula (somar depreciação e amortização da DVA seria um EBITDA próprio, não o publicado). Publica-se a conta 3.05.
* Investimento (P038): a conta padronizada é o caixa das atividades de investimento (6.02), que inclui aquisições, aplicações e resgates; o investimento em ativos de concessão não tem conta fixa.
* Cobertura financeira: companhias abertas (151 CNPJ, 105 ativos); sociedades de propósito específico, cooperativas e empresas fechadas não publicam DFP/ITR. Não representa o setor.
* Transmissão (P036): o SIGET publica contratos e módulos com código interno de concessão, sem CNPJ. Transmissoras aparecem no cadastro de agentes (469 com o ramo declarado) e, quando abertas, nas finanças.
* Grupo econômico (P039): depende das declarações ao Polímero. 3.441 dos 5.581 proprietários diretos com CNPJ não aparecem na composição declarada na janela e são o próprio topo; 781 param em controle compartilhado; 754 em declarações discordantes. 61,33% da capacidade proporcional está em proprietários com grupo acima deles. A fonte informa o percentual em relação ao agente declarante; o percentual direto só é publicado quando o pai aparece uma vez na árvore.
* Participação econômica indireta (look-through) não calculada: exige todos os caminhos societários com percentuais diretos, o que a fonte não garante; a capacidade proporcional do grupo soma as participações diretas das controladas sem multiplicar pela fração do grupo nelas.
* Controle do ativo pelo critério de maioria (> 50%); acordos de acionistas não estão na fonte.
* Datas diferentes: SIGA diário (30/09/2026), Agentes de Geração e cadastro mensais (01/09/2026), Polímero trimestral (2026T2), CVM por documento; cada bloco da gold traz a sua data.
* Proprietário pessoa física: o SIGA publica o nome sem CPF e o Agentes de Geração, o CPF mascarado; o módulo conta a parcela e não republica o nome.
* O que não se pode concluir: concentração de mercado em sentido concorrencial (a fronteira é capacidade instalada, não energia vendida por submercado); desempenho do setor a partir das companhias abertas; soma de receitas ou dívidas entre companhias (controladoras já consolidam controladas).

## 6. Pedidos ao integrador

1. `src/lib/energia/navegacao.ts` e `mapa.ts`: incluir a rota dinâmica `/setor-eletrico/empresas/[entidade]` (páginas estáticas geradas de `distribuidoras.indice[].slug` e `slugs_alternativos`, estes como rotas de apoio que apontam para o slug principal).
2. `catalogo.py` / `datasets.ts`: os sete conjuntos do REGISTRO (agentes, SIGA, Agentes de Geração, Polímero, cadastro, DFP e ITR da CVM) entram pelo registro do módulo; a CVM é órgão novo no catálogo do domínio Energia e pode precisar de rótulo e licença no catálogo manual.
3. `run.py`: o módulo depende das golds `perdas.json`, `qualidade.json` e `conta.json` construídas na mesma execução (ordem 60 já garante) e reaproveita o SIGA da família `aneel_geracao` quando a captura tem até 7 dias; se o módulo Expansão não rodar, a coleta do SIGA acontece na família `empresas`.
4. Cache do Actions: a família `empresas` tem os zips da CVM no bronze (338 MB no bronze após a primeira coleta); a recoleta dos exercícios antigos é trimestral (90 dias) para não baixar tudo toda semana.
