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

## Instituições cobertas no corte

18 companhias listadas do piloto (Itaú, BB, Bradesco, Santander, BTG, ABC,
Banrisul, BMG, Pine, Amazônia, Nordeste, Banestes, Mercantil, BRB, Banese,
BR Partners, Alfa, BMI) + 2 só-rede (Caixa, Safra). Cobertura por bloco no
próprio gold (`cobertura`): empregados e auditoria para as listadas; rede para
os CNPJs com dependências no ESTBAN.
