# Atualização e recuperação

## Reproduzir a edição aceita, sem rede

```sh
python3 -m pipeline.agro.run --check
python3 -m pipeline.agro.dicionario --check
node scripts/agro/catalogo.mjs --check
python3 -m unittest pipeline.tests.test_agro
```

Para regenerar, retire `--check` dos três primeiros comandos, nessa ordem. O catálogo usa Vite já instalado, sem nova dependência. `manifesto.json` fixa hashes de snapshot, dicionário e CSVs gerados em Python; o catálogo separado confere pelo gerador Node. A geometria é a malha oficial de UFs já preservada no módulo de Energia, fixada também no manifesto de fontes. Nunca desenhar substituto aproximado.

As sete fontes congeladas estão em `pipeline/agro/seed`, gzip determinístico `mtime=0`, com hash do original, hash comprimido e último commit que alterou o original. Data de preservação não é coleta nova. A reprodução não atualiza automaticamente os calendários, licenças ou contratos; essa conferência faz parte da revisão de edição.

## Coleta oficial da economia (automática)

```sh
python3 -m pipeline.agro.economia --coleta
python3 -m pipeline.agro.run
python3 -m pipeline.agro.dicionario
python3 -m unittest pipeline.tests.test_agro
```

A coleta consulta o IBGE (SIDRA 1846, 5932, 6588, 6754, 6884, 6898, 5434, 5442, 1419, 7060, 5457, 3939, 74, 291, 1092, 1093 e 1094, pela API v3), o Comex Stat, o BCB (microdados do Sicor dos dois últimos anos e SGS 4189), o Tesouro Transparente (pagamentos de subvenções), o INPE (PRODES no TerraBrasilis), o SEEG (API GraphQL) e o MapBiomas (planilha de estatísticas), normaliza e valida tudo antes de gravar. Cada fonte vira uma semente em `pipeline/agro/seed` com a consulta e a resposta integral (ou, nos arquivos grandes, o recorte agregado com sha256 e tamanho do original) e a data de captura em `coletas.json`. Módulos: `economia.py` (fase 1 e gravação), `sociedade.py`, `apoio.py`, `ambiente.py` e `producao.py` (PAM 5457, PPM 3939 e 74, PEVS 291, Abate 1092 a 1094, por estado, e Comex Stat por posição SH das doze cadeias). Resposta idêntica à integrada mantém o manifesto e não gera commit. O Comex Stat limita a frequência (11 segundos entre consultas); os microdados do Sicor somam cerca de 90 MB e a planilha do MapBiomas, 18 MB. A coleta completa leva de cinco a dez minutos.

Validações que bloqueiam a publicação: setores que não somam o valor adicionado, trimestres não consecutivos, taxas e valores terminando em trimestres diferentes, produto do LSPA sem estimativa do último mês, ano ou mês ausente no Comex Stat, acumulado do ano diferente da soma dos meses, país ou linha duplicada.

O workflow `atualizar-agro.yml` roda nos dias 9 e 24 de cada mês, publica no `main` só com os testes verdes e retém a publicação reprovada. Pode ser disparado manualmente, inclusive sem coleta para só reconstruir a gold.

## Preparar atualização das fontes preservadas

Depois que uma nova fonte de origem for conferida e versionada pelo seu módulo responsável:

```sh
python3 -m pipeline.agro.preservar --destino /tmp/agro-candidato --data AAAA-MM-DD
```

O helper rejeita destino existente e original diferente do commit declarado, valida as sete fontes, reconcilia os agregados e calcula as cinco saídas antes de disponibilizar o candidato. Não modifica seed nem gold aceitos. Revise diferenças, períodos, unidades, licenças, cobertura e compatibilidade; só então substitua o seed em branch de atualização e regenere os derivados. Fonte incompleta ou falha de validação preserva a última edição aceita. A gravação do gerador é atômica **por arquivo**, não uma transação de vários arquivos; a publicação conjunta ocorre pelo commit/deploy.

## Produção oficial por estado

A produção por estado das doze cadeias entra pela coleta automática (`producao.py`), com as mesmas regras das demais fontes: ano ausente, trimestre fora de sequência, soma dos estados acima do total nacional e destinos que não somam a exportação da cadeia bloqueiam a publicação; dado sigiloso fica sem valor. O capturador antigo de candidatos (`python3 -m pipeline.agro.capturar`) continua disponível para auditoria de metadados, mas não alimenta a gold.

Continuam fora: calendário de plantio e colheita da Conab, produção municipal, custos Conab, proteção, ambiente territorial e FAOSTAT.
