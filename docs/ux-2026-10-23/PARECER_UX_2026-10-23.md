# Parecer de UX da Scrutiniums: organização, fluidez e padronização

Data: 23/10/2026 · Base: `main` em `b825eb9e3`, build de produção local `sQkjwruR6DBV5LyLyiEJ1` · Autor: sessão Claude Code no repositório `genarolins1975/scrutiniums` · Destinatário: o dono da plataforma e o modelo que vai implantar as iniciativas.

Este documento é a referência das sete iniciativas abaixo. Os testes `ux-orcamentos-cromo`, `ux-texto-minimo`, `navegacao-colecao` e `design-tokens` citam `docs/PARECER_UX_2026-10-21.md`, que não existe no repositório; este parecer registra o que aquele decidiu (iniciativas 1 a 5 em produção, 6 a 8 pendentes) e continua a numeração em outra série, para não confundir.

## Como usar este parecer (para o modelo que vai implantar)

1. Ler inteiros `CLAUDE.md`, `AGENTS.md` e `.claude/skills/observatorio-layout/SKILL.md` (com o PR #362 integrado ao `main`: o núcleo e os anexos `navegacao.md`, `arquiteturas.md`, `componentes-e-graficos.md`, `identidade-visual.md` e `acesso.md`). Carregar as skills `emil-design-eng`, `impeccable` e `design-taste-frontend`.
2. Uma iniciativa por vez, na ordem da seção 9, um PR por bloco. Cada PR traz: o que mudou para o leitor, `npm run verificar:pr` verde, evidências com `npm run evidencias -- --rotas <rotas> --saida docs/ux-AAAA-MM-DD/<tema>`, capturas antes e depois a 390 e 1440 px, com e sem sessão, e a nota da rubrica (seção 10 da skill) por página alterada.
3. Nada aqui autoriza merge, abertura de rota fechada ou mudança de método de cálculo. As decisões marcadas "decisão do dono" na seção 8 precisam da resposta dele na conversa antes de implementar.
4. Testes que fixam o desenho anterior mudam de propósito e com justificativa no PR; nunca se apaga teste para passar. Conteúdo não é apagado: o que não cabe vai para `Recolhido`.
5. Vocabulário: Observatório → Coleção → Página. "Painel" é a página com dados. Não usar "aba", "vista", "módulo" em texto visível.

## 1. Veredito em uma página

**Evidência.** A plataforma tem 365 rotas de página (267 em português, 98 em inglês), 6 observatórios e 28 coleções no registro, 123 páginas publicadas, 13 com cobertura parcial e 4 previstas (inventário do mapa logado, 23/10/2026). As cinco iniciativas do parecer de 21/10/2026 estão em produção: um só vocabulário, uma só navegação de coleção, uma só busca, um só molde para as 19 entradas e um só arquivo de tokens. As 19 entradas passam no teste do molde e no orçamento de comprimento, e as 26 páginas medidas com sessão ficam dentro do orçamento de cromo (até 228 px a 1440 e 195 px a 390), exceto a aplicação do Crédito. Nenhuma página medida tem rolagem horizontal; axe acusa só duas violações de contraste em `/app/conta` e três de região rolável sem foco numa vista do Crédito.

**Inferência.** O que falta não está nas entradas, está no que vem depois delas e antes delas. Depois: as cerca de 300 páginas de painel, onde cada domínio mantém a própria anatomia (9 componentes de abertura, 19 faixas de números com nomes diferentes, 9 tabelas, 52 arquivos de gráfico em SVG próprio, 8 seletores de lugar), o componente de evidência que o design system declara obrigatório existe em um domínio só, e a aplicação do Crédito, que serve 5 das 28 coleções, é um segundo produto (barra lateral própria, 727 px de cromo no celular, datas em formato ISO, números em outra tipografia). Antes: o mapa da área logada, que é a página inicial de quem tem conta, lista 28 coleções e 140 páginas em texto de 12,5 px, abre com três estados vazios, usa formulários POST no lugar de links, quebra um observatório entre colunas e reintroduz os oito domínios antigos no fim. Não há dado de uso de visitante sem conta e nenhum número de uso com conta foi consultado; a priorização abaixo é por inferência sobre o código, o build e as capturas.

**Recomendação.** Sete iniciativas, em duas frentes. Plataforma: (I1) um molde único de página de painel com kit de evidência; (I2) o Crédito na mesma casca; (I3) um só seletor de lugar e a preferência "Meu lugar"; (I4) orientação sem repetição, fim de página único e páginas leves; (I5) um só contrato para artefatos, figuras, mapas e imagens. Mapa da área logada: (M1) arquitetura e interação do mapa, que vira uma tela de decisão; (M2) a camada pessoal, com retomar, recortes, novidades e o lugar do leitor. Ordem sugerida: M1, I4, I1, I3, M2, I5, I2, por relação entre efeito para o leitor e custo. A fila para produção tem um PR, o #362, só de instruções para agentes, com CI verde; a recomendação é fazer o merge antes de começar, porque muda o que o implementador deve ler.

| Iniciativa | Critério que mais move | Efeito para o leitor | Esforço (PRs) |
|---|---|---|---|
| M1 Mapa: arquitetura e interação | C1, C2, C4 | A primeira tela de quem entra decide em uma olhada | 1 |
| I4 Orientação, fim de página e peso | C2, C7 | Menos repetição acima e abaixo do conteúdo; páginas até 16 vezes mais leves | 3 |
| I1 Molde de página de painel | C3, C6 | Mesma pergunta, mesma resposta visual em todos os painéis | 1 + 5 |
| I3 Lugar único e "Meu lugar" | C1 | O leitor escolhe a cidade uma vez e a plataforma lembra | 2 |
| M2 Mapa: camada pessoal | C1 | Retomar, novidades desde a última visita, números do seu lugar | 1 |
| I5 Artefatos, figuras, mapas e imagens | C8, C3 | Um só contrato visual para o que não é texto | 2 |
| I2 Crédito na mesma casca | C3, C4, C7 | Deixa de existir um segundo produto | 2 + migrações |

## 2. O que foi examinado e o que não foi

- Código do `main` em `b825eb9e3`: registro (`src/lib/observatorios/*`), navegação (`src/components/layout/*`), mapa logado (`src/app/app/(foco)/observatorios`, `src/components/observatorios/DiretorioPaineis.tsx`), molde (`EntradaColecao`), busca (`src/lib/busca`), rotas públicas, componentes por domínio, CSS, testes de UX e a aplicação do Crédito (`public/obs`).
- Build de produção local e as páginas geradas no build em `.next/server/app` (681 arquivos HTML em português).
- Capturas no build com `npm run evidencias` (Chromium, 390 e 1440 px): 13 rotas com sessão e 6 rotas abertas com e sem sessão, 50 páginas, com cromo, axe, erros de console e requisições que caíram no login. Tabelas e capturas em `docs/ux-2026-10-23/evidencias/`.
- Documentos: `docs/BANCA_2026-10-19.md`, `docs/REVISAO_ABERTO_2026-10-20.md`, `docs/observatorios/REAGRUPAMENTO.md`, `AVALIACAO_PAGINAS.md`, `DESIGN_SYSTEM_OBSERVATORIOS.md`, `MEDICAO_DE_USO.md`, `CICLO_PROPOSTAS_2026-10.md` e o PR #362.
- Não examinado: produção (`scrutiniums.com` não foi acessada), dado de uso (a contagem anônima está desligada e a contagem com conta vive no banco de produção, não consultado), leitor de tela, zoom de 200 %, pessoas reais (o protocolo `TESTE_MODERADO.md` não foi aplicado). As skills `impeccable` e `design-taste-frontend` estão versionadas sem os scripts: a crítica foi feita sobre as capturas, com as rubricas de `references/critique.md` e `references/app-screens.md`, e o contexto da casa veio da `observatorio-layout`, que prevalece em conflito.

## 3. Critérios de avaliação

Os oito critérios abaixo traduzem "fluidez e experiência para achar a informação" em medidas que cabem em teste. Cada iniciativa diz qual critério move.

| Critério | O que mede | Como medir | Situação em 23/10/2026 |
|---|---|---|---|
| C1 Encontrabilidade | O destino mais procurado está a um clique da tela em que o leitor está, e o lugar dele (cidade, estado) o segue | Cliques da entrada e do mapa até cada consulta pessoal; lugar persistido entre coleções | Entradas: sim (bloco "Para você"). Mapa logado: não (consultas pessoais sem destaque; nenhum número do lugar do leitor). Lugar: só dentro dos temas da Eficiência (`levar`) e na volta do login dos aperitivos |
| C2 Orientação | O leitor sabe onde está sem que a mesma informação se repita | Vezes que o nome do observatório e da coleção aparecem acima do H1; blocos de fim de página | Até 5 repetições do nome acima do H1 (seletor, aba, trilha, rótulo, H1); 3 blocos de fim de página com 56 a 58 links de rodapé em toda página |
| C3 Anatomia única | A mesma pergunta recebe a mesma resposta visual em todo painel: abertura, número, figura, tabela, controle, nota, método | Componentes de abertura e de número por domínio; uso de `PainelEvidencia` e `SeloNatureza` | 9 aberturas, 19 faixas de números, 9 tabelas; `PainelEvidencia` só no Setor Elétrico (10 arquivos); `SeloNatureza` em 34 arquivos, 33 do Setor Elétrico |
| C4 Interação consistente | Link é link, estado vive na URL, alvos de 44 px, teclado | `<a href>` nas navegações; parâmetros de recorte na URL; axe | Mapa logado com 43 formulários POST no lugar de links; aplicação do Crédito navega por `<button data-view>`; links de página do mapa sem alvo de 44 px |
| C5 Vocabulário | Observatório → Coleção → Página em todo texto visível; um só nome para a folha | Grep nos componentes de layout e nos textos | Regra cumprida nas superfícies da Iniciativa 1; "domínio" volta no mapa logado ("Fontes e atualização"); "aba", "vista", "módulo" e "capítulo" convivem como nome da folha |
| C6 Prova e frescor | Todo número com fonte, período, natureza e situação do dado junto dele | Faixa de frescor e selo nas páginas; formato de data | Entradas: sim. Painéis: por domínio; o Crédito mostra "2026-10-22 15:48 UTC" e "2026-08-01" |
| C7 Peso e tempo até a leitura | HTML entregue por página, cromo até o conteúdo, comprimento | Tamanho do HTML gerado no build; `ux-cromo`; `ux-medidas` | 9 páginas acima de 1 MB e 76 acima de 500 KB; maior: 7,9 MB. Cromo dentro do orçamento, salvo o Crédito a 390 px (727 px) |
| C8 Figuras e artefatos | Um contrato para imagem, diagrama, laboratório e mapa; nada provisório | Inventário de imagens e envelopes | 8 gravuras "v1" em 3 estilos e 3 pastas; `ModeloDidatico` só nas entradas; 15 componentes de mapa |

## 4. Diagnóstico por achado

Ordem por gravidade para o leitor. E = evidência, I = inferência, R = recomendação (a iniciativa que resolve).

**A1. O mapa logado não decide por ninguém.** E: `/app/observatorios` é o destino de todo login e da home com sessão (`Home.tsx` redireciona). A 1440 px tem 2.256 px de altura; a 390 px, 5.631 px. A primeira tela mostra a faixa "Continuar: ainda sem último acesso · Recortes salvos: nenhum ainda · Avisos de atualização: nenhum configurado", o H1, a busca em meia largura com a metade direita vazia, um parágrafo de inventário ("Coleções: 28 ... Páginas publicadas: 123 ...") e a legenda dos selos. O diretório só começa a 520 px. As coleções e os observatórios são `<button>` dentro de `<form method="post">` (43 formulários: 6 de observatório, 28 de coleção e 9 de "Explorar"), as páginas são links inline de 12,5 px separados por "·", sem alvo de 44 px. O CSS usa `columns: 3`, e o bloco de Energia e Infraestrutura quebra entre a coluna 2 e a 3: "Mobilidade" e "Conectividade" aparecem no topo da coluna 3 sem o título do observatório (captura `app_observatorios-1440-com-sessao.jpg`). Sete coleções mostram "só o painel de entrada" em itálico. O fim da página, "Fontes e atualização", lista nove cartões pelos oito domínios antigos mais "Justiça" ("Eficiência Estatal", "Justiça", "Crédito") com botões "Explorar", uma segunda taxonomia. A página tem CSS próprio com corpos de 12,5, 13,5 e 15,5 px, fora da escala única. I: o mapa é um índice completo, não uma tela de decisão; para quem volta, nada do que ele fez aparece como ação; para quem chega, 140 links iguais. R: M1 e M2.

**A2. Abaixo das entradas, cada domínio tem a própria anatomia.** E: capturas da primeira tela a 1440 px de cinco painéis de domínios diferentes (`setor_eletrico_pld`, `eficiencia_estatal_saude_capitais`, `contas_publicas_execucao`, `gas_natural_precos`, `agronegocio_prato`). Setor Elétrico: filete, H1, lead em sans, linha de recorte, "Fontes, datas e siglas", três números em serifa com selo de natureza e variação, seletor de profundidade. Saúde nas capitais: H1, subtítulo longo em serifa, recorte em cinza, seletor "Capital" à direita, "PERÍMETRO 1 DE 3", "PERMITE MOSTRAR / NÃO PERMITE PRESUMIR", número com "SOBRE ESTE DADO". Contas Federais: rótulo "EXECUTAR · DADOS DISPONÍVEIS · RECORTE PARCIAL" (estado de prontidão escrito à mão, fora do `SeloProntidao`), botão "Compartilhar recorte" que duplica o "Salvar recorte" da barra, seções numeradas "01 ·". Gás Natural: dois parágrafos de números em prosa, sem faixa de números, e a frase em inglês "Updated on October 02, 2026" na linha de fonte. Agronegócio: rótulo "AGRONEGÓCIO / PERGUNTA 8", quatro números em serifa sem selo. No código: 9 componentes de abertura (`CabecalhoModulo` com 75 usos, 4 `Abertura`, `AberturaGas`, `AberturaCredito`, `AberturaAgro`, `AberturaJudiciario`), 19 funções exportadas de faixa de números ou resposta (`Numeros` ×3, `FaixaMetricas`, `FaixaMedidas`, `FaixaResumo`, `Destaques`, `DestaquesAgro`, `RespostasIniciais` e outras), 9 componentes `Tabela*` em 3 domínios, 52 arquivos com gráfico em SVG próprio e nenhuma biblioteca de gráfico. O design system (`DESIGN_SYSTEM_OBSERVATORIOS.md`) diz que "toda visualização relevante é um `PainelEvidencia`" e que "todo número de indicador leva selo"; `PainelEvidencia` está em 10 arquivos, todos do Setor Elétrico, e `SeloNatureza` em 34, 33 deles do Setor Elétrico. I: o leitor que vai de uma coleção a outra reaprende a ler o número, a figura e a tabela. R: I1.

**A3. A aplicação do Crédito é um segundo produto.** E: `public/obs/app.js` tem 1.278.773 bytes, `styles.css` 94.538, `index.html` 25.111; 42 vistas em `<button data-view>` numa barra lateral com oito grupos, marca própria ("◆ Crédito e sistema financeiro · monitoramento · diagnóstico · previsão") e barra de celular com botão de menu. A 390 px o cromo até o conteúdo é de 727 px (orçamento: 200) em `/observatorio/credit` e `/observatorio/payroll-lending-aging`; a 1440 são 142 px porque a barra lateral não entra na medida. Nas duas vistas medidas há um erro 403 no console e, em `payroll-lending-aging` a 390 px, três violações `scrollable-region-focusable`. Datas "2026-08-01", "processado em 2026-10-22 15:48 UTC", números em sans negrito ("R$ 7.397,7 bi"), setas "→" na prosa, travessão no lead. Quatro coleções de outros observatórios têm a entrada dentro dela (`/observatorio/payroll-lending-aging`, `/subnational-credit`, `/pix`, `/sectors`): em "Dívida e crédito das famílias" a trilha diz Famílias e a barra lateral diz "Crédito e sistema financeiro", com a frase "Este painel faz parte do Observatório das Famílias; quem o mantém é a coleção Crédito e sistema financeiro" no lugar do rótulo padrão. O teste do molde exclui essas quatro entradas ("Iniciativa 8"). A medição de uso agregada não cobre a aplicação (`MEDICAO_DE_USO.md`, seção 4). I: quem cruza de qualquer coleção para o Crédito muda de site; a casca já foi unificada na barra superior, mas tudo abaixo dela é outro sistema. R: I2.

**A4. Onde estou, dito cinco vezes.** E: na entrada das Famílias a 1440 px, acima do H1 aparecem "FAMÍLIAS ▾" (seletor), "Famílias" (aba ativa), "Observatórios / Famílias" (trilha) e "OBSERVATÓRIO DAS FAMÍLIAS" (rótulo), e o H1 é a pergunta do observatório. Em `/setor-eletrico/pld`, cinco faixas até o conteúdo (barra, abas, trilha com PT/EN, linha 1 e linha 2 da navegação), 228 px. No fim de toda página de coleção há três blocos: "Para ir além" (6 links), rodapé da coleção (8 links, repete Início, Dados, Método e Glossário da navegação) e o rodapé da plataforma (10 KB, 56 a 58 links, as 28 coleções de novo). O rodapé da entrada do Setor Elétrico tinha 1.123 px fixos (`AVALIACAO_PAGINAS.md`, 22/10). As 28 coleções estão listadas no seletor da barra, no rodapé, no mapa logado, em `/buscar` sem termo e nas entradas dos observatórios. I: o cromo cabe no orçamento, mas a atenção é gasta em repetição; o rodapé de 56 links é o maior bloco de navegação da página e o menos usado. R: I4, com decisão do dono sobre a trilha e o rótulo.

**A5. A navegação não é sempre a do dono da rota.** E: `/agronegocio/prato` pertence a Famílias, coleção Custo de vida (`registro.ts`, `AGRO_FAMILIAS`); o seletor e a trilha dizem "Custo de vida", mas a navegação de coleção abaixo é a do Agronegócio ("Início, O setor, Panorama, Atlas, Comparar, Capítulos, Cadeias, Aprenda") e o rótulo acima do H1 diz "AGRONEGÓCIO / PERGUNTA 8". O mesmo ocorre nas quatro entradas servidas pelo Crédito. I: a regra "cada rota tem um único dono" vale no registro e na trilha, mas o layout da pasta decide a navegação. R: I4.

**A6. Páginas pesadas demais para a primeira leitura.** E: HTML gerado no build, em `.next/server/app`: `/eficiencia-estatal/trabalho-renda/comparar` 7.893 KB; `cadastro-unico` 4.758 KB; `desigualdade` 4.565 KB; `renda-das-familias` 4.482 KB; `/saneamento/tarifa-social` 1.268 KB; `/saneamento/continuidade` 1.120 KB; `/setor-eletrico` 892 KB; `/setor-eletrico/pld` 720 KB. Nove páginas acima de 1 MB e 76 acima de 500 KB, em 681. A entrada do Setor Elétrico tem 54 `<details>` e 495 links. I: numa rede móvel, 4 a 8 MB de HTML são segundos antes do primeiro número; os dados de comparação estão embutidos no HTML em vez de carregados sob demanda, padrão que o próprio Setor Elétrico já usa (`ContaTabelaSobDemanda`, `VisaoTabelasSobDemanda`). R: I4.

**A7. Oito jeitos de escolher um lugar.** E: `BuscaMunicipio` (Saneamento, reaproveitado por Educação, Conectividade e Previdência), `ContaBuscaMunicipio` e `QualidadeBuscaMunicipio` (Setor Elétrico, com índice próprio `/setor-eletrico/conta-de-luz/municipios.json`), `SeletorCapital`, `SeletorCapitalPanorama`, `SeletorEstado`, `SeletorEstadoNaUrl`, `SeletorTerritorioTrabalho`; dois índices de município baixados pelo navegador. O índice da busca da plataforma não tem municípios (Iniciativa 7, pendente). A conta já guarda a UF (`users.uf`, `schema.ts`; obrigatória no cadastro desde a decisão de 19/10/2026, podendo faltar em contas anteriores), e nenhuma página usa esse dado. I: o leitor digita a cidade em cada tema e a plataforma nunca lembra; o dado que já existe (a UF) não vira valor. R: I3 e M2.

**A8. Imagens em três estilos, todas "v1".** E: 8 arquivos WebP em `public/energia/arte` (3), `public/estado/arte` (3) e `public/obs/arte` (2), gerados por IA, com legenda "Ilustração conceitual gerada por IA" e sufixo `-v1`. Na entrada do Setor Elétrico as quatro cenas das etapas aparecem duas vezes na mesma página (faixa "Quatro etapas" e seção "Do reservatório à sua tomada"). Gás, Saneamento, Agronegócio, Território, Famílias, Serviços Públicos e Economia não têm gravura; os seus artefatos são diagramas em SVG. A banca (19/10) registrou as gravuras como provisórias; o dono decidiu "melhorar quando necessário, layout sem defeito". I: a identidade visual dos artefatos é o SVG didático; as gravuras são exceção de dois domínios e repetem conteúdo. R: I5, com decisão do dono.

**A9. Vocabulário da folha e taxonomia antiga.** E: nos componentes de layout, observatórios, busca e conta, "página" aparece 108 vezes, "aba" 44, "painel" 37, "vista" 18, "módulo" 9. O mapa logado usa `OPCOES_OBSERVATORIOS` (os oito domínios mais "Justiça") na seção "Fontes e atualização" e no cookie de último acesso; o POST `/app/observatorios/entrar` aceita `d` (domínio) e `o`/`c` (observatório/coleção). A barra lateral do Crédito tem "Mapa do Observatório" como primeira vista e o mapa da plataforma se chama "Encontre o painel". I: o leitor leigo vê "coleção", "domínio", "aba", "vista", "módulo", "capítulo" e "painel" para unidades parecidas. R: I4 e M1.

**A10. Estados de prontidão e numeração fora do padrão.** E: "RECORTE PARCIAL" escrito à mão no rótulo de `/contas-publicas/execucao`; "cobertura parcial" repetido 13 vezes no mapa logado dentro da lista do Saneamento; seções "01 ·" nas Contas Federais e chips "1, 2, 3" em "NESTA PÁGINA · 6 SEÇÕES" no Saneamento, enquanto o dono retirou a numeração dos cartões da home (22/10). I: o `SeloProntidao` padronizou as entradas, não os painéis; a numeração de seção não tem decisão registrada para os painéis. R: I1 e I5 (decisão do dono).

**A11. Ruído técnico nas páginas abertas.** E: em `/`, `/observatorio-do-credito`, `/perguntas/familias` e `/buscar`, sem sessão, uma requisição RSC cai em `/entrar?_rsc=...` e o console registra um erro 401 (duas em `/perguntas/familias`); com sessão, `/observatorio-do-credito` e `/perguntas/familias` ainda têm uma requisição que cai no login. `/app/conta` tem duas violações de contraste (axe). I: um link de destino fechado sem `prefetch={prefetchDoLink(href)}` e uma chamada de estado de sessão que responde 401 em vez de 200. R: I4 (higiene), sem decisão.

**A12. Duas buscas na mesma tela.** E: a entrada do Setor Elétrico tem o campo da barra e um segundo campo "Busque por pergunta, assunto, painel, conceito ou distribuidora" em "As páginas do observatório, por tema"; o mapa logado tem o campo da barra e o campo da página. I: previsto pela Iniciativa 3 (busca local com filtro), mas dois campos iguais na mesma tela pedem uma justificativa visível (o filtro) que o leitor não vê. R: M1 e I4 (o campo local só com o rótulo do filtro).

**A13. O documento que governa os testes não está no repositório.** E: quatro testes e dois scripts citam `docs/PARECER_UX_2026-10-21.md`; o arquivo não existe (`find` em 23/10/2026). R: versionar este parecer e, se o dono tiver o de 21/10, versionar também aquele; até lá, apontar as referências para este.

**A14. Sem dado de uso, a priorização é inferência.** E: `USO_ANONIMO_ATIVO` desligado; a contagem com conta não cobre o Crédito; nenhum número de uso consta de documento. I: a ordem das migrações do I1 e do I2 deveria vir do uso. R: seção 8, decisão do dono sobre a base legal.

## 5. Iniciativas da plataforma

### I1. Molde único de página de painel (kit de evidência)

**Move:** C3, C6, C8. **Resolve:** A2, A10. **Depende de:** nada; I4 e I5 se encaixam nele.

**Objetivo.** Toda página de painel da plataforma, em qualquer coleção, tem a mesma anatomia, feita dos mesmos componentes, como já acontece com as 19 entradas (`EntradaColecao`). O leitor que aprendeu a ler um painel do Setor Elétrico lê um da Saúde do mesmo jeito.

**O que fazer.**

1. Criar `src/components/painel/` com o kit, extraído do que o Setor Elétrico já tem (é o domínio mais maduro e o que cumpre o design system): `PaginaPainel` (o molde), `AberturaPainel` (de `CabecalhoModulo`), `NumeroIndicador` (de `FaixaMetricas` e `NumeroEscala`, fundidos; nunca mais um componente de número), `FiguraAnalitica` (de `PainelEvidencia`), `TabelaDados` (de `energia/TabelaDados` e `TabelaInterativa`), `Controles`, `ParaLer` e `LeituraGuiada` (de `energia/Didatica.tsx`), `Grafico*` (de `GraficoLinhas`, `GraficoBarras`, `GraficoPontos`, `GraficoDispersao`, `GraficosArea`). Os arquivos antigos passam a reexportar o kit até a última migração e depois saem.
2. Fatias do molde, cada uma marcada com `data-fatia`, nesta ordem: `abertura` (rótulo do grupo quando a página está num grupo, H1 com até 60 caracteres, lead com até 220, linha de recorte "período · universo · unidade · fonte curta", uma frase de limite "o que não permite concluir", a primeira ação quando a página tem uma: busca de lugar ou seletor); `numeros` (1 a 4 `NumeroIndicador`: valor em serifa, unidade, período, fonte, `SeloNatureza`, variação com base declarada); `figuras` (cada `FiguraAnalitica` com pergunta como título, subtítulo "indicador · unidade · universo", gráfico, `LeituraGuiada`, tabela equivalente em `<details>`, fonte, ressalva e download com `SeloComConta`); `tabelas` (`TabelaDados`: cabeçalho semântico, ordenação com estado visível, zero, ausência e inelegibilidade distintos, rolagem só na tabela no celular); `controles` (sempre junto do conteúdo afetado, rotulados, com o recorte na URL pelo mecanismo `levar` da navegação); `notas` (`ParaLer`, glossário no ponto de uso); `metodo` (um só `<details>` no fim); `fim` (o fim de página único da I4).
3. Regras de forma que o kit impõe por tipo (TypeScript): número sem fonte e período não compila; figura sem tabela equivalente ou sem fonte não compila; estado de prontidão só por `SeloProntidao`; data sempre em `dd/mm/aaaa` ou `mmm/aaaa`, nunca ISO nem UTC na tela; texto só nas classes `.t-*`, `.numero-*` e `.rotulo`.
4. Migrar por grupos, um PR cada, com a lista `NO_MOLDE_PAINEL` crescendo como em `src/tests/suporte/entradas-molde.ts`: Grupo 1, as 12 páginas de destino do bloco "Para você" (`src/lib/observatorios/paraVoce.ts`) e o primeiro destino depois de "Início" de cada uma das 28 navegações (`navegacaoDaColecao`), por serem os mais procurados; Grupo 2, os 13 temas da Eficiência Estatal (90 componentes, a maior dívida); Grupo 3, Contas Federais, Saneamento, Gás e Agronegócio; Grupo 4, Território, Conectividade, Educação, Previdência, Custo de vida e Contas Estaduais; Grupo 5, o resto do Setor Elétrico que ainda não usa `PainelEvidencia`. O Crédito entra pela I2.
5. Retirar os aliases de token (`--obs-*`, `--cp-*`, `--ce-*`, `--cn-*`, `--edm-*`, `--pv-*`, `--atlas-*`, `--gravura-*`, `--ink`, `--line`, `--muted`, `--paper`) à medida que cada grupo migra, como o design system prevê para a "Iniciativa 6".

**Não fazer.** Não reescrever gráficos e tabelas de um domínio no PR do kit; o kit nasce do Setor Elétrico e os demais migram por grupo. Não alterar contrato de dado, cálculo nem texto decidido pelo dono. Não criar card com ícone, sombra ou gradiente (regras da `design-taste-frontend` para telas de trabalho).

**Testes.** Novo `src/tests/painel-molde.test.ts` (HTML do build, com sessão): fatias na ordem, H1 único e até 60 caracteres, todo `NumeroIndicador` com fonte, período e `data-natureza`, toda `FiguraAnalitica` com tabela e fonte, nenhum `font-size` fora da escala, nenhuma forma antiga de prontidão, nenhuma data ISO em texto visível. Inventário: toda rota de painel do registro está em `NO_MOLDE_PAINEL` ou em `A_MIGRAR` com o grupo. `design-tokens.test.ts` passa a reprovar os aliases retirados.

**Aceite.** Página migrada: axe 0, rolagem horizontal 0, cromo dentro do orçamento, HTML até 500 KB (ver I4), nota mínima 8 em cada critério da rubrica da skill, link compartilhado reproduz o recorte. Evidências antes e depois em `docs/ux-AAAA-MM-DD/painel-grupo-N/`.

### I2. O Crédito na mesma casca

**Move:** C3, C4, C6, C7. **Resolve:** A3. **Depende de:** I1 (para a etapa 2).

**Objetivo.** Quem entra numa vista do Crédito vê a mesma navegação, a mesma tipografia, o mesmo número, as mesmas ferramentas da conta e o mesmo fim de página das outras coleções, no celular e no desktop.

**Etapa 1, paridade de casca (sem migrar vistas).**

1. A barra lateral sai. No lugar dela, a navegação de coleção da plataforma, gerada do registro por `scripts/barra-spa.mjs` (que já gera a barra superior e a trilha a partir de `src/lib/observatorios/barraSpa.ts`): linha 1 com "Início" e os oito grupos de hoje ("Começar", "Ciclo do crédito", "Instituições e funding", "Produtos e preços", "Território e pessoas", "Risco, cobrança e recuperação", "Pagamentos, conduta e fronteiras", "Referência") e os atalhos Método e Glossário à direita; linha 2 com as vistas do grupo atual. Cada vista é `<a href="/observatorio/<caminho>">`; o roteamento pela History API intercepta o clique e continua funcionando, e sem JavaScript o link abre a vista (o route handler já serve qualquer caminho). Quando a vista pertence a outra coleção (as quatro de Famílias, Contas Públicas, Pagamentos e Empresas), a navegação mostrada é a dessa coleção (`navegacaoDaColecao('divida')` etc., que já apontam para as rotas da aplicação).
2. Retirar a "mobilebar", o bloco de marca "◆ Crédito e sistema financeiro · monitoramento · diagnóstico · previsão" e a frase "Este painel faz parte do Observatório X; quem o mantém é...": o `RotuloContexto` da plataforma (gerado no HTML da aplicação pelo mesmo script) diz isso.
3. Tipografia e números: aplicar a escala `.t-*` e as classes `.numero-*` em `styles.css`; os blocos de KPI passam à forma do `NumeroIndicador` (valor em serifa, unidade, período, fonte, selo, variação); datas em `dd/mm/aaaa` e `mmm/aaaa`; "processado em ... UTC" vai para o método; setas "→" e travessões saem da prosa. Os tokens `--cor-credito-*` são reconciliados com a paleta (a "Iniciativa 8" do design system).
4. Ferramentas da conta (Salvar recorte, Citar, Avisar quando atualizar) na barra, como nas páginas Next: a aplicação expõe o título da vista atual num atributo do `<main>`, e o script da barra lê dele.
5. Fim de página igual ao das páginas Next (ver I4): fontes e data, Início, Método, Glossário, outras coleções, parceria quando houver, rodapé da plataforma.
6. Corrigir o erro 403 do console presente nas vistas medidas e a violação `scrollable-region-focusable` a 390 px; medir o cromo a 390 px e trazer a medida para até 200 px.
7. Medir o uso das vistas na tabela agregada (`uso_paginas_dia`), com o mesmo envio de `MedeUso`, para a etapa 2 ter ordem de migração por uso.

**Etapa 2, migração.** As quatro entradas de coleção servidas pela aplicação (`/observatorio/payroll-lending-aging`, `/subnational-credit`, `/pix`, `/sectors`) viram páginas Next no molde `EntradaColecao`, e as cinco vistas mais usadas (pelo uso medido na etapa 1; sem medida, as cinco que o bloco "Para você" e as portas apontam: `/credit`, `/interest-rates`, `/institutions`, `/overview`, `/map`) viram `PaginaPainel`. O restante segue na aplicação até a Onda 3 da banca, agora com a mesma casca.

**Testes.** `src/tests/entrada-molde.test.ts` passa a incluir as quatro entradas em `NO_MOLDE`; `ux-orcamentos-cromo.test.ts` inclui `/observatorio/credit` e `/observatorio/payroll-lending-aging`; teste de que o HTML da aplicação não contém `class="sidebar"`, `mobilebar` nem `data-view` sem `href`; `observatorio-publico.test.ts` continua conferindo que as rotas e os títulos não divergem.

**Aceite.** Nenhuma segunda navegação na tela; cromo a 390 px até 200 px; console sem erro; axe 0; datas no formato da plataforma; o leitor que vem de Famílias vê a navegação de "Dívida e crédito das famílias".

### I3. Um só seletor de lugar e a preferência "Meu lugar"

**Move:** C1. **Resolve:** A7. **Depende de:** decisão do dono (seção 8, itens 1 e 2).

**Objetivo.** O leitor escolhe a cidade (ou o estado, a capital, a distribuidora) uma vez, do mesmo jeito em toda a plataforma, e a escolha o acompanha.

**O que fazer.**

1. `src/components/lugar/BuscaLugar.tsx`: um só componente com variantes (`municipio`, `uf`, `capital`, `distribuidora`), combobox acessível (o `BuscaMunicipio` do Saneamento já é a melhor base), que substitui os oito seletores de hoje. Um só índice, `/busca/lugares.json`, gerado no build de `src/lib/saneamento/municipios` mais a relação município/distribuidora da ANEEL (hoje em `/setor-eletrico/conta-de-luz/municipios.json`): código IBGE, nome, UF, se é capital, distribuidoras. Entra em `ARQUIVOS_DAS_CONSULTAS` (`rotasPublicas.ts`) no lugar dos dois índices de hoje. Carregado só no foco, como hoje.
2. Busca da plataforma reconhece lugar (Iniciativa 7): ao digitar "Recife", a lista mostra "Recife, PE" com as consultas do lugar (conta de luz, saneamento, escola, internet, INSS, custo de vida, queimadas), cada uma com o endereço já com `?ibge=` ou `?uf=`. O índice de lugares desce sob demanda, separado do índice de destinos, para não pesar o campo.
3. Preferência "Meu lugar" em `/app/conta`: município (opcional, código IBGE) e UF (já obrigatória no cadastro). Lida no servidor por `getSessionUser`, usada por: o bloco "Para você" das entradas e do mapa (números do lugar do leitor, com fonte e período, pelos mesmos leitores das consultas; sem leitor por lugar, o cartão vai sem número e com `semNumero`, como `paraVoce.ts` já faz); as consultas pessoais, que abrem já no lugar do leitor quando a URL não traz outro; a navegação de coleção, que generaliza o `levar` para um parâmetro `lugar` em toda coleção com consulta.
4. Páginas abertas: sem conta, o lugar vive na URL (como hoje nos aperitivos, com `?uf=` e `?territorio=`) e é levado na volta do login; depois do login, a página oferece "Guardar como meu lugar".

**Não fazer.** Não geolocalizar. Não tornar o município obrigatório. Não gravar o lugar sem a atualização da política de privacidade (decisão do dono).

**Testes.** Teste que reprova importação dos sete seletores antigos fora do kit; teste de que toda consulta pessoal do registro aceita `?ibge=` ou `?uf=` e lê a preferência; teste de que "Recife" na busca devolve as consultas de lugar com o código; `aperitivo.test.ts` segue conferindo que o índice de lugares é aberto pelo caminho exato.

**Aceite.** Um componente, um índice; no mapa logado, pelo menos três cartões com números do estado do leitor; a mesma cidade digitada no Saneamento aparece escolhida na Conta de luz e na Educação.

### I4. Orientação sem repetição, fim de página único e páginas leves

**Move:** C2, C5, C7. **Resolve:** A4, A5, A6, A9, A11, A12. **Depende de:** decisões do dono (seção 8, itens 4 e 5) para os passos 1 e 2; os demais não.

**O que fazer.**

1. Fim de página único: `src/components/layout/FimDeColecao.tsx` funde "Para ir além" e `RodapeColecao` num só bloco com, nesta ordem, fontes e data da coleção, Início, Dados, Método e Glossário (só os que a navegação não mostra na tela atual), as outras coleções do observatório e onde mais o painel aparece (do registro), e a parceria técnica onde houver. O rodapé da plataforma (`Footer`) fica com a marca, os seis observatórios (cada um levando à página aberta ou à entrada, conforme a sessão) e o institucional; as 28 coleções saem dele, porque estão no seletor, no mapa e na busca. Decisão do dono: reverte a coluna por observatório da Iniciativa 1.
2. Rótulo acima do H1: quando a trilha está na tela (toda página de coleção), o `RotuloContexto` deixa de repetir observatório e coleção e passa a dizer só o que a trilha não diz: o grupo e a posição da página ("Preços e mercado · 1 de 4") ou nada, na entrada. Nas páginas abertas fora da barra (portas), continua como hoje. Decisão do dono: muda a regra da Iniciativa 1.
3. Navegação do dono da rota: em toda página cujo dono no registro é uma coleção de outro observatório (`/agronegocio/prato`, `/agronegocio/ambiente`, as vistas do Crédito de Famílias, Contas Públicas, Pagamentos e Empresas, as cópias com `duplicataDe`), o layout renderiza `NavegacaoColecao` da coleção dona, não a da pasta. O rótulo acima do H1 também. Teste: para toda rota de `paineis()` com `observatorio` diferente do principal da origem, o `aria-label` da navegação nomeia a coleção dona.
4. Vocabulário da folha: "página" para a unidade e "painel" para a página com dados; "aba", "vista" e "módulo" saem de todo texto visível (teste por grep em `src/components` e `src/app`, com a lista de exceções vazia); "capítulo" fica só como nome de grupo nas coleções organizadas assim. "Encontre o painel" permanece. A aplicação do Crédito renomeia "Mapa do Observatório" para "Início".
5. Peso: toda página de painel entrega até 500 KB de HTML. As nove acima de 1 MB (lista no achado A6) passam a carregar os dados de comparação e as tabelas longas sob demanda, por rota de servidor fechada (padrão `*TabelasSobDemanda` do Setor Elétrico), com o resumo e a primeira tabela no HTML. Teste `ux-peso-html.test.ts` sobre `.next/server/app`, com lista de exceções declaradas e justificadas.
6. Higiene: achar o link de destino fechado sem `prefetch={prefetchDoLink(href)}` que faz a requisição cair em `/entrar` nas páginas abertas (home, `/observatorio-do-credito`, `/perguntas/*`, `/buscar`) e a chamada que responde 401 no console sem sessão (provável `/api/auth/eu` em vez de `/api/auth/estado`); corrigir o contraste em `/app/conta` (axe, 2 nós).
7. Busca local: o segundo campo de busca numa entrada ou no mapa só aparece com o rótulo do filtro visível ("Buscar só no Setor Elétrico") e o link "Buscar em toda a plataforma"; sem filtro, não há segundo campo.

**Testes.** `vocabulario.test.ts` ganha a regra da folha; `navegacao-colecao.test.ts` ganha o teste do dono; novo `ux-peso-html.test.ts`; `evidencias` das páginas abertas com zero requisições em `/entrar` e console limpo entra como critério no `evidencias.mjs` (coluna já existe).

**Aceite.** Em `/setor-eletrico/pld`, o nome do observatório e da coleção acima do H1 aparece no máximo duas vezes (seletor e trilha); fim de página com um só bloco antes do rodapé; rodapé com até 20 links; nenhuma página acima de 500 KB sem exceção declarada; zero requisições de página aberta em `/entrar`.

### I5. Um só contrato para artefatos, figuras, mapas e imagens

**Move:** C8, C3. **Resolve:** A8, A10. **Depende de:** I1 (envelopes do kit) e decisão do dono (seção 8, itens 6 e 7).

**O que fazer.**

1. Envelopes: todo artefato interativo de página de painel passa para `ModeloDidatico` (simulação, laboratório, cenário: rótulo fixo, título, corpo, "o que este modelo deixa de fora") ou para o novo `Consulta` (dado real do caso do leitor: pergunta, `BuscaLugar` ou controle, resultado com `NumeroIndicador`, fonte e período, "o que não permite concluir"). Nenhum laboratório fora de envelope. Teste por `data-modelo-didatico` e `data-consulta`.
2. Figuras: `src/components/painel/Figura.tsx`, um só contrato para imagem raster: proporção fixa por uso (3:2 na abertura, 16:9 em faixa), legenda no mesmo lugar e na mesma forma ("Ilustração conceitual · <tema>" com a origem no `alt` e no manifesto, não no texto), nunca a mesma imagem duas vezes na mesma página. As oito gravuras ganham manifesto em `public/arte/manifesto.json` (origem, data, direção, sha256) e perdem o `-v1` do nome; a decisão de finalizar ou aposentar é do dono. Recomendação: aposentar as paisagens raster das entradas e manter como assinatura visual os diagramas em SVG (`CadeiasInfra`, `CircuitoCredito`, `ImpostoResultado`, `OrcamentoFamilia`, `RecursoResultado`), que já têm o estilo da casa e funcionam a 390 px; a faixa escura "Do reservatório à sua tomada" fica como exceção documentada do Setor Elétrico.
3. Mapas: `src/components/painel/MapaBrasil.tsx`, uma base única com as geometrias de UF e município já publicadas, escala sequencial só dos tokens `--escala-*`, legenda com os limites escritos, tabela equivalente obrigatória e teclado; os 15 componentes de mapa de hoje (`MapaUf`, `MapaCoropletico`, `MapaCalor`, `MapaSubmercados`, `TerritorioMapa`, `MapaServicos`, `MapaCobertura`, `PerdasMapa`, `QualidadeMapa`, `AguaMapaBacias`, `GeracaoMapaUsinas`, `ExpansaoMapas`, `EmpresasMapaAtivos`, `ListadasMapaUf`, `RedeMapaFluxos`) passam a usar a base e ficam só com a camada de dados.
4. Gráficos: a família `Grafico*` do kit segue a skill `dataviz` (paleta validada do design system, rótulo direto, legenda só quando o rótulo não resolve, eixo em zero nas barras, lacuna para ausência); cada gráfico com `LeituraGuiada`.
5. Glifos: um só conjunto em `src/components/ui/Glifo.tsx` (cadeado, seta, mais/menos, os quatro de prontidão, os cinco de natureza), em 16 e 20 px; os SVGs inline espalhados saem.
6. Índice de página: um só `IndiceDaPagina` (sumário "Nesta página") para substituir os chips numerados do Saneamento e as seções "01 ·" das Contas; numeração só se o dono decidir que ela fica nos painéis.

**Testes.** Teste de inventário: nenhuma `<img>` fora de `Figura`; nenhuma imagem repetida na mesma página; nenhum `<svg>` de mapa fora de `MapaBrasil`; artefatos só em envelope. `design-tokens.test.ts` reprova cor de escala usada em texto.

**Aceite.** Nenhuma gravura provisória ou repetida; todo mapa com tabela e teclado; todo laboratório com "o que deixa de fora"; nota mínima 8 em "Direção de arte" e "Didática visual" na rubrica, página por página.

## 6. Iniciativas do mapa da área logada

O mapa (`/app/observatorios`) é a página inicial de quem tem conta e o destino de todo login. As duas iniciativas abaixo o levam a "perfeito" pelo critério da skill: a tarefa do leitor resolvida na primeira tela, nada anunciado que não exista, tudo medido.

### M1. Arquitetura e interação do mapa

**Move:** C1, C2, C4, C5. **Resolve:** A1, A9, A12. **Depende de:** nada (a UF do perfil, usada no "Para você", depende da decisão 1 da seção 8; sem ela, o bloco sai sem números).

**Tarefa da página, em uma frase.** Quem acabou de entrar decide em uma tela para onde vai; quem volta retoma de onde parou.

**Anatomia, nesta ordem (cada fatia com `data-fatia`, no molde de `EntradaColecao`, tipo `conta`):**

1. `retomar` (só quando há algo; nunca estado vazio): "Continuar em <título da página>", com coleção e data, como cartão; até três últimas páginas; até três recortes salvos com título; o número de avisos configurados com link. Sem nada para retomar, a fatia não existe no HTML. (A M2 enriquece; na M1, o cartão usa o cookie de último acesso de hoje.)
2. `abertura`: H1 "Encontre o painel" (mantido, decisão do dono registrada em `navegacao-colecao.test.ts`), uma frase ("28 coleções em seis observatórios; busque, ou escolha abaixo") e a busca da plataforma em largura total no celular e até 44 rem no desktop, com o rótulo "Busca em toda a plataforma". Sem o parágrafo de inventário e sem a legenda dos selos na primeira tela: vão para o método.
3. `para-voce`: "Para você" com os cartões do lugar do leitor: pelo menos "Quanto custa encher o tanque em <UF>", "Botijão de gás em <UF>", "Violência em <UF>" e "Contas do estado de <UF>", cada um com número, fonte e período lidos pelos leitores das consultas por estado (`src/lib/combustiveis`, `src/lib/gas`, `src/lib/eficiencia/seguranca`, `src/lib/contas-estaduais`), mais as consultas por cidade como links sem número ("Minha cidade: conta de luz, saneamento, escola, internet, INSS, custo de vida, queimadas"), até a I3 trazer o município. Mesmo componente `ParaVoce` das entradas.
4. `destinos`: o diretório, em grade de verdade: seis seções na ordem do registro, uma por observatório, nunca quebradas entre colunas (`display: grid`, não `columns`). Cabeçalho da seção: nome do observatório como link para a entrada e a pergunta dele. Dentro, uma linha por coleção, em três colunas a partir de 1024 px, duas a 768 e uma a 390: nome como link (`href` da coleção), a pergunta curta (o resumo do índice da busca), uma linha de estado "N páginas · dados até dd/mm/aaaa" (do inventário e do frescor da coleção) e o `SeloProntidao` só quando a coleção não é "publicado". As páginas de cada coleção ficam num `<details>` "As N páginas" dentro da linha, em lista vertical com alvos de 44 px, não inline; "cobertura parcial" aparece uma vez por página parcial, pelo selo, nunca em texto repetido. "só o painel de entrada" sai: a linha mostra "1 página".
5. `metodo`: um `<details>` "Como este mapa é montado": o inventário (28, 123, 13, 4), a legenda dos selos, fontes e atualização de cada coleção (a seção "Fontes e atualização" de hoje, por coleção e não por domínio) e a nota de que ausência é declarada.

**Interação.**

- Todo destino é `<a href>`; nenhum `<form method="post">` no diretório. O último acesso passa a ser gravado pelo middleware (`src/middleware.ts`), que já roda em toda página: quando o caminho começa por um `href` de coleção de `src/lib/observatorios/lista.ts` (arquivo compatível com o Edge), grava o cookie `COOKIE_OBSERVATORIO` com observatório e coleção. O evento de telemetria "observatório aberto" passa para um `sendBeacon` no clique (componente `LinkMedido`, como `MarcaVisita`). O POST `/app/observatorios/entrar` fica só para compatibilidade de um ciclo e sai depois.
- A busca mantém "Enter abre o primeiro resultado", mas o primeiro resultado ganha destaque visível na lista para o leitor saber o que o Enter vai abrir.
- Tipografia pela escala única (`.t-h1`, `.t-h2`, `.t-corpo`, `.t-meta`, `.rotulo`): sem 12,5, 13,5 ou 15,5 px; `escolha.module.css` e `DiretorioPaineis.module.css` são reduzidos ao que a escala não cobre (a grade).
- Celular: as seis seções em acordeão aberto por padrão, cada linha de coleção com 44 px; o `retomar` e o `para-voce` antes do diretório; a busca abre a folha em tela cheia como na barra.

**Orçamento.** Cromo até 230 e 200 px (já cumprido); altura até 3.500 px a 1440 e 7.000 a 390 (o mesmo das portas); o H1 na primeira tela; o primeiro cartão do "Para você" abaixo de 900 px a 1440.

**Testes.** Novo `src/tests/mapa-conta.test.ts` (HTML do build com sessão): fatias na ordem; cada uma das 28 coleções de `lista.ts` aparece exatamente uma vez como `<a href="<href da coleção>">`; os seis observatórios na ordem do registro, cada um com link para a entrada; nenhum `<form method="post">` dentro de `data-fatia="destinos"`; nenhum nome de domínio legado (`nomeLegado` de `dominios.ts`) no HTML; nenhuma das frases de estado vazio ("ainda sem último acesso", "nenhum ainda", "nenhum configurado") no HTML quando não há o que retomar; todo cartão do "Para você" com fonte e período ou `semNumero`; contagem de páginas por coleção igual ao inventário. `ux-orcamentos-comprimento.test.ts` ganha `mapa: { 1440: 3500, 390: 7000 }`. `ux-orcamentos-cromo` e `ux-texto-minimo` já cobrem a rota. `judiciario-seletor.test.ts` muda de propósito quando o POST sair.

**Aceite.** Na primeira tela a 1440 px, sem rolar: retomar (quando houver), H1, busca e os cartões do "Para você"; nenhum observatório quebrado; nenhuma coleção sem link direto; nenhum texto de inventário antes do diretório; nota 9 em Hierarquia, Interação e Responsividade na rubrica, por revisão independente (outra sessão), não autoavaliação.

### M2. A camada pessoal do mapa

**Move:** C1. **Resolve:** A1 (parte de quem volta), A7. **Depende de:** M1, decisão do dono (seção 8, itens 1 a 3) e, para os números por cidade, I3.

**O que fazer.**

1. Últimas páginas: tabela `paginas_recentes` (`user_id`, `caminho`, `titulo`, `observatorio`, `colecao`, `visto_em`), gravada pelo mesmo envio de `MedeUso` quando há sessão, com no máximo 10 linhas por pessoa (as mais antigas saem) e expurgo de 90 dias. Só o dono da conta lê. A fatia `retomar` mostra a última como "Continuar" e as três seguintes como lista. O caminho guarda a consulta (`?ibge=`), como os recortes salvos já fazem; a política de privacidade passa a dizer isso (decisão do dono).
2. Recortes salvos e avisos: até três recortes com título e coleção; "todos" leva a `/app/conta#recortes`. Avisos: "Avisar quando atualizar: 2 fontes" com link; sem aviso configurado, nada aparece (o convite fica em `/app/conta`).
3. Novidades desde a última visita: para cada coleção cujo dado foi publicado depois de `visto_em` da última visita do leitor (datas de `dadosFrescor`, `src/lib/frescor`), uma linha "Atualizado desde a sua visita: Setor Elétrico, dados de 28/09/2026 publicados em 19/10/2026". No máximo cinco; o resto em "ver todas". Atraso declarado continua declarado ("atualização atrasada há 22 dias").
4. Meu lugar: os cartões do "Para você" passam a usar o município quando a I3 estiver em produção; até lá, a UF.
5. `/app/conta` e `/app/admin` passam à mesma grade e à mesma escala do mapa (hoje usam cartões com borda e `PageTitle` próprios), para a área da conta ser uma só superfície.

**Testes.** `paginas_recentes`: limite de 10, expurgo, nenhuma leitura fora do dono; a fatia `retomar` existe só com conteúdo; novidades só com data posterior à visita; snapshot das três páginas da conta com a mesma barra, a mesma escala e axe 0.

**Aceite.** Quem volta vê, sem rolar, onde parou e o que mudou; quem chega pela primeira vez não vê nenhum estado vazio; a conta inteira com uma só gramática visual.

## 7. Fila para produção

Em 23/10/2026 há um PR aberto.

| PR | O que muda | Estado | Risco para o leitor | Recomendação |
|---|---|---|---|---|
| #362 "Ciclo: skill de layout em núcleo e anexos, política de texto literal e decisões das propostas" (branch `claude/fervent-noether-v3u4hs`, head `f65e18e`, 14 arquivos, +375/−227) | Divide `.claude/skills/observatorio-layout/SKILL.md` em núcleo (13.970 bytes) e oito anexos sem alterar texto (prova por `scripts/skill-cobertura.mjs`: 0 linhas ausentes); registra a política de testes de texto literal; registra a decisão de não tirar os dados pesados do git; ajusta `CLAUDE.md` e `AGENTS.md`; novo `src/tests/skill-layout.test.ts` | CI verde às 06:50 UTC de 23/10 (lint, tipos, cobertura, build e Vitest nas duas metades); revisão Codex com um achado P2 (ref padrão do script sem `origin/main`), corrigido em `9adccfe` e resolvido; preview da Vercel pronto | Nenhum: não há mudança de HTML, CSS, dado ou rota | Fazer o merge antes de começar as iniciativas: muda o que o implementador deve ler (núcleo mais anexos do tema). Conferir, no merge, que `src/tests/skill-layout.test.ts` continua verde com este parecer em `docs/` (o teste confere índice e pasta `anexos/`, não `docs/`) |

Observação para o implementador: depois do merge, as regras de navegação, molde e acesso citadas neste parecer estão nos anexos `navegacao.md`, `arquiteturas.md`, `acesso.md` e `componentes-e-graficos.md`; ler os anexos do tema tocado, não só o núcleo.

## 8. Decisões do dono e requisitos prévios

Nada abaixo é implementado sem resposta na conversa.

1. **Usar a UF do perfil no "Para você" do mapa e das entradas.** A UF é obrigatória no cadastro; mostrar com ela os números do estado é uso novo de dado pessoal e pede uma linha na política de privacidade. Recomendação: sim, com a linha "a UF informada no cadastro escolhe os números do seu estado nas páginas iniciais".
2. **Município opcional como "Meu lugar"** (I3): campo novo, opcional, apagável; política de privacidade atualizada. Recomendação: sim.
3. **Últimas páginas por pessoa** (M2): tabela nova, 10 linhas, 90 dias; política atualizada. Recomendação: sim.
4. **Fim de página único e rodapé sem as 28 coleções** (I4, passo 1): reverte a coluna por observatório do rodapé da Iniciativa 1. Recomendação: sim; as 28 ficam no seletor, no mapa e na busca.
5. **Rótulo acima do H1 sem repetir a trilha** (I4, passo 2): muda a regra da Iniciativa 1. Recomendação: sim nas páginas com trilha; mantido nas portas.
6. **Gravuras**: finalizar as oito como definitivas (manifesto, sem "v1", um estilo) ou aposentar todas em favor dos diagramas SVG (I5). Recomendação: aposentar as paisagens das entradas; manter a faixa escura do Setor Elétrico como exceção.
7. **Numeração de seções nos painéis** ("01 ·", "1 2 3"): manter ou retirar, como foi retirada dos cartões da home em 22/10. Recomendação: retirar; ordem pela posição e pelo sumário.
8. **Nome da folha**: "painel" para página com dados e "página" para a unidade; banir "aba", "vista" e "módulo". Recomendação: sim.
9. **Medição de uso anônima** (`USO_ANONIMO_ATIVO=1`, base legal da opção B de `MEDICAO_DE_USO.md`) e medição da aplicação do Crédito: sem isso, a ordem de migração do I1 e do I2 fica por inferência. Recomendação: ligar com a nova versão da política.
10. **Ordem de execução**: a seção 9 começa pelo mapa. Alternativa: começar pelo I1 (kit), que é a maior obra. Recomendação: o mapa, por ser a porta de todo mundo e caber em um PR.
11. **Versionar o parecer de 21/10/2026** (A13), ou apontar os testes e scripts para este.

Requisitos prévios sem decisão: merge do PR #362; `bash scripts/preparar-sessao.sh` em toda sessão; build de produção para os testes de UX (`EXIGIR_BUILD_HTML=1` no CI).

## 9. Ordem de execução, PRs e critério de pronto

| Ordem | PR | Iniciativa | Conteúdo | Verificação que o PR precisa mostrar |
|---|---|---|---|---|
| 1 | Mapa 1 | M1 | Anatomia nova do mapa, links no lugar dos formulários, cookie pelo middleware, "Para você" por UF (ou sem números até a decisão 1), método recolhido | `mapa-conta.test.ts`, comprimento, cromo, texto mínimo, evidências a 390 e 1440 com sessão, revisão independente da rubrica |
| 2 | Fluidez 1 | I4 (1, 2, 4, 7) | Fim de página único, rodapé enxuto, rótulo sem repetição, vocabulário da folha, busca local com rótulo | `vocabulario.test.ts`, evidências de três páginas de coleção e uma entrada |
| 3 | Fluidez 2 | I4 (3, 6) | Navegação do dono da rota; higiene das páginas abertas; contraste da conta | teste do dono em `navegacao-colecao.test.ts`; evidências das páginas abertas com zero `/entrar` e console limpo |
| 4 | Fluidez 3 | I4 (5) | Dados sob demanda nas nove páginas acima de 1 MB; teste de peso | `ux-peso-html.test.ts`; tamanho antes e depois na descrição do PR |
| 5 | Kit | I1 (1 a 3) | `src/components/painel/`, com o Setor Elétrico migrado em dois ou três painéis de prova | `painel-molde.test.ts` com os primeiros painéis |
| 6 a 10 | Painéis grupo 1 a 5 | I1 (4, 5) | Migração por grupo; aliases de token retirados | lista `NO_MOLDE_PAINEL` crescendo; evidências por grupo |
| 11 | Lugar 1 | I3 (1, 2) | `BuscaLugar`, índice único, lugares na busca | testes do I3 |
| 12 | Lugar 2 | I3 (3, 4) | Preferência "Meu lugar", `levar` generalizado, consultas lendo a preferência | idem; política publicada antes |
| 13 | Mapa 2 | M2 | Últimas páginas, recortes, novidades, conta na mesma grade | testes do M2 |
| 14 | Figuras | I5 (1, 2, 5, 6) | Envelopes, `Figura`, manifesto, glifos, índice de página | inventário de imagens e artefatos |
| 15 | Mapas | I5 (3, 4) | `MapaBrasil` e família `Grafico*` | tabela equivalente e teclado em todo mapa |
| 16 | Crédito 1 | I2 etapa 1 | Paridade de casca da aplicação | cromo a 390 até 200; console limpo; testes do I2 |
| 17 em diante | Crédito 2 | I2 etapa 2 | Quatro entradas e cinco vistas em Next | `entrada-molde` e `painel-molde` |

**Critério de pronto do conjunto.** Os oito critérios da seção 3 medidos de novo, com os mesmos comandos; nenhuma página de painel abaixo de 8 em qualquer critério da rubrica da skill; o mapa com 9 em Hierarquia, Interação e Responsividade por revisão independente; a aplicação do Crédito dentro do orçamento de cromo; zero componente de abertura, número, tabela, mapa ou seletor de lugar fora do kit; e o parecer seguinte, feito sobre produção, com dado de uso.

## Anexo A. Inventário medido (23/10/2026, `main` em `b825eb9e3`)

| Medida | Valor | Como foi medido |
|---|---|---|
| Rotas de página | 365 (267 pt, 98 en) | `find src/app -name page.tsx` |
| Observatórios e coleções | 6 e 28 | `src/lib/observatorios/lista.ts` |
| Páginas no mapa logado | 123 publicadas, 13 parciais, 4 previstas | HTML de `/app/observatorios` no build |
| Componentes por domínio (arquivos .tsx) | `energia` 264, `eficiencia` 90, `contas-publicas` 34, `agro` 20, `observatorios` 19, `saneamento` 16, `layout` 16, `ui` 9, `evidencia` 9 | `find src/components/<dir> -name '*.tsx'` |
| Aberturas de página | 9 (`CabecalhoModulo` com 75 usos, `Abertura` ×4, `AberturaGas`, `AberturaCredito`, `AberturaAgro`, `AberturaJudiciario`) | grep de `export function` |
| Faixas de números ou respostas | 19 funções exportadas com nome em Numero, Faixa, Destaque, Resposta ou Escala (sem a `FaixaFrescor`) | grep de `export function` |
| Tabelas | 9 componentes `Tabela*` em 3 domínios; `<table` em arquivos de 16 pastas | grep |
| Gráficos | 0 bibliotecas; 52 arquivos com `<svg viewBox` | grep |
| Mapas | 15 componentes | nomes de arquivo |
| Seletores de lugar | 8 componentes, 2 índices de município | grep |
| `PainelEvidencia` / `SeloNatureza` | 10 / 34 arquivos (33 do Setor Elétrico) | grep |
| CSS | `globals.css`, 19 módulos CSS, `observatorios.css` 39 KB, `observatorios-gravuras.css` 11 KB, `obs/styles.css` 94 KB, `obs/atlas.css` 23 KB, `obs/tokens.css` 6 KB | `ls -la` |
| Aplicação do Crédito | `app.js` 1.279 KB, 42 vistas na barra lateral, 49 rotas em `observatorioAbas.ts` | `wc -c`, grep |
| Gravuras | 8 WebP `-v1` em 3 pastas | `ls public/*/arte` |
| HTML gerado no build (pt) | 681 arquivos; 9 acima de 1 MB; 76 acima de 500 KB; maior 7.893 KB | `find .next/server/app -size` |
| Entradas: `<details>` e links | `/setor-eletrico` 54 e 495; `/eficiencia-estatal` 25 e 191; `/contas-publicas` 15 e 155; `/observatorios/familias` 4 e 159 | grep no HTML |
| Fim de página em `/setor-eletrico/pld` | Para ir além 6 links; rodapé da coleção 8; rodapé da plataforma 10 KB e 56 links | script Python sobre o HTML |
| Testes que citam `docs/PARECER_UX_2026-10-21.md` | 4 testes e 2 scripts; arquivo inexistente | grep |

## Anexo B. Evidências visuais

Capturas e tabelas em `docs/ux-2026-10-23/evidencias/` (`evidencias-com-sessao.md`, 13 rotas com sessão; `evidencias-abertas.md`, 6 rotas com e sem sessão; 21 capturas selecionadas). Comando: `npm run evidencias -- --rotas <rotas> --saida <pasta> --larguras 390,1440 --modos com` (e `--modos sem,com` para as abertas). Máquina: 4 vCPU, 16 GB; 26 páginas com sessão em 4 min 22 s e 24 páginas abertas em 1 min 16 s.

Cromo até o conteúdo (px) nas páginas com sessão, orçamento 230 a 1440 e 200 a 390:

| Rota | 1440 | 390 | Axe | Console |
|---|---|---|---|---|
| `/app/observatorios` | 151 | 102 | 0 | 0 |
| `/app/conta` | 151 | 102 | contraste (2) | 0 |
| `/observatorios/familias` | 177 | 150 | 0 | 0 |
| `/setor-eletrico` | 222 | 195 | 0 | 0 |
| `/setor-eletrico/pld` | 228 | 183 | 0 | 0 |
| `/eficiencia-estatal/saude-capitais` | 187 | 138 | 0 | 0 |
| `/contas-publicas/execucao` | 228 | 183 | 0 | 0 |
| `/saneamento/esgoto` | 228 | 183 | 0 | 0 |
| `/observatorio/credit` | 142 | **727** | 0 | 1 (403) |
| `/observatorio/payroll-lending-aging` | 142 | **727** | região rolável sem foco (3) a 390 | 1 (403) |
| `/agronegocio/prato` | 228 | 183 | 0 | 0 |
| `/gas-natural/precos` | 228 | 183 | 0 | 0 |
| `/custo-de-vida` | 222 | 195 | 0 | 0 |

Páginas abertas, sem sessão: cromo entre 101 e 163 px; `/`, `/observatorio-do-credito`, `/perguntas/familias` e `/buscar` com uma requisição em `/entrar?_rsc=` e um erro 401 no console (dois em `/perguntas/familias`); `/saneamento/municipio` e `/setor-eletrico/conta-de-luz` limpas. Com sessão, `/` leva a `/app/observatorios`.

Leitura das capturas, pela rubrica da skill (seção 10), autoavaliação sobre a imagem, não revisão independente:

| Página | Direção de arte | Hierarquia | Tipografia | Densidade | Didática | Comparabilidade | Interação e acessibilidade | Responsividade | O que derruba |
|---|---|---|---|---|---|---|---|---|---|
| `/app/observatorios` | 7 | 5 | 6 | 5 | 6 | n/a | 6 | 6 | Estados vazios antes do H1; metade direita vazia; observatório quebrado entre colunas; 140 links de 12,5 px; formulários no lugar de links |
| `/observatorios/familias` | 8 | 8 | 8 | 8 | 9 | 8 | 8 | 8 | Nome do observatório cinco vezes acima do H1 |
| `/setor-eletrico/pld` | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 7 | Cinco faixas de cromo; rótulos de gráfico a 390 px (já registrado em 20/10) |
| `/eficiencia-estatal/saude-capitais` | 7 | 7 | 7 | 8 | 8 | 8 | 8 | 7 | Subtítulo longo em serifa; anatomia própria do domínio |
| `/contas-publicas/execucao` | 7 | 7 | 7 | 7 | 7 | 8 | 7 | 7 | Prontidão escrita à mão; botão de recorte duplicado; seções numeradas |
| `/gas-natural/precos` | 7 | 6 | 7 | 6 | 7 | 7 | 8 | 7 | Números só em prosa; frase em inglês na fonte |
| `/observatorio/credit` | 6 | 6 | 6 | 6 | 7 | 8 | 6 | 5 | Segundo produto: barra lateral, 727 px de cromo no celular, datas ISO, números em sans |
| `/` (sem sessão) | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | Nada novo desde 20/10 |
| `/saneamento/municipio` (sem sessão) | 7 | 8 | 8 | 7 | 8 | n/a | 8 | 8 | Metade direita vazia ao lado da busca (já registrado em 20/10) |
