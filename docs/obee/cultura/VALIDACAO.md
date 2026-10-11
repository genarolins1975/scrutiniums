# Validação do capítulo Cultura

## Dados e código

- Pipeline reproduzível offline: 210 estimativas TIC, 44 registros por esfera, 297 registros estaduais/distrital; hash do seed, unicidade e limites numéricos conferidos.
- Onze anos reconciliados por esfera e UF, sem tolerância relativa ou retirada de extremos.
- Dois testes Python do novo domínio aprovados.
- Suíte completa: 4.530 aprovados, um ignorado, em 193 arquivos; HTML obrigatório da publicação incluído. A primeira execução coincidiu com build incompleto e reprovou três verificações de HTML; refeita depois do build, aprovou. Uso de hexadecimal no SVG financeiro apontado pelo teste de tokens; corrigido antes da aprovação.
- TypeScript e lint aprovados. Build completo do conteúdo final aprovado.

## Matriz de páginas e tarefas

| Rota | Contrato verificado | Interação implementada | Revisão visual manual |
|---|---|---|---|
| Panorama | Destaques correspondem às células oficiais; períodos separados | Navegação dos seis caminhos | Não verificada |
| Equipamentos | A3/A4 com composições completas e universos por tipo | Indicador/categoria, busca, ordem, CSV | Não verificada |
| Acesso digital | B3C/B5/B10/C3, estimativa e margem publicadas | Indicador/categoria, busca, ordem, CSV | Não verificada |
| Atividades | C11, dez atividades não somáveis | Categoria, busca, ordem, CSV | Não verificada |
| Acervos | D1/D2/D4B/D8, percentual de instituições | Indicador/categoria, busca, ordem, CSV | Não verificada |
| Recursos | Tabelas 3.1/3.2/3.7, onze anos, 27 governos, valores nominais | Ano/esfera, busca/ordem de UFs, tabela anual, CSV | Não verificada |
| Dados e métodos | Fichas, universo, localização, hashes, arquivos | Expansões metodológicas e downloads | Não verificada |

## Limitação da inspeção visual

O navegador remoto deste ambiente não alcançou o servidor local (`ERR_CONNECTION_REFUSED`). O preview Vercel exigiu autenticação, indisponível nesta sessão. Não foram realizadas capturas, testes manuais de teclado, leitor de tela, zoom ou revisão em 320/390/768/1440 px. Não se atribuem notas estéticas ou alegação de conformidade integral sem essa evidência.

A grade móvel de filtros, os gráficos de estimativa e a alternativa financeira em barras horizontais foram inspecionados no código e contrato, mas isso não substitui inspeção no navegador. Revisão independente não realizada. PR mantido em rascunho até essa revisão.
