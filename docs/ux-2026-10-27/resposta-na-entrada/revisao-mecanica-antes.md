# Resposta na entrada — avaliação mecânica anterior

27/10/2026. Checkout examinado: `/workspace/scrutiniums-resposta-na-entrada`, HEAD `8a7cd80b27e5110f0024236fc73ae1fabb61de69`. Avaliação separada da leitura visual, conforme `.claude/skills/impeccable/reference/layout.md`.

**Conclusão:** a distância dos controles está no encadeamento dos componentes. A consulta é filha de `ParaVoce`, depois dos cartões; esse bloco vem depois da escala nacional. Antecipar apenas `ParaVoce` preservaria parte do atraso. O trabalho precisa antecipar uma unidade coerente de escolha + resposta + prova, mantendo a profundidade abaixo.

Escopo desta passagem: leitura de componentes, estilos, contratos e testes existentes; métricas já coletadas no mesmo commit. Não executei build, testes ou navegador. O launcher Impeccable está ausente, conforme informado pela coordenação; portanto não há resultado de `impeccable detect`, e esta passagem não deve ser apresentada como detector limpo. `PRODUCT.md` e `DESIGN.md` não existem no checkout. Skills obrigatórias e anexos de arquitetura, componentes, acesso, navegação e acessibilidade foram consultados.

## Evidência de posição

Fonte: `scrutiniums-conselho-2026-10-27/docs/ux-2026-10-27/conselho/evidencias/jornadas.json`, coleta de 27/10/2026, página autenticada, viewport 390 × 900 px. `jornadas.mjs` mede `getBoundingClientRect().y + scrollY`; portanto os valores são posições no documento, não altura do controle.

| Rota | Primeiro controle do caso | Topo atual |
| --- | --- | ---: |
| `/custo-de-vida` | Sua cidade ou região | 2.522 px |
| `/conectividade` | Escolha o município | 2.724 px |
| `/combustiveis` | Seu estado | 2.607 px |
| `/educacao-municipal` | Escolha o município | 2.417 px |
| `/eficiencia-estatal` | Capital | 2.385 px |

Todos estão além da primeira tela de 900 px. Isso demonstra a distância; não mede conclusão de tarefa, compreensão nem conversão.

## Acoplamentos e mudanças necessárias

| Before | After | Why |
| --- | --- | --- |
| `EntradaColecao.tsx:151–164`: frase, `seuMunicipio`, escala, figura; só depois consulta e `ParaVoce`. | Uma fatia explícita para a consulta prioritária, na ordem real do DOM, antes da escala e dos cartões quando a entrada a oferecer. | Evita antecipação só por CSS, que faria leitura visual e teclado discordarem. Não mover automaticamente blocos de outras rotas sem examinar seu contrato. |
| `ParaVoce.tsx`: `children` só depois da grade, com `mt-8`. As cinco entradas usam esse caminho para seus controles. | Retirar a consulta desse agrupamento e manter `ParaVoce` como caminhos de aprofundamento. | A escolha não pode continuar dependendo da altura dos cartões. Duplicar a consulta criaria controles e respostas concorrentes. |
| `PainelConectividade.tsx:153`: a busca sucede H2, introdução extensa e margem de `.cn-secao` (56 px no móvel), além da margem do contêiner. | A abertura da consulta precisa de geometria própria; o resultado detalhado pode continuar abaixo. | Mover a seção inteira, sem tratar os intervalos herdados, ainda pode deixar a busca fora da tela. |
| `PainelEducacao.tsx:52`: o extrato já precede a escala quando `?ibge=` é válido; a busca permanece dentro de `ParaVoce`. | Reunir busca e extrato uma única vez na abertura, para os estados sem escolha, válido e inválido. | O caso válido tem um contrato anterior que precisa sobreviver: cidade antes da escala e link para ficha completa. |
| `combustiveis/page.tsx:77–81`: `PrecoNoEstado` seguido de `FonteFigura`, fora do componente. | Mover os dois juntos ou dar ao resumo a mesma prova explícita. | `PrecoNoEstado` isolado mostra mês e postos, mas a fonte ANP completa está no irmão. Movê-lo sozinho separa o número de sua prova. |
| `AtlasCidadao.tsx:73`: `SeletorCapital` inclui população, área, densidade e atalhos; os sete resultados estão em `ReguaCapital`, depois do mapa de temas. | A resposta prioritária deve usar uma medida real da capital e sua referência, proveniente de `retrato.condicoes`, perto dos seletores. | População e área não respondem à pergunta “Como se vive…?”. Antecipar o seletor é necessário, mas insuficiente. |

As três mudanças de maior efeito são: separar a consulta dos cartões; levar resposta e prova junto da escolha; conferir o primeiro viewport por geometria, além de testar a ordem do HTML.

## Contratos a preservar por rota

| Rota | Estado e leitura do dado | Risco concreto |
| --- | --- | --- |
| Custo de vida | `InflacaoNaArea` usa `useArea` → `useSelecaoGas("area")`. Há Brasil como referência explicitamente identificada, 16 áreas válidas e aviso para parâmetro inválido. A variação é percentual; distância ao Brasil é em p.p.; fonte, publicação e janela vêm de `dados.ref`. | Um município arbitrário não pode receber o índice da área mais próxima. Não confundir região metropolitana com município nem transformar o IPCA em orçamento de uma família. Os nove grupos e suas comparações devem continuar acessíveis, mesmo se o resumo inicial for reduzido. |
| Conectividade | `consulta` é resolvida no servidor por `?ibge=`. A busca usa índice público de nomes; sem escolha existe distribuição nacional; com escolha, acesso fixo, móvel e cobertura têm referências distintas. | Não resumir contratos como pessoas conectadas. Cobertura declarada não garante velocidade/sinal. `null`/ausência e zero publicado precisam continuar diferentes. A fonte e a nota do resultado municipal hoje ficam depois de tabelas e série; um resumo elevado precisa de sua própria prova próxima. |
| Combustíveis | `?uf=` sincroniza ilhas. Média da amostra da ANP por litro, mesmo mês para UF e Brasil; postos pequenos recebem ressalva. Tanque é multiplicação pelos litros e não preço observado em um posto. | `litros` usa `useState(40)`, sem URL. A jornada existente mostra 60 litros antes e 40 após reabrir o mesmo `/combustiveis?uf=PE`. Defeito já existente, não regressão desta mudança; não afirmar que o compartilhamento preserva a conta completa. Se o novo resumo repetir o tanque, evitar um segundo estado independente de litros. |
| Educação municipal | `consulta` é resolvida no servidor. `ExtratoMunicipio` identifica município, ano, etapa, rede municipal, escala 0–10, fonte e motivo da ausência; referências estaduais públicas e municipais nacionais são nomeadas distintamente. | Não trocar rede municipal por pública silenciosamente, matrícula por estudante único nem ano do Ideb por ano do Censo Escolar. Manter a ausência com motivo e a ficha completa privada. |
| Eficiência Estatal | `ProvedorCapital` controla território, comparador, indicador e idade; todos os consumidores devem permanecer abaixo dele. `Medida` já possui unidade, período, natureza, fonte, nota e precisão. | A escala atual é mediana fixa das 26 capitais, não número que muda com o seletor. Um resumo novo precisa ler a capital escolhida, não relabelar a mediana. Resultados de 2022 e recursos de 2025 não formam uma relação causal. Posição relativa não é nota ou meta; evitar retirar natureza e precisão para caber na abertura. |

`useSelecaoGas.ts` usa `pushState`, evento `selecao-gas` e `popstate`: mantém outros parâmetros e sincroniza ilhas. Começa pelo padrão no SSR e aplica a URL após hidratação. `ProvedorCapital` também começa com Recife/Curitiba e lê a URL no efeito. Não usar geolocalização nem UF da conta como uma escolha explícita: `PARA_VOCE_POR_UF` permanece desligado e tem teste específico. Uma resposta padrão deve identificar Brasil ou a capital de referência, sem dizer que é o caso pessoal do leitor.

## Acessibilidade e mecânica que exigem conferência

- **Não duplicar:** uma busca por município, uma consulta inicial, IDs únicos (`municipio`, `municipio-titulo`, `extrato-titulo`, `retrato-titulo`, `para-voce-titulo`) e uma resposta de cada tipo. Reutilizar o mesmo componente duas vezes não garante IDs exclusivos nem estado de litros compartilhado.
- **Foco:** selects nativos com labels já existem; foco visível está em `globals.css`. A busca municipal usa combobox, setas, Enter, Escape e opção ativa. Ao selecionar, `router.push()` navega; não há transferência explícita de foco para a resposta no componente. Verificar o foco real depois da navegação e da alteração de parâmetros; não inventar aprovação por leitura do código.
- **Sobreposição da busca:** `BuscaMunicipio` posiciona a lista com `absolute`, `z-30`, `max-h-80`, rolagem vertical. O novo contêiner não pode cortar a lista com `overflow:hidden`, ocupar sua área com outro bloco, nem deixar as opções fora do alcance por teclado/toque.
- **Reflow:** `SeletorArea` grande tem `min-w-[18rem]` (288 px com raiz de 16 px); o molde usa `px-6` (48 px somados). A 320 px restam 272 px. É um risco concreto de transbordamento, inferido do CSS, ainda sem medição nova. Resolver o mínimo da largura do controle, sem esconder overflow do documento.
- **Regiões vivas:** `InflacaoNaArea` põe inclusive os nove grupos dentro de `role="status"`; `PrecoNoEstado` envolve todos os produtos. Um resumo inicial não deve adicionar outra região anunciando o mesmo resultado. Preservar foco no controle e limitar eventual anúncio à resposta relevante.
- **Âncoras:** `BuscaConectividade` atualmente navega para `?ibge=...#municipio`. Mover ou dividir a seção exige preservar o alvo. As âncoras de série, grupos, comparações e método continuam reais, inclusive quando seus ancestrais são `<details>`.
- **Acesso:** Educação, Conectividade e Eficiência Estatal têm aperitivos por rewrite; os dois primeiros usam páginas próprias que não usam `EntradaColecao` neste commit. Uma alteração só no molde não prova mudança nem regressão dessas versões. Custo de vida e a entrada `/combustiveis` continuam fechados; a consulta aberta de combustíveis é `/combustiveis/no-meu-estado`. Não alterar `rotasPublicas.ts` para resolver layout.

## Testes: o que pode mudar legitimamente

O núcleo de `observatorio-layout/SKILL.md`, seção 9, autoriza atualizar testes que fixam ordem e desenho anterior no redesenho solicitado, mantendo os invariantes. Registrar a decisão de 27/10/2026 nos comentários dos contratos novos.

| Arquivo/asserção | Mudança justificável | Preservar |
| --- | --- | --- |
| `src/tests/entrada-molde.test.ts:45`, `ORDEM` | Inserir a fatia inicial na ordem declarada e verificar sua posição real. | H1 único, escala 1–4 quando mantida, prova de cada número, artefato com limites, método único no fim, preparo nunca link. Não aceitar silenciosamente qualquer ordem. |
| `src/tests/para-voce.test.ts`, bloco “posição” | Ajustar o literal que exige `SeletorCapital` dentro de `ParaVoce`; atualizar a relação com a escala se esta mudar. Preferir invariantes sem repetir toda a marcação JSX. | Destinos reais, mesma base do destino, fonte/período, motivo de ausência, selo e prefetch, idioma, UF da conta desativada. |
| `src/tests/conectividade.test.ts:243` | O recorte textual “da escala até para-voce” precisa mudar se esses delimitadores mudarem de ordem. Extrair a seção pelo próprio marcador. | Denominador de municípios com 5G publicado; quatro números atuais, salvo decisão explícita de alterar a escala. |
| `src/tests/educacao.test.ts:317` e `educacao-ficha-navegador.test.ts:35` | Renomear marcador de `seu-municipio` apenas se o novo contrato substituir essa fatia. | Cidade antes da escala, uma ficha, laboratório não duplicado, teclado e restrições da versão aberta. |
| `inflacao.test.ts` e `combustiveis.test.ts`, “primeira tela” | Acrescentar ou usar evidência geométrica focalizada: hoje o teste só procura texto no HTML completo. | Fonte, unidade, mês, ausências, séries, notas e downloads existentes. Presença de texto não prova primeira tela. |
| `ux-orcamentos-cromo`, `ux-orcamentos-comprimento`, `aperitivo` | Não aumentar limites para acomodar a nova composição. | Orçamentos, profundidade no HTML e fronteira de acesso. |

## Checklist mínimo para a implementação

1. Nas cinco entradas, medir topo e base do controle a 390 × 900; a escolha deve caber integralmente no primeiro viewport. Conferir a 320, 768 e 1440 px e a 200% quando viável. Medir também a posição da resposta selecionada e de sua prova, sem depender de aparência aproximada.
2. Percorrer sem escolha → escolha válida → outra escolha → URL inválida → voltar/avançar/reabrir. Em custo de vida e combustíveis, confirmar sincronização com as ilhas de histórico. Nos municípios, confirmar que o resultado e o destino pertencem ao mesmo IBGE.
3. Conferir uma ausência real ou fixture existente: combustível sem preço, município sem Ideb e cobertura sem publicação. Nenhum vira zero, dado nacional ou frase positiva por fallback silencioso.
4. Validar fonte, unidade, período, natureza/ressalva e referência no bloco elevado. Manter séries, comparações, tabelas, modelo e downloads acessíveis abaixo; nenhum conteúdo desaparece apenas para cumprir altura.
5. Percorrer a primeira tarefa por teclado e toque; abrir sugestões, escolher, observar foco e retorno, conferir nomes longos e lista sobreposta. Nenhuma ordem visual artificial por CSS.
6. Rodar somente os testes afetados e a evidência focalizada na execução principal, após `bash scripts/preparar-sessao.sh` exigido pelo projeto. Este relatório não os executou. Conferir com/sem sessão nos temas públicos e o retorno do login com o recorte.

Não há nota de conformidade ou aprovação estética nesta passagem mecânica. Foco após navegação, leitura por tecnologia assistiva, contraste efetivo, reflow e nova posição dos elementos permanecem por verificar no resultado renderizado.
