# Revisão visual independente final — Educação PR2

Revisão somente leitura de 25/10/2026, segundo §10 da skill observatorio-layout. Nenhum build, teste, servidor ou navegador executado por este revisor. Não alterei worktrees.

## Cobertura efetivamente aberta

Abri as 30 capturas completas das cinco rotas/estados alterados em `depois`, nas larguras 390/768/1440 e nas duas condições de sessão. Os mapas autenticados 390/768 já haviam sido abertos na revisão parcial deste mesmo diretório; os demais foram abertos nesta rodada. Não afirmo ter reaberto as 18 capturas das capitais inalteradas, nem as 30 primeiras telas separadas.

| Prefixo dos arquivos | Rota/estado | Larguras | Sessões |
|---|---|---|---|
| educacao_municipal | Entrada sem município |390,768,1440| com e sem |
| educacao_municipal_ibge_2800100 | Entrada com Amparo do São Francisco |390,768,1440| com e sem |
| educacao_municipal_ibge_2611606 | Entrada com Recife |390,768,1440| com e sem |
| educacao_municipal_municipio_2800100 | Ficha de Amparo / aperitivo após redirecionamento |390,768,1440| com e sem |
| educacao_municipal_mapa | Mapa Brasil, anos iniciais / Entrar após redirecionamento |390,768,1440| com e sem |

Os arquivos seguem `{prefixo}-{largura}-{com|sem}-sessao.jpg`. Li também `evidencias.md`, inclusive definição da métrica Login e o erro de console ao final.

## Observações e correções anteriores

As entradas autenticadas com cidade mostram o extrato municipal antes dos quatro números nacionais. Nome longo de Amparo quebra sem sobreposição; as duas etapas e referências estadual/nacional permanecem presentes. A ficha é acessível pelo link explícito do extrato. Os estados anônimos mantêm resultado local e convite com os recursos do painel completo, sem expor análises privadas. Recife também oferece o destino das capitais, marcado como dependente de conta.

A entrada sem cidade preserva a estrutura autorizada. Os novos resumos de metas e década aparecem recolhidos, com títulos e descrições claros e sinal de expansão. As capturas finais fechadas não provam visualmente a retirada do título interno duplicado; o agente principal informou essa correção por `mostrarTitulo=false`. A revisão anterior dos 18 blocos abertos continua sendo a evidência de legibilidade dos detalhes, com essa limitação de versão expressamente preservada.

A ficha autenticada conserva séries completas das duas etapas, componentes N/P/Saeb, modelo, decomposição, oito metas, comparação com porte, quatro histogramas Brasil/UF, composição de matrículas, tabela e downloads. O estado padrão da decomposição é 2019→2025, anos iniciais, Amparo: explica variação do produto menor que 0,05 e mostra movimentos dos componentes sem forçar percentuais de contribuição. As metas sem Ideb mantêm razões textuais, e as edições 2023/2025 ficam claramente fora do ciclo de metas.

Os novos histogramas Brasil/UF mostram eixo X comum 0–10 e Y próprio, com contagens e medianas; as distribuições por porte já existentes conservam o formato anterior. Os pequenos múltiplos novos e barras de matrícula têm detalhamento complementar nos recortes anteriormente revisados em `blocos-intermediarios`. A variação tipográfica do SVG compacto ampliado em 1440 continua sendo polimento leve já registrado, não um novo bloqueio. A folha completa da ficha 390 mede 18528px e foi reduzida para 126×6000 pelo visualizador: serve para conferir sequência, não para certificar cada rótulo pequeno. Os recortes específicos são essenciais para essa última conclusão.

O mapa autenticado cabe nas três larguras. Em1440, tabela fica à direita; em 390/768 passa para baixo. A legenda contém 20 classes fixas de meio ponto, contagem e hachura para ausência; no celular fica longa, mas não sobreposta. Universo 5571, cobertura 5320, ausências 251 e seus motivos estão visíveis. O quadro declara que resultado não demonstra causa/gestão. Busca e zoom são identificáveis. A tabela tem viewport com rolagem interna, região focável e limite de altura, conforme confirmação do agente principal; a linha parcial no fim e coluna além do viewport estreito não comprovam perda de dados.

## Defeito restante concreto

Pequeno problema de redação, sem alterar valores: o resumo sob o mapa repete a unidade em cada extremo: «Valores de 3,3 Ideb, de 0 a 10 a 10,0 Ideb, de 0 a 10». Isso aparece também em 1440. Sugestão: formatar extremos como números e declarar unidade/escala uma única vez. Não observei bloqueio visual adicional. Não recomendo mudanças cosméticas sem finalidade.

## Acesso e evidência de execução

A ficha sem sessão redireciona para `/educacao-municipal?ibge=2800100` e mostra o aperitivo de Amparo. O mapa sem sessão mostra Entrar nas três larguras, com destino `/entrar?de=%2Feducacao-municipal%2Fmapa`; o agente principal confirmou teste HTTP 307. É acesso restrito correto, não mapa público. Não atribuo notas de visualização do mapa às imagens de login.

A métrica Login=0 da coleta significa que nenhuma requisição secundária de arquivos/dados caiu em Entrar; exclui o redirecionamento principal, registrado na coluna Endereço final. Portanto, não significa que nenhuma rota anônima abriu o login.

O relatório automatizado registra axe 0 e ausência de rolagem horizontal em todos os casos. O agente principal informou três testes de navegador aprovados para mapa, incluindo recarga da URL após esperar o SVG. São execuções de outro agente, não interação manual independente minha.

Preservo a ocorrência do lote: mapa autenticado 1440 teve 1 erro de console, `Failed to fetch RSC payload ... /eficiencia-estatal/educacao-municipal-capitais/metodos`, com `ChunkLoadError: Loading chunk 70769 failed` e fallback para navegação. A imagem do mapa está íntegra. A repetição isolada em `repeticao-mapa` estava sem resultado disponível quando conferi; não declaro o erro resolvido nem elimino a ocorrência por parecer transitória.

## Rubrica por rota/estado

Notas para 390/768/1440 juntas, restritas à evidência descrita. 9 significa critério demonstrado; 10 exigiria evidência adicional de excepcionalidade. NV significa falta de verificação, não defeito. Interação/acessibilidade fica NV porque esta rodada é estática; axe não substitui teclado/toque e inspeção manual exigidos pelo §10.

| Rota/estado | Arte | Hierarquia | Tipografia/acabamento | Densidade/profundidade | Didática | Comparabilidade | Interação/acessibilidade | Responsividade |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Entrada sem cidade, anônima |9|9|9|9|9|9|NV|9|
| Entrada sem cidade, autenticada |9|9|9|9|9|9|NV|9|
| Entrada Amparo, anônima |9|9|9|9|9|9|NV|9|
| Entrada Amparo, autenticada |9|9|9|9|9|9|NV|9|
| Entrada Recife, anônima |9|9|9|9|9|9|NV|9|
| Entrada Recife, autenticada |9|9|9|9|9|9|NV|9|
| Ficha Amparo, autenticada |9|9|9*|9|9|9|NV|9*|
| Ficha Amparo, anônima → aperitivo |9|9|9|9|9|9|NV|9|
| Mapa Brasil AI, autenticado |9|9|9|9|9|9|NV|9*|
| Mapa anônimo → Entrar |—|—|—|—|—|—|NV|—|

*Ficha: composição completa mais recortes específicos anteriores sustentam a nota; não certifico cada pixel da captura390 reduzida. Mapa: estrutura responsiva comprovada nas imagens e sem overflow de página segundo a coleta; operação de rolagem interna não foi executada por mim.

Arte: paleta, regras, tipos e estados consistentes, sem decoração gratuita. Hierarquia: pergunta/resultados antes das análises e detalhes; cidade precede agregado quando escolhida. Acabamento: nomes e controles acomodados; sinais de expansão distinguíveis. Densidade: análises preservadas, detalhes em seções identificadas e tabelas extensas recolhidas/roláveis. Didática: conceitos, universos, ausência e limites causais explícitos. Comparabilidade: referências nomeadas, escalas comuns nos novos pares, contagens e ausência não convertida em zero. Responsividade: empilhamento preserva valores; mapa não invade a largura.

As notas acima atualizam a avaliação por página final; não apagam achados ou limitações de iterações antigas. Não há nova nota inferior a 9 que exija correção funcional; as verificações sem evidência estão NV. A altura grande da ficha decorre de séries e novos blocos autorizados, não constitui por si só perda de hierarquia. A entrada sem cidade permanece como determinado, sem proposta de redesenho da barra ou identidade.

Conclusão visual: sem bloqueio observado nas 30 capturas examinadas. Permanece um ajuste pequeno de redação no mapa e a ocorrência de console a explicar pela repetição isolada. Estados interativos, alternativas de decomposição, outras UFs/etapas e detalhes recolhidos fora dos recortes anteriores não recebem certificação adicional nesta rodada.

## Adendo — repetição isolada do mapa 1440

Li `repeticao-mapa/evidencias.md`: um caso de `/educacao-municipal/mapa`, com sessão, 1440px, mesmo build `fpE_Ds1-dYEUvyAN397a_`. A execução do agente principal registra HTTP 200, axe 0, console 0, Login 0 e ausência de rolagem horizontal. O H1 está na primeira tela e o cromo mede 187px, dentro do limite 230.

O erro de carregamento de chunk do lote original não se repetiu nesse caso isolado. Isso não identifica sua causa nem apaga a ocorrência original; ambas as evidências ficam registradas. Não executei a repetição. A cobertura visual continua sendo as 30 capturas completas já revisadas, sem nova alegação de inspeção visual das imagens desta repetição.
