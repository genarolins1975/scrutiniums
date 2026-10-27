# Frente 3 — recuperar e compartilhar a análise

Entrega de 27/10/2026. Primeiro incremento: tornar o recorte recuperável e compartilhável, com parâmetros explícitos, resumo legível e retorno fiel às consultas cobertas. Não há arquivo de valores históricos nesta entrega.

## Antes e depois

A linha de base é `3e6ca25b086173dafead7dcff50cfefcb8a7297f`. A reprodução independente mostrou Pernambuco e 60 litros voltando a 40 após recarregar; o painel Salvar podia mostrar o endereço anterior após voltar no navegador; a recusa do clipboard não oferecia uma saída; o foco ao abrir Salvar no celular permanecia no corpo da página.

Depois, as jornadas nas larguras 320, 390, 768 e 1440 px conservaram UF, litros, resultado, endereço salvo e citação. A conta lista “Pernambuco · 60 litros” e permite copiar diretamente. O endereço completo continua em detalhes. Se a cópia automática falhar, um campo selecionável recebe foco e uma mensagem explica como copiar. Reabrir o link aplica os parâmetros aos dados disponíveis naquele momento, condição dita no produto.

Na conta de luz, município, distribuidora e consumo usam o mesmo contrato na versão pública e na completa. Recife, 450 kWh e a estimativa de R$ 367,97 permaneceram iguais ao entrar, em PT/EN, no build examinado. Os vínculos e ressalvas do município são recuperados do índice oficial. Voltar e avançar restauram também o texto do consumo ainda focado, evitando campo e cálculo divergentes. Sem distribuidora identificada, a consulta municipal não usa silenciosamente a distribuidora de exemplo. Links com classe, ligação ou bandeira exclusivos do simulador completo indicam a necessidade de entrar, sem exibir outra estimativa como se fosse o recorte recebido.

## Capturas antes e depois

| Superfície | Antes, 390 px | Depois, 390 px | Antes, 1440 px | Depois, 1440 px |
|---|---|---|---|---|
| Consulta do tanque | [captura](antes/combustiveis-390-antes.png) | [captura](jornadas/combustiveis-390-depois.png) | [captura](antes/combustiveis-1440-antes.png) | [captura](jornadas/combustiveis-1440-depois.png) |
| Salvar recorte | [captura](antes/salvar-390-antes.png) | [captura](jornadas/salvar-390-depois.png) | [captura](antes/salvar-1440-antes.png) | [captura](jornadas/salvar-1440-depois.png) |
| Meus recortes | [captura](antes/conta-390-antes.png) | [captura](jornadas/conta-390-depois.png) | [captura](antes/conta-1440-antes.png) | [captura](jornadas/conta-1440-depois.png) |

[Conta de luz pública](energia/energia-pt-390-publica.png) e [autenticada](energia/energia-pt-390-autenticada.png), no mesmo recorte. As capturas de página inteira estão na [tabela do comando de evidências](depois/evidencias.md).

## Contrato e limites de cobertura

Cada controle que usa `useEstadoUrl` contribui com seu esquema no momento de salvar, copiar ou exportar a citação. Isso inclui valores padrão e digitação pendente. Ilhas com a mesma chave respeitam a ordem das alterações por campo. O histórico e a âncora são preservados; a captura não varre formulários nem lê atributos de perfil.

| Consulta | Estado recuperado |
|---|---|
| `/combustiveis`, `/combustiveis/no-meu-estado` | UF e litros; campo vazio permanece sem cálculo |
| `/custo-de-vida` | Fatias do orçamento no modelo de inflação |
| `/educacao-municipal` e consultas que usam o laboratório do Ideb | Aprendizagem e fluxo, com chaves distintas para cenário nacional e municipal |
| `/contas-publicas-estaduais` | Despesa e entregas do cenário didático |
| `/setor-eletrico/conta-de-luz`, `/en/setor-eletrico/conta-de-luz` | Distribuidora, consumo e município; transição público/completo e ressalvas |
| Ferramentas da conta nos painéis Next | Recorte atual ao salvar/copiar/citar; referências .bib/.ris atualizadas após o histórico |
| `/app/conta#recortes` | Resumo, copiar diretamente, renomear e retorno de foco; orientação para conta sem recortes |

A captura comum beneficia os controles integrados ao kit, mas não converte automaticamente controles locais de todos os outros laboratórios nem a SPA legada do Crédito. Modelos de Agro que prometem manter parâmetros apenas no navegador exigem uma solução explícita de compartilhamento que respeite esse compromisso. Não há alegação de cobertura integral de todos os modelos da plataforma.

Nenhuma fórmula, valor da fonte, gold, regra de acesso ou política de armazenamento foi alterada. O catálogo de nomes de UF foi separado em módulo leve, com reexportação compatível, para o resumo não importar a lógica do painel de energia.

## Reprodução

```sh
bash scripts/preparar-sessao.sh
NODE_OPTIONS=--max-old-space-size=4096 npm run build
I18N_CHROMIUM_EXECUTABLE=/usr/bin/chromium node scripts/analise-recuperavel-verificacao.mjs --saida /tmp/analise-recuperavel
I18N_CHROMIUM_EXECUTABLE=/usr/bin/chromium node scripts/analise-recuperavel-energia.mjs --saida /tmp/analise-energia
npm run verificar:rapido
npm run verificar:pr
```

O roteiro de integração usa `next start`, API e persistência reais em PGlite temporário. Sessões e contas são sintéticas; não houve operação autenticada em produção. Os testes de componente usam o hook e componentes reais em Vite, com o leitor de pathname do Next adaptado à fixture. Isso não substitui a prova de persistência pela API.

## Evidências e revisão

Fonte das capturas de layout: [54e2bfd00](https://github.com/genarolins1975/scrutiniums/commit/54e2bfd00ff64c567529917b80fec1a9bf418568). A suíte completa passou em [32db0c3d2](https://github.com/genarolins1975/scrutiniums/commit/32db0c3d24e17e207ce913555dfabd9a57de31b9); até 54e2bfd00, os ajustes posteriores do produto adicionaram entrelinha proporcional a quatro textos de Meus recortes e trocaram o token de hover das ações/links da lista por bronze escuro. Esse acabamento foi submetido novamente à verificação rápida, build e navegador, incluindo axe após clicar em Copiar link. Build dessas capturas: `X--ElloZSDGMxGxEB4ivY`.

A revisão do PR encontrou depois uma condição de corrida entre controles com parâmetros compartilhados. A correção e sua reprodução antes/depois estão em [Revisão de concorrência](REVISAO_CONCORRENCIA.md). Ela altera sincronização de estado, sem alterar layout; as capturas acima continuam identificadas pelo commit em que foram obtidas, não são apresentadas como capturas do código posterior.

- `verificar:rapido`: aprovado em 32db0c3d2, 4.358 testes em 132 arquivos; 7 skips e 1 todo preexistentes. Lint, tipos e cobertura bilíngue aprovados. Repetição após entrelinha: aprovada, com os mesmos totais; ver log em `logs/verificar-rapido-bff6a318a.log`. Repetição após contraste em hover: aprovada, 4.358 testes em 132 arquivos, com os mesmos skips/todo preexistentes; lint, tipos e cobertura bilíngue aprovados.
- `verificar:pr`: aprovado em 32db0c3d2: 9.704 testes da interface, 417 arquivos; 12 skips e 1 todo preexistentes. Todas as etapas passaram, incluindo 1.218 páginas geradas, 68 telas e 224 checks do Judiciário, e árvore versionada inalterada durante a execução. Tempo de parede: 25 min 19 s.
- Pipeline: 2.488 casos, 11 skips preexistentes; pesquisa: 73 casos aprovados; reconciliações e testes complementares aprovados.
- Roteiros de integração e evidências de página: [jornadas da conta](jornadas/jornadas.json) aprovadas nas quatro larguras; [conta de luz](energia/energia.json) aprovada em PT/EN a 390/1440, incluindo campo focado, transição de acesso e ausência. A auditoria após copiar retornou zero violações nas quatro larguras. [32 estados de página](depois/evidencias.md), em oito rotas/recortes × duas larguras × com/sem sessão, com zero violações axe, erros de console ou rolagem horizontal nas condições normais examinadas. A confirmação independente após apontar/clicar mediu contraste de 6,09:1, com zero violações axe na lista..
- Pareceres independentes e oito dimensões: [layout e oito dimensões](revisao-layout/PARECER_FINAL.md), [confirmação mecânica do histórico/contraste](revisao-mecanica/PARECER_FINAL.md) e [estado após copiar](revisao-hover/PARECER_HOVER_FINAL.md).

Uma execução intermediária de `verificar:rapido` teve timeout de 5 s no molde de CadÚnico durante auditorias concorrentes. O teste não foi alterado; a repetição sem essa concorrência passou. O resultado final prevalece, e a falha intermediária permanece registrada.

As capturas de `antes/` correspondem apenas à linha de base. `intermediarias/` guarda os defeitos encontrados durante a revisão, com commit e build próprios; não representa a interface final.

As avaliações independentes foram feitas por agentes separados da implementação, com roteiros próprios e sem edição do checkout. A revisão mecânica verificou estado, histórico, referências, foco e transições de acesso. A revisão de layout examinou telas e ampliou texto; encontrou um corte interno do rótulo dos detalhes que a medida de rolagem global não detectava. Esse achado foi corrigido permitindo quebra no rótulo, sem alterar os seletores da barra.

Uma reprodução independente adicional encontrou consumo focado em 600 kWh enquanto o histórico já havia restaurado URL e cálculo de 450 kWh. A edição local agora acompanha voltar/avançar, com teste que mantém o foco durante a navegação.

A auditoria da página inteira identificou também contraste insuficiente nos dois links de privacidade de Minha conta. O estado já existia no código de partida; os links agora usam o token bronze escuro. A captura após copiar também revelou contraste de 4,40:1 no bronze de hover sobre o papel; o token bronze escuro preserva contraste nessa interação, agora incluída no roteiro com axe. As capturas intermediárias ficam identificadas como tal e não representam o código final.

O parecer de layout atribui 8 a 8,5 às dimensões examinadas, com aprovação do fluxo dentro do escopo registrado. A meta de 9 em todas as dimensões não foi atingida; não há homologação global.

Não houve alteração de testes existentes para esconder falhas. As correções dos roteiros novos se restringiram à preparação do ambiente e à leitura correta da página: pontuação depois do valor monetário, âncora acrescentada ao navegar ao convite e preservação do título pela deduplicação.

## Acessibilidade: o que foi examinado

| Verificação | Evidência e limite |
|---|---|
| Teclado | Tab, Shift+Tab, Enter, Espaço, Escape; foco ao abrir, copiar manualmente, renomear, cancelar e apagar |
| Toque | Contexto touch do Chromium; não substitui aparelho físico |
| Movimento reduzido | Jornadas com preferência reduce |
| 320/390/768/1440 px | Fluxos de Salvar/Meus recortes e medição de largura; inspeção visual além do scrollWidth |
| Texto 200% | Tamanho calculado duplicado; confirmação residual após correção do rótulo |
| Zoom 200% | Ensaio de reflow por zoom CSS; não equivale a teste de zoom nativo em todos os navegadores |
| Axe | Regras disponíveis de WCAG nos relatórios anexos; não é declaração de conformidade integral |
| Estados dinâmicos | Status de cópia, recuperação e resultado; foco e anúncio marcados semanticamente |
| Não verificado | Leitor de tela real, usuários externos, dispositivos físicos, Safari/Firefox e todas as combinações de todos os painéis |

No ensaio de duplicação isolada de fontes em Minha conta, campos de Alterar telefone, o botão Sair e o e-mail de privacidade excedem a largura móvel. O diagnóstico independente confirmou que o markup de AlterarTelefone e Field é idêntico à linha de base; recortes e detalhes cabem. Essa limitação preexistente permanece fora deste incremento e impede declarar a página inteira homologada para esse ensaio.

Uma URL adulterada com distribuidora inexistente ainda produz trechos pouco naturais, como “vigência iniciada em sem data”. O estado de ausência permanece explícito, sem valor inventado nem substituição silenciosa; o acabamento desse estado está documentado no parecer intermediário.

O carregador/detector executável da Impeccable não estava disponível. Foram usadas as instruções acessíveis e revisão manual de código e telas. As oito notas de layout são mantidas no parecer independente; não se atribui 9 artificialmente nem se usa média para homologar a plataforma.

## Decisão de produto pendente

Recuperar os valores exatos de uma publicação antiga requer definir armazenamento, retenção, acesso e tratamento das revisões da fonte. Este incremento preserva a consulta e os identificadores de publicação já disponíveis; não promete arquivo histórico. Essa segunda camada da recomendação 3 exige decisão própria.

## Estado da entrega

O dono autorizou o merge em 27/10/2026. O [PR #398](https://github.com/genarolins1975/scrutiniums/pull/398) registra os checks do commit submetido e o resultado da publicação; este documento não substitui a confirmação do deploy de produção. As duas frentes anteriores já foram publicadas e não fazem parte das alterações deste PR.
