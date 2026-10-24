# Energia: retenção coerente e diagnóstico por produto

## Estado reconfirmado em 24/10/2026

O [PR 363](https://github.com/genarolins1975/scrutiniums/pull/363) foi integrado em 23/10 às 08:07 UTC. A [execução posterior 40051919220](https://github.com/genarolins1975/scrutiniums/actions/runs/40051919220), em 24/10, passou pela preparação/coleta, mas reteve a publicação por testes. [Detalhamento atual na issue 297](https://github.com/genarolins1975/scrutiniums/issues/297#issuecomment-6379519867).

A meta principal registra 30/09, mas a conferência dos arquivos mostra PLD, hidrologia e rede gerados em 30/09; carga, geração, CMO e síntese em 01/10. Nenhum dos sete tem geração posterior a 01/10. A data de 23/10 citada pelo alerta vinha do manifesto, não desses produtos. A [issue 295](https://github.com/genarolins1975/scrutiniums/issues/295) continua pertinente.

## Defeitos corrigidos com reprodução

1. O loop dos seis builders de operação restaurava a gold após falha de construção ou de horizonte, mas não restaurava os CSVs já sobrescritos. A reprodução em `antes.txt` conserva o valor 1 na gold e deixa 999 no download. Agora guarda/restaura os bytes de cada exportação junto da gold, inclusive removendo downloads de uma primeira candidata rejeitada. Módulos temáticos já tinham proteção própria, preservada.
2. O alerta passa a ler `gerado_em` de cada um dos sete produtos; não atribui a data do manifesto ao dado nem presume disponibilidade em produção.
3. A meta da execução passa a conservar também o resultado da coleta principal ONS/CCEE/seed; anteriormente esse diagnóstico era montado em memória mas omitido da saída. O campo existente dos módulos permanece compatível.

Nenhuma fórmula, arredondamento, fonte ou vintage foi alterado. O silver, bronze e a gold anterior permanecem preservados.

## Testes

`python -m unittest pipeline.tests.test_energia_retencao_operacao pipeline.tests.test_energia_meta`: 22 testes aprovados; casos de seis produtos, versão anterior presente/ausente, rejeição e instalação válida, além da suíte de histórico e metadados. `testes.txt` registra a execução. O teste de metadados contém uma retenção sintética esperada e não deve ser confundido com coleta viva.

## Candidata retida: reprodução e causa de cada falha (24/10/2026)

O bloqueio de rede da primeira auditoria deixou de valer. O artefato `energia-retida` da [execução 40051919220](https://github.com/genarolins1975/scrutiniums/actions/runs/40051919220) (commit `9a12b64b`, gold gerada em 24/10/2026 03:39 UTC) foi baixado e a gold retida aplicada sobre aquele commit, num diretório isolado. As **9 falhas** do CI foram reproduzidas localmente, idênticas: 6 no Vitest e 3 no Python ([Vitest](candidata-falhas-vitest.txt), [Python](candidata-falhas-python.txt)). O código de energia não mudou entre esse commit e a main atual. Fontes consultadas às 10:34 a 10:45 UTC; hashes em [homologacao-sha256.txt](homologacao-sha256.txt).

| # | Falha | Causa demonstrada | Natureza | Encaminhamento |
|---|---|---|---|---|
| 1 | Empresas retida: 24.935 usinas com proprietários fora do formato | O SIGA diário da ANEEL gerado em 23/10/2026 deixou de trazer o CNPJ no campo `DscPropriRegimePariticipacao`: 0 de 25.058 linhas com CNPJ (ex.: `100% para ANGLOGOLD ASHANTI CORREGO DO SITIO MINERACAO S.A. (APE)`). O mesmo campo no XML diário também vem sem CNPJ. O SIGA mensal gerado em 01/10/2026 ainda traz CNPJ em 24.799 de 25.045 linhas | Mudança de contrato da fonte; a validação reteve corretamente | Decisão do dono (abaixo) |
| 2 | `energia-gold-contrato`: meta registra regressão | Consequência de 1 | Correta | Some com 1 |
| 3 | `energia-inicial`: página diz 81, gold da conta diz 99 com tarifa em vigor | O seletor lê `empresas.json` (retida, de 30/09) e a frase confere com `conta.json` (nova, de 24/10): mistura de vintages produzida pela retenção de 1 | Consequência de 1 | Some com 1 |
| 4 | T2 RALIE contra SIGA: 2.156 contra 2.218 | `empresas_ativos.csv` retido (SIGA de 30/09) cruzado com `expansao_carteira_ralie.csv` novo (SIGA de 23/10) | Consequência de 1 | Some quando as duas golds usarem a mesma vintage do SIGA |
| 5 | Busca: 4 apelidos sem distribuidora na lista | Lista vem das tarifas vigentes. No arquivo da ANEEL gerado em 24/10/2026: EDP SP, Equatorial GO e CPFL Piratininga seguem sem a tarifa nova (vigência encerrada em 21 e 22/10); Neoenergia Brasília já tem a REH 3.614/2026, vigente desde 22/10; Roraima trocou a sigla de `ÂMBAR ENERGIA RR` para `Âmbar Roraima` | Dado real; teste não prevê lacuna de vigência nem troca de sigla | Decisão do dono (abaixo) |
| 6 | PLD: frase de distância semanal | Os quatro submercados tiveram a mesma média de PLD na semana (R$ 70,63/MWh). O código já tem frase própria para esse caso; o laço do teste sobre o dado real presumia valores diferentes | Defeito do teste | **Corrigido neste commit**: com os quatro iguais, o teste exige a frase própria. Aprovado sobre a gold da main e sobre a candidata (102 testes) |
| 7 | Veredito de abertura com 44 palavras (limite 40) | `vereditoPerfil` tem um ramo para hora de pico diferente entre curva de carga e carga líquida de MMGD, exercido agora pela primeira vez por dado real (18h a 19h contra 19h a 20h em 2026) | Defeito de texto, latente | Redação a decidir pelo dono (abaixo) |
| 8 | Previsão de chuva com valor negativo (Uruguai, 27/10, 0,1 mm negativo) | A API de rodadas do Open-Meteo devolve `precipitation_sum` de 0,2 mm negativo para a rodada ECMWF IFS de 23/10/2026 00Z em 11 de 40 pontos de uma grade de 1 grau sobre a região da bacia (26 a 30 graus sul, 49 a 56 graus oeste), no mesmo dia 27/10 | Artefato numérico da fonte; a validação reteve corretamente | Decisão do dono (abaixo) |
| 9 | Território: 1.385 contra 1.379 coordenadas fora da malha simplificada; Belo Horizonte com 32 usinas, teste espera 31 | Os dois testes fixam contagens do SIGA de 30/09. A gold nova dá a Belo Horizonte 32 usinas e 37,765 MW; a releitura independente do SIGA de 23/10 dá o mesmo (32 e 37,765). A contagem de coordenadas não foi recontada à parte | Teste fixado na vintage anterior | Refixar com recontagem independente na vintage que for publicada, depois de 1 |

**Inferência.** A retenção funcionou como devia: nenhuma das nove falhas é um defeito de publicação. Cinco delas (1 a 4 e 9) dependem da mesma decisão sobre o SIGA. A remoção do CNPJ pode ser deliberada (o campo também reúne pessoas físicas) ou passageira; não há comunicado acessado que diga qual.

**Decisões pendentes do dono**

1. SIGA sem CNPJ: (a) manter Empresas retida até a ANEEL esclarecer, com consulta formal à ANEEL; (b) usar o SIGA mensal de 01/10 para o vínculo societário enquanto ele trouxer CNPJ, com as duas golds na mesma vintage; ou (c) vincular por nome, que é mudança de método e não é recomendada. Recomendação: (a) com consulta à ANEEL, e (b) se a resposta demorar.
2. Busca: manter na lista as distribuidoras com tarifa encerrada há poucos dias (o `resumo.fora_vigencia_recente` da gold já conta 4) ou aceitar que saiam até a REH nova; e atualizar o apelido de Roraima para a sigla nova.
3. Chuva prevista negativa: tratar como 0 com contagem declarada na proveniência, ou como valor ausente. Recomendação: 0 com contagem declarada, porque o valor é ruído de acumulação do modelo, não chuva.
4. Redação do ramo de `vereditoPerfil` para caber em 40 palavras.

## Pendências externas e limites

Na primeira auditoria o proxy bloqueou o artefato `energia-retida` (65.889.941 bytes) e os logs; nesta sessão os dois foram lidos e as falhas estão reproduzidas e classificadas na seção anterior.

Este PR resolve os defeitos demonstrados de retenção e diagnóstico. **A atualização diária não está normalizada nem a gold nova homologada.** Não houve publicação, alteração de dados ou execução de workflow que escreva na main.

`npm run verificar:rapido` aprovado ([log](rapido.txt)).
