# Fontes auxiliares: evidência e limites

Auditoria de 24/10/2026 sobre main `7d4c2ee77282c0d6c22fd3902869b9d2ac82cd7f`. O bloco `fontes_status` preservado em `public/obs/data/gold/meta.json` corresponde a 18/10; não deve ser apresentado como prova de que todas as falhas persistem hoje. A execução de 23/10 retém grupos e publica outros independentemente.

| Fonte | Evidência registrada | Diagnóstico sob controle do projeto | Limitação / próxima providência |
|---|---|---|---|
| SGS | 142 respostas não decodificadas como JSON | Validação antes de escrita, troca integral, janelas históricas e tentativas limitadas | Consultar a resposta oficial real após liberação da rede; não atribuir o erro de parsing automaticamente a indisponibilidade do BCB |
| Desenrola | XML/HTML no endereço CSV | CSV inteiro validado e versão anterior/histórico preservados | Confirmar recurso oficial e conteúdo atual; não contornar desafio do portal |
| DJEN e credores | Oito tribunais com HTTP 403 em cada coletor | Retenção por tribunal, validação de esquema/paginação | O diagnóstico antigo de bloqueio geográfico não foi reconfirmado; requer acesso autorizado, sem troca nominal por DataJud |
| DataJud | Oito chaves aprovadas, 16 adiadas pelo orçamento de 900 segundos | Fila fixa reproduzida: a segunda rodada repetia TJSP e não atendia TJRJ. Nova fila persistente prioriza quem foi pulado, inclusive após timeout. Funil recebe uma parte do orçamento existente. Página incompleta/esquema ausente não sobrescrevem a série com zeros | Validar rodada real e cobertura por tribunal. Ordenação não altera classes, fórmulas, calendário ou critérios de deduplicação |
| Judicial / TST | Dois subcoletores aprovados e ranking TST com HTTP 202/desafio WAF | O erro é mantido como ausência de coleta, sem inventar ausência de processos | Confirmar canal oficial acessível/autorizado; DataJud não contém identificação das partes para substituir ranking nominal |
| Reclamações consignado | Dez competências aprovadas; setembro com HTTP 503 | Coleta por competência conserva anteriores; a infraestrutura HTTP compartilhada repete somente falhas transitórias com limite | Reconfirmar disponibilidade do arquivo de setembro no consumidor.gov.br; 503 histórico não prova falha permanente |
| Pilar 3 | Onze resultados aprovados; 31 falhas por instituição: 400/403/404/503/520, DNS, TLS, JSON inválido ou trimestre vazio | Coletor já isola instituição e rejeita trimestre fora do contrato; não foi feito mapeamento de esquema sem payload oficial | Reconsultar cadastro DASFN e endpoints registrados. Não desativar validação TLS nem presumir valor zero ou trocar URLs por aproximação |
| Trends manual | Planilha `data/manual/Google_Trends_Temperatura_Credito.xlsx` ausente | Ausência explicitamente registrada, sem geração de série artificial | Arquivo/manual autorizado depende do mantenedor; não criar substituto metodológico |

A disponibilidade atual das fontes e o formato oficial dos casos auxiliares não foram confirmados nesta rede. Permanecem dependências de captura/autorizações, não correções declaradas como concluídas.
