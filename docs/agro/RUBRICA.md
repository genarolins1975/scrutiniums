# Autoavaliação por página

Rubrica da skill local; não é revisão independente nem teste com usuários. Notas separadas, sem média para compensar critério baixo. Evidência: capturas das quatro larguras e estados em `scripts/agro/verificacao.mjs`, relatório versionado em `evidencias/resultado.json`; screenshots completos no artefato CI `agronegocio-interface`. Amostra selecionada nesta pasta. A conferência automatizada não prova acessibilidade integral.

A arte usa tipografia e tokens existentes, ilustrações vetoriais do mecanismo, malha oficial, barras, linhas, distribuição, cascata e matriz. As instâncias compartilham componentes; não aumentam a contagem de artefatos. Falta de medição reduz a profundidade e a possibilidade de comparação; a nota não transforma a entrega parcial em cumprimento integral da especificação.

| Rota em /agronegocio | Arte | Hierarquia | Tipografia | Profundidade | Didática | Comparabilidade | Interação/acessibilidade | Responsividade |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| / | 8 | 9 | 9 | 8 | 8 | 8 | 8 | 9 |
| /tamanho | 8 | 9 | 9 | 8 | 9 | 8 | 8 | 9 |
| /conjuntura | 8 | 9 | 9 | 8 | 9 | 8 | 8 | 9 |
| /insumos | 8 | 9 | 9 | 7 | 8 | 7 | 8 | 9 |
| /mercados | 8 | 9 | 9 | 8 | 9 | 8 | 8 | 9 |
| /produtores | 8 | 9 | 9 | 8 | 9 | 8 | 8 | 9 |
| /apoio | 8 | 9 | 9 | 8 | 8 | 8 | 8 | 9 |
| /ambiente | 8 | 9 | 9 | 8 | 8 | 7 | 8 | 9 |
| /prato | 8 | 9 | 9 | 8 | 9 | 8 | 8 | 9 |
| /cadeias | 8 | 8 | 9 | 8 | 8 | 7 | 8 | 9 |
| /cadeias/[12 cadeias] | 8 | 8 | 9 | 8 | 8 | 7 | 8 | 9 |
| /producao | 8 | 8 | 9 | 8 | 8 | 7 | 8 | 9 |
| /atlas | 8 | 8 | 9 | 8 | 8 | 8 | 8 | 9 |
| /comparar | 8 | 8 | 9 | 7 | 8 | 8 | 8 | 9 |
| /panorama | 8 | 8 | 9 | 7 | 8 | 8 | 8 | 9 |
| /custos-renda | 8 | 8 | 9 | 6 | 7 | 6 | 8 | 9 |
| /alimentos-consumo | 8 | 8 | 9 | 7 | 8 | 7 | 8 | 9 |
| /credito-protecao | 8 | 8 | 9 | 7 | 8 | 8 | 8 | 9 |
| /logistica-mercados | 8 | 8 | 9 | 6 | 7 | 6 | 8 | 9 |
| /empresas-trabalho | 8 | 8 | 9 | 7 | 8 | 7 | 8 | 9 |
| /clima-ambiente | 8 | 8 | 9 | 6 | 7 | 6 | 8 | 9 |
| /politicas-inclusao | 8 | 8 | 9 | 7 | 8 | 7 | 8 | 9 |
| /aprenda | 8 | 8 | 9 | 7 | 8 | 7 | 8 | 9 |
| /glossario | 8 | 8 | 9 | 7 | 9 | 8 | 8 | 9 |
| /metodologia | 8 | 9 | 9 | 8 | 8 | 9 | 8 | 9 |
| /sintese | 8 | 8 | 9 | 7 | 8 | 8 | 8 | 9 |

Recalibração da fase 3 (17/10/2026). As notas anteriores davam 9 de direção de arte e de didática a todas as rotas, inclusive capítulos sem nenhum dado observado. Isso não se sustentava pela rubrica da skill, que pede 9 só para excelente demonstrado. Critérios revistos:

- **Arte em 8 em todas as rotas.** Componentes coerentes e sóbrios, mas sem revisão estética independente e com ilustrações vetoriais simples.
- **Capítulos de custos, logística e ambiente com profundidade 6 e comparabilidade 6.** O tema central (custo de produção, rotas e fretes, exposição territorial) segue sem medição; o dado observado que abre a página (insumos importados, exportações, PRODES) é vizinho do tema, não o tema.
- **Fichas de cadeia em comparabilidade 7.** Posições SH misturam produtos (0713, 0207, 2207), o abate é o local do frigorífico e tem estados sob sigilo, e as medidas físicas não se comparam entre cadeias.
- **Insumos em profundidade 7.** Sem consumo nacional de fertilizantes nem preço na fazenda, não se mede dependência nem custo.

Limitações que permanecem: calendário agrícola, custos Conab, preço ao produtor, proteção, rotas, ambiente territorial e FAOSTAT não medidos; emprego formal apenas nacional; referência fiscal de programas não integrada. Interação fica em 8 por faltar avaliação externa com pessoas e tecnologia assistiva.

Foram corrigidos problemas verificáveis de HTTP 404, listas de definição, alternância responsiva de SVGs, escala dos rótulos, foco no resultado e nomes acessíveis de seletores. Não foram atribuídas notas 9 por desejo de encerrar; os critérios de profundidade/comparação permanecem abaixo da meta onde faltam bases. Leitor de tela e revisão estética independente: **não verificados**.
