# Abertura da área logada — 25/10/2026

## Resultado e escopo

Revisão da implementação existente em `claude/ecstatic-cerf-mfvl4a`, seguindo [o prompt](../../PROMPT_LENTIDAO_AREA_LOGADA_2026-10-25.md). A primeira conexão de uma instância cujo banco já contém a versão atual executa **1 SELECT de esquema, contra 29 comandos antes**. Redução de 28 idas ao banco (96,6% das consultas dessa etapa); não é uma medição do ganho percentual de velocidade da página em produção.

O primeiro uso de uma versão ainda aplica a migração completa. A nova versão só é registrada depois que todos os comandos terminam. O registro é uma impressão digital SHA-256 truncada em 16 caracteres, calculada no carregamento do módulo a partir dos comandos.

## Implementação revisada

- Mantida a implementação da branch original, commit `f7fd36d90734481a8a1b4d47cc89b79e2bcaeeec`.
- Corrigido o tratamento de erro: só o SQLSTATE `42P01` (tabela inexistente) dispara o caminho de primeira aplicação. Erros de conexão e permissão são propagados, sem iniciar DDL indevidamente.
- `migrate(db)` continua exportada e idempotente. Os 29 comandos SQL são iguais aos da main, exceto pela indentação.
- `getDb()` permanece literalmente igual: a Promise é única em `globalThis`, e uma falha libera a tentativa seguinte. A comparação está em [integridade.json](integridade.json).
- Acrescentados testes de erro, interrupção da migração e promoção de contas legadas, além da medição reproduzível sobre o build.

O prompt descrevia aproximadamente 30 comandos e seis ALTERs. A leitura do código e a instrumentação encontraram **29 comandos, incluindo sete ALTERs**. O prompt original foi preservado como registro do pedido.

## Medição antes e depois

| Verificação | Antes | Depois |
|---|---:|---:|
| Consultas de esquema na primeira conexão do processo novo | 29 | 1 |
| ALTER TABLE nessa conexão | 7 | 0 |
| UPDATE de contas legadas nessa conexão, versão já registrada | 1 | 0 |
| Novas consultas de esquema nas cinco aberturas seguintes | 0 | 0 |
| Mapa com sessão sintética completa | 200 | 200 |
| Mapa sem sessão | 307 para login | 307 para login |

Procedimento: `scripts/servidor-local.mjs` prepara um banco PGlite temporário em dia e uma sessão sintética, fecha a conexão de preparação e inicia um processo novo de `next start`. Um preload de medição intercepta as consultas do driver nesse processo, registrando apenas operação e duração, sem parâmetros ou credenciais. A primeira consulta autenticada de `/api/auth/eu`, usada pelo auxiliar para validar a sessão, aciona `getDb()`. As cinco medições seguintes de `/app/observatorios` são aquecidas. Portanto, a contagem é da inicialização real do banco no build, mas os tempos de página não são TTFB frio da Vercel.

- Antes: build `DBK1k7d_3L1rtyFjr9Br2`, produzido a partir de `f2325e92f473daeb821620385887ba37de5e31f5`, cuja árvore é idêntica à main de base `a82e140dd38672d4af855191ef5c727fae3bfd23`. O campo `fonte_commit` no JSON antigo identifica o checkout usado pelo auxiliar de preparação, não o commit do build servido.
- Depois: build `VD-uX5OYW_29xpwKa1e0b`, produzido a partir do código de [758a8b175](https://github.com/genarolins1975/scrutiniums/commit/758a8b175427200165c6a26753af8a1abdd27a12). O commit posterior apenas ajusta a rotina de evidência e acrescenta esta documentação; não altera código da aplicação.
- Dados brutos: [antes.json](antes.json) e [depois.json](depois.json). Os tempos locais ocorreram junto de outras verificações e incluem inicialização do PGlite; não sustentam comparação controlada de latência de produção.

Reprodução, com o build correspondente já gerado:

```bash
bash scripts/preparar-sessao.sh
node scripts/medir-esquema.mjs --esperado 29 --saida /tmp/esquema-antes.json
# Depois de gerar o build corrigido com npm run build:
node scripts/medir-esquema.mjs --esperado 1 --saida /tmp/esquema-depois.json
```

O segundo comando exige o build anterior. O terceiro usa o novo build e o Chromium configurado pelo preparo da sessão (`I18N_CHROMIUM_EXECUTABLE`, quando necessário). As medições desta sessão usaram Node 24.19.0 e `/usr/bin/chromium`.

## Contas legadas e efeito colateral

O `UPDATE users` que promove `ACCESS_PENDING` e `WAITLIST` passa a rodar somente quando a versão não está registrada. A rota `/cadastro/acesso` continua promovendo a conta na chegada. Os dois estados foram verificados com usuários e sessões sintéticos no navegador Chromium, sobre o novo build:

`/app/observatorios` → `/cadastro/acesso` → `/app/observatorios`, com o título “Encontre o painel” visível ao final.

As duas rotas podem usar o redirecionamento progressivo do Next.js (HTTP 200 com instrução de navegação no HTML), além de redirecionamentos HTTP. A primeira versão do script exigia 307 e reprovou essa resposta válida; a rotina final verifica a navegação efetiva no navegador. Evidências em [contas-legadas-navegador.json](contas-legadas-navegador.json) e no campo `contas_legadas` de `depois.json`.

## Verificações

| Verificação | Resultado |
|---|---|
| Banco e idempotência (`db-esquema`, `conta-ferramentas`) | 26 aprovados |
| `npm run verificar:rapido` | Verde; 1.323 aprovados, 4 ignorados; lint, tipos e cobertura verdes |
| `npm run verificar:pr` completo | Verde; 19 min 57 s |
| Vitest completo, sobre o build novo | 402 arquivos; 9.606 aprovados, 12 ignorados, 1 TODO |
| Pipeline Python | 2.448 casos, 11 ignorados, nenhuma falha |
| Pesquisa | 73 aprovados |
| Contrato de publicação seletiva | 28 aprovados |
| Verificações complementares OBEE | Todas aprovadas |
| Build de produção | Aprovado |
| Judiciário no navegador | 68 telas, 224 checagens, nenhum erro |
| Medição final e contas legadas no navegador | Aprovadas; 1 consulta e ambos os estados chegam ao mapa |

As verificações completas foram executadas sobre [758a8b175](https://github.com/genarolins1975/scrutiniums/commit/758a8b175427200165c6a26753af8a1abdd27a12), sem mudanças na árvore durante a execução. Depois disso, somente a rotina de evidência foi ajustada para conferir o redirecionamento no navegador, e executada novamente com sucesso; o código da aplicação e os testes de banco permanecem idênticos ao build validado.

Logs: [verificar-rapido.txt](verificar-rapido.txt), [verificar-pr.txt](verificar-pr.txt) e [medicao-final.txt](medicao-final.txt).

A primeira tentativa de `verificar:rapido` detectou um erro de tipagem no mock novo; ele foi corrigido, e a rodada final passou. Não houve alteração de testes para relaxar contratos da aplicação.

## Limites e próximos passos

A revisão do código e as medições foram feitas nesta sessão: não representam homologação independente de UX ou teste de latência em produção. Nenhuma credencial nem dado de conta de produção foi usado. O acesso e a promoção de contas foram verificados com sessões sintéticas locais.

Permanecem fora do escopo, conforme o prompt: deduplicação das consultas de sessão por requisição, pré-cálculo das datas de frescor, confirmação da região do banco e rastreio de arquivos `public/` no build. Não houve mudança de interface, conteúdo analítico, indicador, fórmula, acesso público ou política de privacidade.

A entrega está preparada para revisão em PR. Não houve merge nem publicação desta correção: o critério 4 do prompt exige autorização explícita do dono para essa etapa. O CI remoto e o estado atual devem ser consultados no PR.
