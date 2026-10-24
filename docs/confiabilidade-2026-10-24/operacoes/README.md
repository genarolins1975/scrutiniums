# Notificações e monitoramento — 24/10/2026

## Evidência e causa

As execuções [resumo 40042804768](https://github.com/genarolins1975/scrutiniums/actions/runs/40042804768) e [alertas 39982207894](https://github.com/genarolins1975/scrutiniums/actions/runs/39982207894) falharam no envio. Os workflows exigem BOLETIM_SECRET com pelo menos 16 caracteres e o mesmo valor no destino. **A causa dessas duas execuções não foi reconfirmada**: o download dos logs foi bloqueado pelo proxy e a integração não tem permissão para listar metadados de secrets (HTTP 403). Ausência histórica do segredo é hipótese, não diagnóstico atual comprovado.

No código, o resumo devolvia HTTP 200 mesmo quando o provedor falhava; faltavam teto de duração e simulação sem efeitos. Os alertas já tinham orçamento de tempo e passam a compartilhar o modo de simulação. A autenticação existente foi preservada.

## Correção

- GET autenticado com `?simular=1` gera assunto/referências e contagem agregada, sem enviar, reservar, purgar ou registrar eventos; não expõe e-mails. GET sem simulação retorna 405. Usar GET evita que um deploy antigo interprete uma simulação como POST real.
- `workflow_dispatch` tem simulação ativada por padrão. Agendamentos conservam a configuração existente. Não foi disparado nenhum workflow de envio.
- Resumo retorna 502 em falha do provedor, libera a reserva e informa pendentes ao atingir o orçamento. Alertas mantêm os limites do curl. O resumo continua respostas confirmadas com pendentes em até oito lotes no mesmo job, com teto de 310 s por chamada; não repete erro HTTP/transporte.
- Um job independente da vigília produz inventário de fontes e execuções, com artefato de 30 dias. Não coleta, publica, altera dados ou envia notificações. Usa somente permissões de leitura.
- O inventário distingue falha de coleta, retenção por validação e fonte comprovadamente sem nova edição. Sem consulta oficial, registra disponibilidade desconhecida. Reutiliza prazos da vigília e dos SLAs da Energia; não inventa prazo universal. Uma retenção Judicial não contamina Pix/SCR/IFdata.

## Testes e reprodução

Preparação: `bash scripts/preparar-sessao.sh`.

```sh
npx vitest run src/tests/notificacoes-operacao.test.ts src/tests/resumo-canal.test.ts src/tests/central-alertas.test.ts
python3 -m unittest pipeline.tests.test_monitorar_atualizacoes -v
python3 scripts/monitorar_atualizacoes.py --consultar-execucoes --saida /tmp/monitoramento
```

[Notificações](notificacoes-testes.txt): 50 testes aprovados em três arquivos, com serviços simulados; nenhum envio real. [Monitoramento](monitoramento-testes.txt): cinco testes aprovados. [Inventário capturado](inventario.json): 373 registros; 3 dentro do prazo existente, 312 retidos e 58 sem diagnóstico suficiente. Essas contagens são de registros/proveniências, não de coleções únicas. “Atual” significa dentro do prazo existente, sem comprovar ausência de edição mais recente.

O inventário cobre proveniências publicadas de Energia, 142 séries SGS, grupos críticos, falhas DJEN e fontes auxiliares DataJud, Pilar 3, reclamações e Trends manual. Metadados ausentes permanecem nulos; geração, captura, commit e produção não são confundidos. A data de produção permanece nula porque não foi homologada. Não é certificação de integridade: testes declarados nos metadados são identificados como tal.

## Dependência externa e instrução ao mantenedor

1. Em GitHub → repositório → Settings → Secrets and variables → Actions, conferir a existência de `BOLETIM_SECRET` sem revelar seu valor.
2. Em Vercel → projeto → Settings → Environment Variables, conferir que a mesma credencial autorizada está configurada no ambiente correspondente. Não enviar credenciais em issue, chat ou log. Se for necessário criar ou rotacionar, isso depende do mantenedor autorizado.
3. Após revisão, autorização de merge e deploy desta alteração, executar manualmente o workflow com **simular=true**. Validar HTTP 200, `simulacao=true` e `enviados=0`. O endpoint atual sem GET retorna 405, sem envio acidental.
4. Só habilitar/testar envio real mediante autorização específica. A suíte aqui não acessou o serviço real nem verificou a correspondência dos segredos.

A publicação de dados permanece independente das notificações. Nenhuma fórmula, base, regra de acesso ou dado publicado foi alterado. Não houve merge nem deploy.

`npm run verificar:rapido` aprovado: lint, tipos, cobertura e 1.452 testes afetados (79 ignorados pelo modo sem build). [Log](rapido.txt). A primeira tentativa falhou porque o clone não tinha a referência origin/main; a referência foi obtida e o comando completo foi repetido.

As falhas de Crédito incluem `falha_registrada_em`: o bloco de coleta retido é de 18/10, não prova de falha ativa em 24/10. A atualidade do diagnóstico é separada da data desta auditoria.

[Relatório executivo da missão e limites de homologação](RELATORIO.md). [Suíte completa da integração inicial](integracao-completo.txt): aprovada, com 9.515 testes Vitest e 224 verificações do Judiciário.

## Achados da revisão automática corrigidos

- [Continuação do lote semanal](https://github.com/genarolins1975/scrutiniums/pull/378#discussion_r4366723021): HTTP 202 identifica pendências; `scripts/disparar_resumo.py`, chamado pelo workflow, continua apenas lotes confirmados na mesma janela diária. As reservas e regras de periodicidade permanecem na rota existente. O job comporta até oito chamadas de 310 s e a espera de deploy (60 min). Falha do provedor/transporte não é repetida; limite ou virada do dia com pendências retorna erro, nunca sucesso silencioso. Não garante entrega em caso de falha externa ou de fila acima desse teto: esses casos exigem intervenção explícita.
- [Prazo Judicial](https://github.com/genarolins1975/scrutiniums/pull/378#discussion_r4366723022): `judicial` usa a chave `datajud` tanto na referência quanto no prazo, reutilizando os 75 dias já definidos. O inventário foi regenerado.

`python -m unittest pipeline.tests.test_disparar_resumo pipeline.tests.test_monitorar_atualizacoes -v`: 13 testes aprovados, sem rede/credenciais reais ([log](revisao-python.txt)). Os oito casos de lotes incluem segunda-feira com duas chamadas, simulação, falha do provedor, timeout, limite, virada do dia, protocolo inválido e ocultação de conteúdo de erro que possa conter credenciais. Vitest focado: 50 testes aprovados; verificador rápido: aprovado. Nenhum workflow real foi disparado.
