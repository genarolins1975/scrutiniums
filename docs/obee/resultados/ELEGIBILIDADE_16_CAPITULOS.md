# Elegibilidade dos 16 capítulos e roadmap de expansão

Revisão: 12/10/2026. Base integrada: `bca955b0f611c534e903fc3f0c85785705b0be1e`.

## Situação atual

Há **13 painéis publicados**, **cinco indicadores no piloto congelado de 2022**, **duas candidatas adquiridas e analisadas conjuntamente** e **zero indicadores adicionais aprovados para promoção**. Nenhum capítulo completo tem escore validado. A contagem de indicadores não mede a cobertura substantiva dos 16 capítulos.

O panorama descritivo foi publicado em produção após a integração dos PRs #145, #147 e #149, com build e CI aprovados. A trava do escore experimental em produção permanece ativa. O timeout que motivou a revisão inicial de elegibilidade foi resolvido preservando as assertivas; não é mais a próxima etapa.

A aquisição de Habitação (SIDRA 9934/9940, 520 células) e de Conectividade (SIDRA 9936, 156 células) está concluída para a mesma coorte de 26 capitais em 2022. A [comparação conjunta](CESTA_CONJUNTA_V3.md) produziu **18 cenários e 468 linhas cidade–cenário**, além da matriz de correlações e da decomposição do efeito de novos indicadores e pesos.

A proposta para revisão é examinar as duas inclusões preservando em 40% o conjunto renda–saneamento–habitação–conectividade. Esse agrupamento e seus pesos ainda precisam de justificação normativa; menor alteração na ordem das capitais não prova superioridade metodológica. A próxima etapa é o protocolo de precisão/divulgação municipal.

## Matriz atual

Estados referem-se à cesta municipal de 2022. Não julgam a utilidade dos painéis nos seus próprios anos e universos. O inventário de publicação corresponde ao catálogo da base acima.

| Capítulo | Estado na cesta | Próxima ação |
|---|---|---|
| Educação | Indicador na v2 | Preservar frequência; auditar aprendizagem apenas em contrato próprio. |
| Saúde | Pesquisa com impedimento | Obter evidência municipal de cobertura para cada ano e revisar contrato temporal; não aplicar fatores de UF. |
| Trabalho e renda | Indicador na v2 | Preservar renda e avaliar redundância antes de acrescentar condições de moradia. |
| Segurança alimentar | Contexto; fora da cesta | Manter comparação regional; definir aquisição de resultado municipal antes de pontuar. |
| Assistência social e cuidado | Contexto; fora da cesta | Auditar agregação territorial e denominador de necessidade em contrato de acesso separado. |
| Previdência | Sem painel publicado | Definir população elegível, proteção de renda e competência de cada regime antes da coleta. |
| Segurança pública | Indicador na v2 | Preservar alternativa só registros e explicitar incerteza do modelo. |
| Justiça e direitos | Contexto; fora da cesta | Resolver geografia e universo da demanda; não atribuir desempenho do tribunal à capital. |
| Habitação | Candidato em revisão | Protocolo descritivo definido; precisão municipal pendente. Revisar conteúdo e pesos da proposta conjunta v3, sem promoção automática. |
| Saneamento | Indicador na v2 | Preservar definição e alternativa apenas rede; evitar duplicação na expansão de Habitação. |
| Mobilidade e transporte | Indicador na v2 | Preservar indicador e não misturar AOP ou oferta declarada na mesma referência. |
| Energia e conectividade | Candidato em revisão | Protocolo descritivo definido; precisão municipal pendente. Revisar conteúdo e pesos da proposta conjunta v3, sem promoção automática. |
| Meio ambiente e clima | Contexto; fora da cesta | Selecionar exposição ou resultado municipal com denominador comparável e cobertura explícita. |
| Cultura | Contexto; fora da cesta | Definir participação/acesso municipal e precisão; manter despesa como contexto. |
| Esporte e lazer | Sem painel publicado | Definir participação/uso e universo residente; mapear fonte territorial antes da coleta. |
| Serviços e cidadania | Sem painel publicado | Definir resolução e tempo de atendimento com demanda comparável; separar canal digital de acesso efetivo. |

A [matriz JSON](elegibilidade-16-capitulos.json) preserva fontes, medidas, recortes, prioridades e impedimentos por capítulo. As duas candidatas continuam com `eligible_for_automatic_expansion=false`; a contagem de indicadores elegíveis adicionais permanece zero.

## Roadmap por critérios de conclusão

| Ordem | Entrega | Estado / critério |
|---|---|---|
| 1 | Confiabilidade da v2 e integração do panorama | Concluída: reconciliação exaustiva mantida, CI aprovada e panorama em produção |
| 2 | Aquisição municipal de Habitação | Concluída: domicílios e moradores, limiares >2 e >3 por dormitório, fontes e hashes |
| 3 | Aquisição municipal de Conectividade | Concluída: Sim/Não/Total, numerador/denominador, percentuais e hashes |
| 4 | Comparação conjunta das candidatas | Concluída: inclusões isoladas/conjuntas, pesos explícitos, definições, empates e decomposição; proposta documentada |
| 5 | Precisão e divulgação municipal | Protocolo descritivo concluído e automatizado; anexo de 33 abas examinado. Precisão municipal não resolvida; aquisição adequada segue pendente, com bloqueio de inferência/agregado |
| 6 — próxima | Parecer de conteúdo e pesos da candidata v3 | Aceitar/rejeitar agrupamento, orçamento material e definição de adensamento por conteúdo, sem escolher pesos para favorecer estabilidade ou capitais |
| 7 | Revisão independente e promoção de edição | Aprovar interpretação, precisão/divulgação, pesos, sensibilidade e limites; nenhuma liberação automática |
| 8 | Integração ao produto | Identificar edição; comparar v2/v3; distinguir composição de variação temporal; conferir jornada e acessibilidade |

Trilhas complementares: Saúde depende de cobertura/sub-registro infantil municipal por ano e do contrato temporal 2021–2023; Alimentação, Assistência, Justiça, Ambiente e Cultura exigem construtos e geografias compatíveis; Previdência, Esporte e Serviços precisam de contratos e fontes antes de notas. Não há prazo confiável para resolver dependências de evidência apenas com engenharia.

## Regras de expansão

- Resultados dos moradores, acesso, recursos, satisfação e eficiência causal são objetos diferentes. Os percentis do piloto representam condições relativas observadas.
- Referência congelada: 26 capitais, 2022, sem DF. Não substituir capital por UF, distribuidora, tribunal ou região metropolitana.
- Ausências permanecem ausências. Não preencher Saúde nem redistribuir silenciosamente seu peso.
- Média 50 é propriedade da normalização, não meta. Mudança de cesta não é melhora histórica.
- Um indicador não resolve um capítulo completo. Número maior de séries não deve conferir peso maior por acidente.
- Precisão municipal não pode ser inferida de funções nacionais/estaduais sem suporte nem de totais populacionais expandidos tratados como amostra.
- Países e escore integral dos 16 capítulos permanecem fora da implementação validada.

## Evidências e reprodução

- [Protocolo de precisão e divulgação](PRECISAO_CANDIDATAS.md): anexo oficial, acesso aos microdados, 52 registros e dependências abertas.

- [Cesta conjunta e proposta v3](CESTA_CONJUNTA_V3.md): código, 18 cenários, 468 linhas, oito testes novos e pendências.
- [Aquisição de Habitação](HABITACAO_ADENSAMENTO.md) e [sensibilidade das definições](HABITACAO_CENARIOS.md).
- [Aquisição de Conectividade](CONECTIVIDADE_MUNICIPAL.md).
- [Expansão v2](EXPANSAO_V2.md) e [robustez empírica](ROBUSTEZ_EMPIRICA.md).
- [Dossiê de cobertura de Saúde](CAPTURA_RECAPTURA_SAUDE.md).

Esta revisão reconcilia as evidências versionadas. Não é um levantamento exaustivo de fontes externas. Os resultados dos testes da nova entrega devem ser conferidos no seu próprio commit; a aprovação da integração anterior não substitui essa verificação.
