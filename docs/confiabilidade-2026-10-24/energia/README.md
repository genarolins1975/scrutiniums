# Energia: retenção coerente e diagnóstico por produto

## Estado reconfirmado em 24/10/2026

O [PR 363](https://github.com/genarolins1975/scrutiniums/pull/363) foi integrado em 23/10 às 08:07 UTC. A [execução posterior 40051919220](https://github.com/genarolins1975/scrutiniums/actions/runs/40051919220), em 24/10, passou pela preparação/coleta, mas reteve a publicação por testes. [Detalhamento atual na issue 297](https://github.com/genarolins1975/scrutiniums/issues/297#issuecomment-6379519867).

As sete golds principais da main continuam geradas em 30/09: PLD, hidrologia, carga, geração, rede, CMO e síntese. A data de 23/10 citada pelo alerta vinha do manifesto, não desses produtos. A [issue 295](https://github.com/genarolins1975/scrutiniums/issues/295) continua pertinente.

## Defeitos corrigidos com reprodução

1. O loop dos seis builders de operação restaurava a gold após falha de construção ou de horizonte, mas não restaurava os CSVs já sobrescritos. A reprodução em `antes.txt` conserva o valor 1 na gold e deixa 999 no download. Agora guarda/restaura os bytes de cada exportação junto da gold, inclusive removendo downloads de uma primeira candidata rejeitada. Módulos temáticos já tinham proteção própria, preservada.
2. O alerta passa a ler `gerado_em` de cada um dos sete produtos; não atribui a data do manifesto ao dado nem presume disponibilidade em produção.
3. A meta da execução passa a conservar também o resultado da coleta principal ONS/CCEE/seed; anteriormente esse diagnóstico era montado em memória mas omitido da saída. O campo existente dos módulos permanece compatível.

Nenhuma fórmula, arredondamento, fonte ou vintage foi alterado. O silver, bronze e a gold anterior permanecem preservados.

## Testes

`python -m unittest pipeline.tests.test_energia_retencao_operacao pipeline.tests.test_energia_meta`: 22 testes aprovados; casos de seis produtos, versão anterior presente/ausente, rejeição e instalação válida, além da suíte de histórico e metadados. `testes.txt` registra a execução. O teste de metadados contém uma retenção sintética esperada e não deve ser confundido com coleta viva.

## Pendências externas e limites

O artefato `energia-retida` (65.889.941 bytes) existe e não expirou. O proxy local bloqueou o download em `productionresultssa12.blob.core.windows.net` e os logs em `results-receiver.actions.githubusercontent.com`. Ambos foram adicionados ao rascunho de rede; a configuração precisa ser publicada. Sem os bytes da candidata e o estado durável, não é correto ajustar os testes com base apenas na mensagem de erro.

Continuam por reproduzir: regressão do builder Empresas; aliases de distribuidoras; limite editorial de palavras; conciliação RALIE/SIGA; quantidade de tarifas; veredito de PLD; previsão hídrica e coordenadas/usinas da malha. Não se atribui cada uma a defeito de teste ou de fonte sem a reprodução.

Este PR resolve os defeitos demonstrados de retenção e diagnóstico. **A atualização diária não está normalizada nem a gold nova homologada.** Não houve publicação, alteração de dados ou execução de workflow que escreva na main.
