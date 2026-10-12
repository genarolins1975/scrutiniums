# Viabilidade das 15 fichas — decisão preparatória

Revisão dos contratos e evidências presentes no PR #149 (`317c6de`). É uma revisão de viabilidade das fontes integradas, não uma nova auditoria primária nem aprovação de referências. As 15 fichas, o cálculo, a cesta e o bloqueio de publicação permanecem inalterados.

## Objeto da síntese

Recomendação: manter como objetivo uma síntese da qualidade dos serviços com perímetro explícito. Condições de vida, capacidade instalada e recursos entram como contexto e evidência, sem conversão automática em atendimento ou qualidade. Satisfação exige pesquisa própria; eficiência exige relação entre recursos e entregas com tratamento do contexto. A síntese experimental dos cinco capítulos não deve ser apresentada como avaliação de todos os 16 temas.

## Revisão por componente

| Ficha | Evidência integrada | Viabilidade para pontuação e próximo passo verificável |
|---|---|---|
| education.access | Frequência escolar por residência/idade 2022, redes públicas e privadas; matrículas | Parcial. A frequência permite panorama descritivo. Localizar recorte público e população elegível com residência compatível; fechar numerador/denominador antes de normalizar. |
| education.response | Aprovação e fluxo escolar | Não demonstrada. Calendário realizado e fila de matrícula não integrados. Inventariar fonte administrativa que observe previsão e execução no mesmo universo; se não existir cobertura comparável, propor revisão explícita do indicador. |
| education.quality | Saeb 2023 auditado para rede municipal urbana | Candidato mais próximo de validação, ainda bloqueado. Obter participação/denominadores, justificar âncoras por etapa/disciplina e verificar dupla contagem com Ideb. O ZIP de microdados não foi obtido na diligência anterior. |
| health.access | CNES e cobertura potencial APS | Parcial apenas para capacidade. Exigir evidência de necessidade e atendimento realizado; cadastro/equipes não comprovam acesso efetivo. |
| health.response | Sem série integrada de espera/continuidade | Não demonstrada. Obter solicitações, atendimentos e pendências por coorte/procedimento; verificar censura. Apenas casos concluídos são insuficientes. |
| health.quality | ICSAP por residência e contexto de cobertura de planos | Parcial. Definir desfecho e ajuste de perfil, verificar se o construto sustenta a qualidade pretendida; preservar taxa bruta como contexto. |
| work.access | PNAD/Censo, CadÚnico e cursos autorizados | Não demonstrada para serviço. Localizar demanda elegível e atendimentos únicos de intermediação/qualificação por modalidade. Renda e emprego não substituem esse registro. |
| work.response | Cursos autorizados, sem trajetória integrada | Não demonstrada. Confirmar registros de solicitações, início, conclusão e pendências no horizonte definido. |
| work.quality | Renda e emprego agregados | Não demonstrada para entrega do serviço. Definir resultado verificável e acompanhamento de beneficiários, com contexto; não atribuir causalidade a séries agregadas. |
| food.access | EBIA e equipamentos/ações MUNIC | Não demonstrada. Escolher modalidade (ex.: alimentação escolar ou refeições), obter demanda e atendidos compatíveis; EBIA é condição domiciliar. |
| food.response | Declaração de ações MUNIC | Não demonstrada. Exigir calendário de entregas previsto versus executado, dentro da mesma modalidade e população. |
| food.quality | Sem conformidade de entregas integrada | Não demonstrada. Localizar inspeções/amostras e protocolo comparável de conformidade nutricional/sanitária. |
| assistance.access | CRAS/CREAS/centros-dia; formulários RMA | Parcial. Verificar cobertura de unidades ativas, demanda e deduplicação; registros unidade-mês não são pessoas únicas elegíveis. |
| assistance.response | Práticas declaradas e espera cadastral | Não demonstrada. Selecionar serviço, observar entrada/conclusão/pendências; espera cadastral não mede a rede inteira. |
| assistance.quality | Estrutura e acessibilidade autodeclaradas | Parcial apenas para estrutura. Verificar inspeção, segurança e resultado do cuidado com população e protocolo definidos. |

## Decisões e sequência

1. Usar desde já as evidências descritivas no panorama, com papel, ano e limites visíveis. Quatro temas municipais integrados nesta etapa; isso não promove fichas a validadas.
2. Primeiro candidato para trabalho metodológico: `education.quality`, após obter a evidência de participação. Uma medida validada não libera automaticamente o capítulo Educação: acesso e resposta continuam bloqueados.
3. Para cada candidato a acesso/resposta, produzir um registro de viabilidade contendo fonte identificada, acesso efetivamente testado, grão, período, cobertura e resultado de uma amostra. Até então, a disponibilidade da fonte é hipótese.
4. Se a fonte não sustentar o construto, registrar alternativa metodológica e impacto sobre a cesta. Não substituir por proxy nem flexibilizar a regra de completude silenciosamente.
5. Só depois de uma cesta real elegível: validar âncoras, pesos, janelas, sensibilidade empírica, estabilidade entre edições e revisão metodológica. Cenários sintéticos comprovam o funcionamento do motor, não a validade substantiva.

## Critérios de saída da revisão metodológica

Cada ficha precisa de: definição do serviço e população; fórmula; numerador/denominador ou universo; fonte acessível; comparabilidade temporal/territorial; referência justificável; tratamento de ausência; responsável pela decisão e versão. Hoje nenhuma das 15 fichas satisfaz integralmente esse conjunto para publicação. A etapa atual conclui o inventário de viabilidade das evidências integradas; a aquisição das fontes e a decisão metodológica permanecem abertas.
