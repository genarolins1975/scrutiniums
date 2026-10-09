# Aceite independente da distribuição compactada

**Aprovado no ambiente local.** A compactação muda a forma de transportar o snapshot; não altera os dados, o layout nem o aceite das 15 telas, cujas notas permanecem 9,1–9,3.

## Identidade dos dados

| Verificação | Resultado |
|---|---|
| Payload base64 |383.266 bytes |
| Gzip |283.716 bytes; mtime 0 |
| JSON reconstruído |6.593.631 bytes |
| Observações |29.972 |
| Indicadores |20 |
| Comparação com o snapshot aprovado |Bytes idênticos |
| Metadados finais da variação do estoque |Nome, universo e limitação preservados |

SHA-256 do JSON aprovado, do payload decodificado e da resposta HTTP da produção local:

`1e20187e13c89939b3b79254eedae8d619dcdfd18dc0e7e9b8696cad28ac979a`

## Reprodução e falhas

O decoder valida base64, descompacta gzip, confere SHA e contrato antes da escrita. A substituição usa arquivo temporário e rename; o segundo processamento foi idempotente, sem reescrita ou temporário residual.

Em cópias isoladas, foram executados cinco casos: fonte válida com JSON legado desatualizado; base64 inválido; gzip inválido; hash incompatível; payload ausente. O primeiro produziu exatamente os bytes aprovados. Todos os demais encerraram com erro, mantendo o legado sem aceitá-lo como fonte. Não há fallback silencioso para o JSON versionado.

O materializador é importado antes da minificação usada em prebuild/predev. Pretest o chama diretamente; vitest.config.ts também o importa primeiro, cobrindo invocação direta e test:watch. Executei Vitest diretamente: o log do SHA apareceu antes de RUN, e os 6 testes de dados passaram.

A resposta efetivamente recebida de `http://127.0.0.1:3021/eficiencia/trabalho-renda/snapshot.json` contém os 6.593.631 bytes aprovados e o mesmo SHA. A prova não depende de olhar o arquivo legado na branch.

## Limite do aceite

Este aceite atesta a origem, a materialização, os hooks e a resposta local. O publicador deve conferir o mesmo hash no GitHub/Vercel após enviar payload, decoder, configuração e documentação. Não atesta implantação externa nem amplia o escopo da agenda de 12 dimensões.

Detalhes reproduzíveis: DISTRIBUICAO_INDEPENDENTE.json e distribuicao-hook-vitest.log.
