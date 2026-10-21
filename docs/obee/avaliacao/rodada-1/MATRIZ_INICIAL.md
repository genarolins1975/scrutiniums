# Matriz inicial de avaliação, rodada 1

Estado avaliado: `main` no commit `277264514` (merge da PR 123), build de produção local, em 09/10/2026. Notas de dois avaliadores independentes, cada um um agente em contexto limpo, sem acesso às conclusões do executor, que não implementou correções:

* **Avaliador de experiência** (A, B, C, D, H, I, J): relatório em `avaliador-experiencia.md`, com capturas em `evidencias/experiencia/`.
* **Avaliador de dados e método** (E, F, G, K e bloqueios de dados): relatório em `avaliador-dados.md`, com recálculos e scripts em `evidencias/dados/`.

**Limitação declarada.** A separação é de papéis e contexto, dentro do mesmo ambiente. Não é revisão externa nem teste com pessoas: as tarefas foram executadas por agentes (inspeção heurística), sem leitor de tela real, sem toque em aparelho físico e sem avaliar a produção.

## Matriz (nota de 0 a 10, uma casa decimal)

| Painel | A | B | C | D | E | F | G | H | I | J | K | Mínima |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Panorama | 8,3 | 7,3 | 7,0 | 7,8 | 8,2 | 7,4 | 8,2 | 7,6 | 8,0 | 8,2 | 9,0 | **7,0** |
| Gastos | 8,2 | 7,8 | 8,2 | 7,6 | 8,0 | 7,0 | 8,4 | 7,3 | 8,3 | 7,4 | 8,6 | **7,0** |
| Atendimento | 8,2 | 7,6 | 7,4 | 7,5 | 7,9 | 8,6 | 8,5 | 7,5 | 8,2 | 7,4 | 8,9 | **7,4** |
| Resultados | 8,2 | 7,5 | 7,4 | 7,4 | 8,5 | 8,2 | 8,6 | 7,5 | 8,2 | 7,4 | 8,8 | **7,4** |
| Comparar capitais | 7,6 | 7,2 | 7,6 | 7,5 | 7,3 | 7,0 | 7,2 | 7,5 | 7,2 | 6,9 | 8,4 | **6,9** |
| Dados e métodos | 6,8 | 7,4 | 7,0 | 7,4 | 8,7 | 8,3 | 8,6 | 7,2 | 6,8 | 7,3 | 9,0 | **6,8** |
| **Mínima por critério** | 6,8 | 7,2 | 7,0 | 7,4 | 7,3 | 7,0 | 7,2 | 7,2 | 6,8 | 6,9 | 8,4 | |

Critérios: A layout e hierarquia; B didática; C utilidade para análise e decisão; D relevância e impacto social; E indicadores, referências e comparabilidade; F rigor metodológico; G rastreabilidade e reprodutibilidade; H visualizações; I navegação e interação; J acessibilidade e responsividade; K confiabilidade técnica e desempenho. Justificativa, evidência e correção de cada célula estão nos relatórios (seção 2 de `avaliador-experiencia.md`; seção 1 de `avaliador-dados.md`).

## Resultado

**Aprovação não atendida.** Nenhuma meta de 9,0 em todos os critérios de todos os painéis: das 66 células, 64 estão abaixo de 9,0 (só K de Panorama e de Dados e métodos chega a 9,0). Há **dois bloqueios confirmados** pelo avaliador de dados, e um terceiro item de experiência (P1 do avaliador de experiência) que se sobrepõe ao segundo:

1. **Intraorçamentárias.** A despesa em Educação exclui as intraorçamentárias, que pesam de 3% (Macapá) a 36% (Porto Alegre) da função, pelo RREO de 2024, e o aviso só está na ficha e no glossário. Com elas somadas, Porto Alegre iria da 24ª à 16ª posição em despesa por habitante e o Rio de Janeiro da 15ª à 8ª. Afeta Panorama, Gastos e Comparar.
2. **Quebra de série na evolução.** A evolução da mediana por habitante, sem capital escolhida, afirma "R$ 625 em 2021 para R$ 1.160 em 2025" atravessando a mudança da base populacional, enquanto a regra do painel bloqueia a frase quando há capital. O gráfico de evolução, por sua vez, diz que "marca a ruptura" e não a desenha.

**Integridade numérica.** Nenhum valor incorreto: 3.302 valores recalculados com lógica própria e conferidos nas fontes (Siconfi, SIDRA, INEP, MSC); regeneração da gold idêntica byte a byte. Descartados após teste: denominador inadequado na razão por matrícula, ausência tratada como zero, exclusão só no gráfico, julgamento de eficiência ou causalidade, comparação internacional enganosa.

## Mínima por painel

Panorama 7,0; Gastos 7,0; Atendimento 7,4; Resultados 7,4; Comparar capitais 6,9; Dados e métodos 6,8.

## Prioridade das correções

Primeiro validade e integridade (os dois bloqueios e o rótulo "rede municipal" sobre gasto do orçamento do município), depois comparabilidade e utilidade (Comparar sem ficha, CSV, ressalva e referência; grupo de pares; versões e histórico; exportações sem dicionário), depois hierarquia, didática e interação (rótulos cortados em 320 e 390 px, controles que parecem texto, capital excluída longe do motivo, termos sem definição, aviso próprio por tema), por fim refinamentos. O registro dos problemas e o estado de cada correção estão em `REGISTRO_PROBLEMAS.md`.
