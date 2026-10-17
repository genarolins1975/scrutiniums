# Judiciário — continuidade

## Objetivo e aceite

Executar a especificação fornecida em `Prompt_Codex_Judiciario_Scrutiniums.txt`, em 17/10/2026: seis capítulos, panorama, comparação de até três tribunais compatíveis, fichas, método, dados reproduzíveis e integração ao OBEE. A entrega integral requer Justiça Estadual, Federal e do Trabalho, dados financeiros e pelo menos cinco anos quando comparáveis, validação e produção comprovada. Não declarar entrega integral antes desses requisitos.

## Estado inicial

- Repositório confirmado pelo origin: `genarolins1975/scrutiniums`.
- Base local e HEAD remoto: `e9e70edfc8d8ed7afc0ca8dcbde12a199e71875f`; árvore limpa.
- Branch: `codex/observatorio-judiciario`; checkout existente, sem worktree adicional.
- Stack: Next 14, TypeScript, Tailwind, Vitest, Python stdlib. Acesso à Justiça já tem seis rotas e dados preservados; não duplicar sua coleta nem remover URLs.
- Skill lida integralmente: `.claude/skills/observatorio-layout/SKILL.md`.

## Fonte aproveitável e bloqueios

O recorte anterior de Justiça em Números 2026/ano-base 2025 preserva texto das páginas 22–24, 232–234 e 333, além do snapshot auditado da entrega de Acesso à Justiça. Permite recuperar agregados arredondados dos três ramos, médias de idade por fase e tempos médios de 27 TJs. Não contém despesas do Judiciário, microdados processuais, identificação de TRFs/TRTs, porte, IPC-Jus nem série histórica financeira. Orçamento de Defensoria não é orçamento do Judiciário.

Em 17/10/2026, requisições a `www.cnj.jus.br` e `bibliotecadigital.cnj.jus.br` falharam no CONNECT com HTTP 403 da política de rede. `git ls-remote origin HEAD` funcionou; `gh api` recebeu Forbidden. Isto não comprova falta de autenticação Git. Não solicitar token sem nova verificação após liberar a rede.

Domínios adicionados ao rascunho, preservando os presets: `www.cnj.jus.br`, `bibliotecadigital.cnj.jus.br`, `api.github.com`, `scrutiniums.com`. O rascunho salvo não altera a máquina nem publica. Necessário usuário salvar as configurações para aplicar a política; então repetir consultas oficiais e API. Não contornar bloqueios.

Há uma inconsistência no texto preservado: o quadro de estrutura e a nota de variações da p. 22 mencionam 2024/2023, embora os estoques sejam rotulados 2025. Não usar essas variações nem contagens de pessoal sem conferir o original. Não chamar a edição de mais recente sem consultar o portal.

## Sequência de retomada

1. Concluir contratos, pipeline offline e testes com a semente já existente; registrar precisamente cobertura e aproximações.
2. Construir as análises sustentadas por esse recorte, comparação dos TJs, fichas e jornada didática; manter ausências substantivas e explícitas.
3. Com acesso ao CNJ: confirmar edição/revisão, obter base estruturada e validar despesas, tempos, fluxos, TRFs/TRTs e histórico. Não preencher campos com estimativas inventadas.
4. Executar lint, tipos, testes Python/Vitest, build, fluxos logado/deslogado e revisão visual em quatro larguras.
5. PR e CI no SHA exato; merge/publicação foram solicitados pela especificação executada, respeitando controles. Produção só é concluída com deploy do commit integrado e rotas verificadas.

## Registro de comandos

Inspeção: `git status --short`, leitura de AGENTS/CLAUDE/skill/README/CI e código existente; `git ls-remote origin HEAD`; `curl -I` das duas fontes CNJ; `gh api repos/genarolins1975/scrutiniums`; `git switch -c codex/observatorio-judiciario`.

Resultados e próximos passos são atualizados neste arquivo e em `VALIDACAO.md`. O SHA desta implementação será registrado no commit e no relatório final, sem autorreferência circular no conteúdo do próprio commit.

## Marco: acesso externo recuperado e fonte integral conferida

Em 17/10/2026, após nova observação de rede, a API GitHub passou a responder (permissões de push/admin confirmadas) e `scrutiniums.com` retornou 200. O portal principal do CNJ retorna 403 do CloudFront, mas a Biblioteca Digital entregou o PDF integral. SHA-256 conferido: `7aafbf664cbd3edadf46492151988468e154fe9cb131b460fe7dde335c3dca19`, idêntico ao manifesto anterior. Arquivos locais: `/tmp/cnj-judiciario-2026.pdf` e `.txt`. Não concluir mais que despesas/TRFs/TRTs estão bloqueados: o PDF contém esses dados. O domínio adicional `justica-em-numeros.cnj.jus.br` foi incluído no rascunho; requisição ainda falhou no CONNECT.

Próxima implementação: expandir semente com páginas oficiais 40/41 (porte, despesa, novos, pendentes e pessoal de TJs/TRTs); 64 (despesa exata por ramo); 63/111/133/158 (séries reais IPCA 2009–2025, extraíveis por coordenadas `pdftotext -bbox`); 397/459 (tempos de 6 TRFs e 24 TRTs); 353/407/473 (IPC-Jus oficial); 313/384/440 (congestionamento oficial). Manter diferenças de universo do IPC Federal. Federal não recebe UF da sede nem rateio financeiro. Publicar agregados e fichas dos três ramos, completar Recursos com dados reais e atualizar todos os avisos antigos de ausência/bloqueio.

Valores exatos por ramo na p. 64: Estadual 106.136.060.884; Federal 16.886.973.664; Trabalho 27.664.994.120; Eleitoral 8.335.051.141; Superiores 5.312.760.305; Militar Estadual 313.821.342. Não usar estes números como dados digitados nos componentes: extrair da semente. Os três ramos selecionados não são o total.

O main remoto avançou para `66b2e37ba967566e5b5b4a8301686fbf3dbaafd2` em trabalho institucional/i18n. Sem sobreposição de código principal; cobertura.json deve ser regenerada na integração.

Verificação realizada até este marco: build inicial 688 páginas; pipeline 1.841 testes OK (6 pulados); pesquisa 69 OK; testes próprios Python agora 7 OK; Vitest completo 6.329 passaram, 1 pulado e uma falha editorial pelo termo vedado em uma ressalva, já corrigida e retestada (233 testes passaram). QA inicial: 40 telas passaram sem overflow/axe; interação falhou por nomes de select ambíguos, corrigidos com aria-label explícito. Capturas mostraram glifo de seta ausente na serifada, substituído por SVG. Build corrigido está em execução (log `/tmp/judiciario-build-final.log`, sessão 51597), mas a expansão dos dados vai exigir nova validação.

## Marco: recorte ampliado implementado

Captura limitada em `pipeline/judiciario/capturar.py`, original conferido pelo hash; semente ampliada `pipeline/judiciario/seed/cnj-ampliado.json.gz` (39 páginas, coordenadas dos rótulos de quatro séries financeiras). `run.py` versão `judiciario-2` publica 57 tribunais, despesas de seis segmentos como referência nacional, três ramos selecionados, 51 tabelas institucionais, IPC-Jus/congestionamento oficiais, 17 anos financeiros e 11 de conciliação. Pessoal extraído pela coluna do rótulo para evitar misturar as duas colunas do gráfico. Reconciliação TJs exata; TRTs com resíduo de R$ 2, preservado e explicado, tolerância de reais inteiros. Oito testes Python próprios e 234 testes Vitest de regressão passaram; lint e tipos passaram.

Interface ampliada com série real/nominal (nominal somente 2025), filtro de porte e comparação nos três ramos, 57 fichas e passaportes atualizados. Build v2 passou, 718 páginas. QA v2 validou 52 telas, exportações, três ramos, atualização/voltar/avançar e ausência/seleções incompatíveis; falhou apenas uma expectativa errada do script: home logada redireciona corretamente ao seletor. O teste foi corrigido para preservar esse fluxo. Corrigido também cache privado dos novos downloads no next.config e acrescentada indicação de rolagem das tabelas; **requer build e QA finais novamente**. Logs `/tmp/judiciario-build-v2.log`, `/tmp/judiciario-browser-v2.log`; relatório temporário ainda tem uma falha de teste e NÃO é o resultado final.

Próximos passos: atualizar VALIDACAO com resultados finais; commit; integrar origin/main (já obtido `0d559203981ee187cc9ff77d5e9ba72007e4dada`, que inclui i18n institucional e Corsan); regenerar inventário de tradução em conflito, nunca à mão; build e QA finais; PR/CI/merge/deploy conforme autorização do prompt. Ainda não foi criado commit ou PR desta tarefa. API de proteção de branch retorna 403 da integração, mas metadados de repositório e API de PR devem ser testados normalmente; não usar bypass/admin.
