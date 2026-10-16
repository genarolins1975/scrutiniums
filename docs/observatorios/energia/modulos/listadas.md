# Módulo Listadas: companhias do Índice de Energia Elétrica (IEE) da B3

Documento de método do módulo `listadas` (rotas `/setor-eletrico/empresas/listadas` e `/setor-eletrico/empresas/listadas/[papel]`, família de silver `listadas`, ordem 65, depois do módulo Empresas). Estado em 16/10/2026: dados e interface entregues; inspeção visual em 390 e 1440 px feita nesta sessão.

## 1. O que o painel responde

A pergunta veio de uma pesquisadora: para as companhias listadas de eletricidade, quais são os ativos, quem as controla, como têm performado, alguns indicadores financeiros e como têm se movimentado. O painel responde cada parte com uma fonte oficial e um método explícito:

| Parte | Medida | Fonte |
| --- | --- | --- |
| Universo | carteira do dia do IEE (papel, peso, segmento de listagem) | B3, API do portal de índices (GetPortfolioDay, índice IEEX) |
| Ativos | usinas, linhas e distribuidoras sob controle da companhia | ANEEL (SIGA, SIGET, índice de distribuidoras) pelo que o módulo Empresas publica, e a cadeia do Polímero |
| Quem controla | acionistas diretos, controladores, acordo de acionistas; cadeia de controladores únicos | CVM, Formulário de Referência (posição acionária); ANEEL, Polímero; CVM, Formulário Cadastral (espécie de controle) |
| Finanças | receita, EBIT (conta 3.05), lucro, dívida bruta, patrimônio, razões | CVM, DFP consolidada, pela série que o módulo Empresas publica |
| Desempenho | preço ajustado e retorno total em 12 meses, no ano e desde o fim de 2020; volume médio diário | B3, COTAHIST; eventos em ações e proventos por emissor |
| Movimentos | fatos relevantes de 24 meses; mudanças de posição acionária entre dois FRE | CVM, IPE e FRE |

Nada é somado entre companhias: Cemig participa do controle da Taesa e AXIA tem 19,4% do total de ações da ISA Energia.

## 2. Fontes verificadas (16/10/2026)

| Fonte | Recurso | Observação |
| --- | --- | --- |
| B3, carteira do IEE | `indexProxy/indexCall/GetPortfolioDay/<base64>` | 12 papéis em 16/10/2026, pesos somando 100,000%. Uma vintage por dia: a B3 não publica a carteira histórica em arquivo aberto, e o histórico de pesos começa na primeira captura |
| B3, emissores | `listedCompaniesProxy/CompanyCall/GetListedSupplementCompany` | quantidade de ações e eventos em ações (desdobramento, grupamento, bonificação). Com `Accept: application/json` a API devolve o JSON serializado duas vezes; o leitor aceita as duas formas |
| B3, proventos | `GetListedCashDividends` por nome de pregão, todas as páginas | dividendos, juros sobre capital próprio e rendimentos por classe (ON, PN, UNT), com o fechamento anterior à data ex. Parcelas iguais são mantidas (JCP pago em duas datas) |
| B3, COTAHIST | `bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_AAAA.ZIP`, 2020 a 2026 | 60 a 90 MB por ano; download com retomada por Range. A B3 recusa (403) o agente padrão do Python; o módulo usa o agente identificado do projeto (`pipeline.common.USER_AGENT`). Só mercado à vista (010), lote padrão (BDI 02) |
| CVM, FCA | `fca_cia_aberta_AAAA.zip`, 2020 a 2026 | descrição da atividade, espécie de controle, nome anterior, códigos de negociação por classe (ponte papel → CNPJ) |
| CVM, FRE | `fre_cia_aberta_AAAA.zip`, três anos | posição acionária, primeiro nível; maior versão de cada documento |
| CVM, IPE | `ipe_cia_aberta_AAAA.zip`, três anos | categoria Fato Relevante; maior versão por protocolo |
| ANEEL, Polímero | `composicao-societaria-polimero.parquet` | reaproveitado do silver do módulo Empresas quando existe; senão coletado na família `listadas` |

Licença: CVM e ANEEL declaram ODbL. A B3 publica os dados no portal sem licença aberta declarada; o painel cita a fonte em cada número.

Bloqueio documentado: os documentos do sistema RAD da CVM (`rad.cvm.gov.br/ENET/frmDownloadDocumento.aspx`) chegaram truncados neste ambiente (8 a 13 KB de PDFs maiores); o painel publica o link, não o conteúdo, e nenhum valor depende desses PDFs.

## 3. Método

### 3.1 Papel → companhia

O código CVM do emissor publicado pela B3 dá o CNPJ no FCA (campo `Codigo_CVM`); o FCA da mesma companhia precisa declarar o papel como código de negociação. Resultado em 16/10/2026: 12 de 12 papéis "igual" nas duas fontes.

### 3.2 Ativos sob controle

Empresa sob controle de uma holding H: a cadeia de controladores únicos declarada à ANEEL (mesma regra de `aneel_empresas.cadeia_de_controle` usada no módulo Empresas) que sobe a partir dela passa por H. O nível é o número de degraus entre H e a empresa.

* Usinas (de `empresas_ativos.csv`): `mw_controle` soma a potência fiscalizada das usinas em operação de participações válidas cujo CNPJ com mais de 50% está sob controle; `mw_proporcional` soma potência × participação direta das empresas sob controle; `mw_em_implantacao` soma a potência outorgada das usinas em construção ou não iniciadas cujo majoritário está sob controle. Mesmas definições de `capacidade_controle_grupo` e `capacidade_proporcional_grupo` do módulo Empresas, com a holding no lugar do topo.
* Transmissão (de `empresas_transmissao.csv`): concessionárias sob controle, km de circuito, MVA e UFs, sem recálculo.
* Distribuição: distribuidoras ativas do índice cuja cadeia publicada contém H; unidades consumidoras do ano de referência da continuidade.

Reconciliação: nas 7 companhias que são topo de cadeia (Equatorial, Eneva, Copel, AXIA, Energisa, Cemig, Auren), a potência sob controle e a proporcional são iguais às do grupo em `empresas_grupos.csv` (diferença 0,000 MW). Teste em `pipeline/tests/test_energia_listadas.py` e `src/tests/energia-listadas.test.ts`.

Limite: controle compartilhado interrompe a cadeia (as SPEs da Taesa com sócios, a própria Taesa sob Cemig e ISA), e participação minoritária ou indireta não entra.

### 3.3 Controle

Acionistas diretos do FRE mais recente (primeiro nível). Linhas da matriz e da filial do mesmo acionista (mesma raiz de CNPJ, caso da AXIA na ISA Energia: 1,883% + 17,493% do total) são somadas. Pessoas físicas nunca têm nome ou CPF republicados: aparecem somadas, com a contagem e a marca de controlador. Mudanças: entradas, saídas e variações de pelo menos 0,5 ponto percentual no total de ações entre o FRE anterior e o atual.

### 3.4 Bolsa

Em cada pregão t, com o anterior t−1 e data ex = primeiro pregão depois da data com:

* retorno de preço = P_t × m_t ÷ P_{t−1} − 1;
* retorno total = (P_t × m_t + D_t) ÷ P_{t−1} − 1,

com m_t o produto dos multiplicadores dos eventos em ações (desdobramento e bonificação vêm em percentual: 30 = +30%; grupamento vem como multiplicador) e D_t a soma dos proventos brutos por ação antiga. Índices diários em base 1, publicados em `listadas_cotacoes.csv`.

* Troca de código: a série emenda o código anterior quando o FCA da mesma companhia o declara na mesma classe e o último pregão dele é até 10 dias antes do primeiro do novo (ELET3 até 07/11/2025 → AXIA3 desde 10/11/2025; TRPL4 → ISAE4).
* Bonificação em outra classe (AXIA, 19/12/2025: 26,28 ações PNC por 100 ON): valorizada pela quantidade recebida × primeiro fechamento da classe recebida (AXIA7, R$ 48,20 em 22/12/2025), R$ 12,67 por ação ON, natureza ESTIMADO. A B3 registra na mesma data o resgate total de outra classe sem valor na base de proventos; se houve pagamento, ele não entra (nota no papel).
* Evento em ações sem fator publicado: a especificação da COTAHIST marca ex-bonificação (EB, EDB) em datas em que a API de eventos da B3 não lista evento: Cemig em 03/08/2020, 03/05/2021 e 02/05/2022; Alupar em 18/04/2023 e 22/04/2024. Sem o fator, a série antes e depois não é comparável: ela recomeça no último desses pregões e o retorno "desde o fim de 2020" fica sem dado (o retorno desde o início da série é publicado). Controle: nenhuma variação diária do índice de retorno total acima de 20% em nenhum papel.

### 3.5 Movimentos

Fatos relevantes entregues de 16/10/2024 em diante, com o assunto escrito pela companhia e o link do documento na CVM. Nada é resumido nem classificado.

## 4. Símbolos das companhias (`public/energia/logos/`)

Gerados por `python3 -m pipeline.energia.logos_listadas` (manual; os arquivos mudam raramente). Regras: só arquivo publicado pela própria companhia (site de RI ou institucional, inclusive o CDN do provedor do site de RI), sem alteração, servido localmente. Formato estável do manifesto `public/energia/logos/manifesto.json`, também lido pela página de leilões:

```
{"gerado_em", "regras", "logos": [{
  "papel", "nome_exibicao", "cnpj_holding", "grupo_cnpj", "topo_igual_holding",
  "arquivo", "formato", "fundo", "largura", "altura",
  "url_origem", "pagina_origem", "capturado_em", "sha256", "bytes",
  "ausencia"            // null ou {"motivo": texto}
}]}
```

`grupo_cnpj` é o topo da cadeia de controladores únicos em `empresas_cadeia.json` (o mesmo `grupo_cnpj` de `empresas_ativos.csv` e `empresas_grupos.csv`); `topo_igual_holding` diz se a companhia listada é o próprio topo. Para ligar um ativo ao logo, use `cnpj_holding` quando a cadeia do ativo passa pela holding (CPFL, ISA Energia, Engie Brasil e Alupar não são topo). `fundo` diz para que fundo o arquivo foi desenhado ("claro" ou "escuro"); a interface põe uma placa neutra desse tom.

Em 16/10/2026: 11 logos oficiais; Engie Brasil Energia sem logo (ri.engie.com.br respondeu 502 e os arquivos de www.engie.com.br responderam 403 ao agente identificado do observatório), com o nome em texto.

## 5. Limitações

* O IEE é revisto a cada quatro meses; companhias de energia fora do índice não aparecem.
* Ativos de coligadas e de controle compartilhado não entram em nenhuma companhia.
* Proventos brutos, sem imposto e custos; reinvestimento no fechamento da data ex.
* Valor de mercado não é publicado: a B3 (API de emissores) e o FRE divergem na quantidade de ações por classe da AXIA, e a API não separa as classes preferenciais.
* Finanças nominais, consolidado com todos os negócios (Equatorial inclui saneamento).

## 6. Pedidos ao integrador

* Rodar `pipeline/energia/run.py` completo para que o módulo Dados inclua os oito conjuntos novos no catálogo (`catalogo.json`) e o manifesto final.
* O workflow `atualizar-energia.yml` já executa o módulo pela descoberta automática; a COTAHIST do ano corrente é recoletada a cada 3 dias e as cópias anteriores do bronze são apagadas (a vintage fica no silver com o sha256).
