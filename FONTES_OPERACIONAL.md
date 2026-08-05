# FONTES_OPERACIONAL.md — registro de fontes dos indicadores operacionais (Fase 0)

Verificação empírica das três fontes: 05/08/2026 (downloads reais, estruturas
conferidas coluna a coluna). Classificação de confiabilidade: **A** dado
administrativo oficial (mesma escala dos painéis de bets e fraudes).

## 1. CVM — Formulário de Referência (FRE), dados abertos

- URL do dataset: https://dados.cvm.gov.br/dataset/cia_aberta-doc-fre
- Arquivos: `fre_cia_aberta_{ano}.zip` (≈8,5 MB/ano); tabela usada:
  `fre_cia_aberta_empregado_posicao_local_{ano}.csv` (item 10.1 — empregados por
  posição Liderança/Não-liderança e por região Norte/Nordeste/Centro-Oeste/
  Sudeste/Sul/Exterior)
- Primeiro ano com a tabela: **2023** (Resolução CVM 59)
- Frequência: anual, com retificações ao longo do ano (campo `Versao`; fica a maior)
- População: companhias abertas registradas na CVM — dos 18 bancos do piloto,
  todos entregam FRE; Caixa e Safra (não listados) ficam fora desta fonte
- Limitações: escopo declarado pela companhia (pode ser holding, banco ou
  consolidado — difere entre companhias e do conglomerado prudencial do IF.data);
  data de referência conforme informada pela CVM · Confiabilidade: **A**

## 2. CVM — Formulário Cadastral (FCA), dados abertos

- URL do dataset: https://dados.cvm.gov.br/dataset/cia_aberta-doc-fca
- Arquivos: `fca_cia_aberta_{ano}.zip` (≈0,4 MB/ano); tabela usada:
  `fca_cia_aberta_auditor_{ano}.csv` (auditor independente, CNPJ, datas de início
  e fim de atuação)
- Anos coletados: 2021 em diante · Frequência: anual com retificações
- Uso: auditor vigente (sem data de fim) + histórico de trocas de auditor
- Confiabilidade: **A**

## 3. BCB — ESTBAN, Estatística Bancária Mensal por município

- URL: https://www.bcb.gov.br/estatisticas/estatisticabancariamunicipios
- Lista de arquivos via API do próprio site (mesma infraestrutura do painel de
  penetração, `pipeline/sources/estban.py`); arquivos mensais ≈0,9 MB
- Colunas usadas: `CNPJ` (raiz de 8 dígitos do banco), `NOME_INSTITUICAO`,
  `AGEN_PROCESSADAS`, `CODMUN`
- Cobertura no corte: 38 data-bases (2023-02 a 2026-03), ~110 bancos com agência
- Defasagem: ~3 meses (padrão da fonte)
- Limitações: agências processadas ≠ postos de atendimento ≠ correspondentes;
  o CNPJ é do banco operacional, não da holding; migrações societárias produzem
  saltos reais na série de um CNPJ (flag automática acima de 15% em 12 meses)
- Confiabilidade: **A**

## 4. CVM — IPE (Informações Periódicas e Eventuais) — Fase 2

- URL do dataset: https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS/
  (`ipe_cia_aberta_{ano}.zip`, ≈1,4 MB/ano; PDFs baixados de rad.cvm.gov.br)
- Uso: descoberta **estruturada** dos releases de resultados dos bancos S1/S2
  listados (Itaú "Análise Gerencial da Operação", BB "Análise do Desempenho" e
  "BB Notícias", Bradesco "Relatório de Análise Econômica e Financeira" e
  "Press Release", Santander "Release de Resultados", BTG "Earnings Release",
  Banrisul e BNB "Apresentação de Resultados")
- Regras de seleção explícitas por banco em `pipeline/sources/releases.py`;
  reentrega substitui a versão anterior (rastreado em `substituido_por`)
- Conteúdo extraído: contagens de clientes, com página e trecho literal como
  evidência obrigatória e **revisão humana antes de publicar**
  (ver METODOLOGIA_OPERACIONAL.md, Fase 2)
- Limitações: número **reportado pela companhia**, no conceito dela —
  comparabilidade C (nunca entre bancos, nunca em ranking); cobertura desigual
  por desenho (quem não divulga aparece como ausência com motivo)
- Confiabilidade do protocolo: **A** (registro administrativo da CVM); o valor
  divulgado é `reportado` pela companhia

## 5. Fontes fora da CVM — Fase 2 (Caixa, Nubank e Inter)

- **SEC/EDGAR** (Nubank — Nu Holdings, CIK 1691493; Inter & Co, CIK 1864163):
  arquivos 6-K com os earnings releases, baixados do domínio da própria SEC
  (www.sec.gov). A descoberta de 6-K novos é automática (índice EDGAR por CIK,
  registrada como AVISO em `rel_ext_avisos` para a sessão de curadoria — um
  6-K pode ser qualquer coisa, então nada é baixado às cegas) · **A**
  (registro administrativo da SEC); valor `reportado` pela companhia
- **RI da Caixa** (não listada; plataforma MZ, api.mziq.com): Relatório de
  Análise de Desempenho trimestral, com URL verificada e registrada no
  cadastro explícito de `pipeline/sources/releases_ext.py` — sem crawler;
  documento novo entra no cadastro a cada temporada · valor `reportado`
- Limitações: mesmos conceitos próprios por companhia (comparabilidade C);
  o Nubank divulga piso ("mais de 115 milhões no Brasil"), não contagem exata

## Instituições cobertas no corte

18 companhias listadas do piloto (Itaú, BB, Bradesco, Santander, BTG, ABC,
Banrisul, BMG, Pine, Amazônia, Nordeste, Banestes, Mercantil, BRB, Banese,
BR Partners, Alfa, BMI) + 2 só-rede (Caixa, Safra). Cobertura por bloco no
próprio gold (`cobertura`): empregados e auditoria para as listadas; rede para
os CNPJs com dependências no ESTBAN.
