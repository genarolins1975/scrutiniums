# Autoavaliação por página

Rubrica da skill local; não é revisão independente nem teste com usuários. Notas separadas, sem média para compensar critério baixo. Evidência: capturas das quatro larguras e estados em `scripts/agro/verificacao.mjs`, relatório versionado em `evidencias/resultado.json`; screenshots completos no artefato CI `agronegocio-interface`. Amostra selecionada nesta pasta. A conferência automatizada não prova acessibilidade integral.

A arte usa tipografia e tokens existentes, ilustrações vetoriais do mecanismo, malha oficial, barras, linhas, distribuição, cascata e matriz. As instâncias compartilham componentes; não aumentam a contagem de artefatos. Falta de medição reduz a profundidade e a possibilidade de comparação; a nota não transforma a entrega parcial em cumprimento integral da especificação.

| Rota em /agronegocio | Arte | Hierarquia | Tipografia | Profundidade | Didática | Comparabilidade | Interação/acessibilidade | Responsividade |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| / | 9 | 9 | 9 | 8 | 9 | 8 | 8 | 9 |
| /tamanho | 9 | 9 | 9 | 8 | 9 | 8 | 8 | 9 |
| /conjuntura | 9 | 9 | 9 | 8 | 9 | 8 | 8 | 9 |
| /insumos | 9 | 9 | 9 | 8 | 8 | 7 | 8 | 9 |
| /mercados | 9 | 9 | 9 | 8 | 9 | 8 | 8 | 9 |
| /panorama | 9 | 9 | 9 | 8 | 9 | 9 | 8 | 9 |
| /atlas | 9 | 9 | 9 | 8 | 9 | 9 | 8 | 9 |
| /comparar | 9 | 9 | 9 | 8 | 9 | 9 | 8 | 9 |
| /cadeias | 9 | 9 | 9 | 8 | 9 | 8 | 8 | 9 |
| /producao | 9 | 9 | 9 | 7 | 9 | 7 | 8 | 9 |
| /custos-renda | 9 | 9 | 9 | 8 | 9 | 8 | 8 | 9 |
| /alimentos-consumo | 9 | 9 | 9 | 8 | 9 | 8 | 8 | 9 |
| /credito-protecao | 9 | 9 | 9 | 8 | 9 | 8 | 8 | 9 |
| /logistica-mercados | 9 | 9 | 9 | 8 | 9 | 8 | 8 | 9 |
| /empresas-trabalho | 9 | 9 | 9 | 8 | 9 | 8 | 8 | 9 |
| /clima-ambiente | 9 | 9 | 9 | 7 | 9 | 7 | 8 | 9 |
| /politicas-inclusao | 9 | 9 | 9 | 8 | 9 | 8 | 8 | 9 |
| /cadeias/soja | 9 | 9 | 9 | 7 | 8 | 8 | 8 | 9 |
| /cadeias/milho | 9 | 9 | 9 | 7 | 8 | 8 | 8 | 9 |
| /cadeias/arroz | 9 | 9 | 9 | 7 | 8 | 8 | 8 | 9 |
| /cadeias/feijao | 9 | 9 | 9 | 7 | 8 | 8 | 8 | 9 |
| /cadeias/cafe | 9 | 9 | 9 | 7 | 8 | 8 | 8 | 9 |
| /cadeias/bovinos | 9 | 9 | 9 | 7 | 8 | 8 | 8 | 9 |
| /cadeias/leite | 9 | 9 | 9 | 7 | 8 | 8 | 8 | 9 |
| /aprenda | 8 | 9 | 9 | 8 | 9 | 9 | 8 | 9 |
| /glossario | 9 | 9 | 9 | 8 | 9 | 8 | 8 | 9 |
| /metodologia | 8 | 9 | 9 | 8 | 9 | 9 | 8 | 9 |
| /sintese | 9 | 9 | 9 | 8 | 9 | 9 | 8 | 9 |

Páginas de perguntas (fase 1 da economia): dados observados com coleta automática, verificados a 320, 390, 768 e 1440 px. Insumos fica em 7 de comparabilidade porque o valor unitário de comércio exterior mistura produtos e não é preço na fazenda; a página diz isso, mas a referência certa (custo Conab, preço ao produtor) ainda falta. Profundidade em 8 nas quatro: sem recorte por estado, juros do crédito rural e consumo nacional de fertilizantes. A nota de didática das páginas antigas sem dado observado não foi revista nesta fase.

Limitações que permanecem: fontes bloqueadas, sem produção/custo de referência/comércio/ambiente observados; fichas de cadeia conceituais e parciais; comparação territorial com período da própria medida e sem produto/histórico conjunto; emprego formal apenas nacional; referência fiscal de programas não integrada. As explicações não preenchem esses vazios. Interação fica em 8 por faltar avaliação externa com pessoas e tecnologia assistiva; emulação de zoom/reflow não cobre todas as formas de ampliação de texto.

Foram corrigidos problemas verificáveis de HTTP 404, listas de definição, alternância responsiva de SVGs, escala dos rótulos, foco no resultado e nomes acessíveis de seletores. Não foram atribuídas notas 9 por desejo de encerrar; os critérios de profundidade/comparação permanecem abaixo da meta onde faltam bases. Leitor de tela e revisão estética independente: **não verificados**.
