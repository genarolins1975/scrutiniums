# Elegibilidade dos 16 capítulos e roadmap de expansão

Revisão: 12/10/2026. Base examinada: commit `64f6a9e1b42a64c8d161b29d3d3fa5f70f29ece7`, PR #149 em rascunho.

## Atualização — auditoria de Habitação concluída

A etapa de aquisição confirmou as tabelas SIDRA 9934/9940, com 520 células das 26 capitais em 2022. Habitação é agora candidato em revisão; precisão municipal e redundância/pesos continuam pendentes. O [dossiê de adensamento](HABITACAO_ADENSAMENTO.md) e a matriz JSON atualizada registram o avanço. Nenhum indicador foi acrescentado ao escore. A decisão e a fila abaixo documentam o diagnóstico anterior à aquisição.

## Decisão inicial

Há **13 painéis publicados**, **cinco indicadores no piloto de 2022** e **nenhum indicador adicional pronto para inclusão automática** entre os capítulos restantes nas evidências examinadas. Não há escore validado de capítulo completo. Cinco indicadores não representam cinco capítulos completos, e 5/16 não é uma medida de cobertura substantiva do OBEE.

A próxima aquisição recomendada é uma **auditoria de viabilidade de Habitação municipal em 2022**, com foco em adensamento domiciliar. Trata-se de uma hipótese de aquisição: ainda não foi confirmada uma tabela oficial com o recorte necessário. A prioridade decorre da aderência temática à vida do cidadão e da possibilidade de investigar o mesmo ano e universo territorial; não de uma certificação prévia da fonte.

A base FJP já publicada não pode ser convertida em notas de capitais. Energia e conectividade vêm na sequência para auditoria de acesso municipal; Saúde permanece em pesquisa com condições objetivas de desbloqueio. Nenhum desses trabalhos altera automaticamente a cesta v2.

## Matriz de decisão

| Capítulo | Estado | Evidência territorial e temporal | Principal restrição | Fila |
|---|---|---|---|---|
| Educação | Indicador no piloto | 26 capitais; frequência 4–5 anos, 2022; painel municipal de ensino tem outros períodos e universos. | Aprendizagem municipal urbana 2023 exige participação compatível; não equivale ao construto de frequência de 2022. | P2 |
| Saúde | Pesquisa bloqueada | 26 capitais; 156 contagens SIM/SINASC, 2021–2023. APS potencial: dezembro de 2025. | Cobertura/sub-registro infantil municipal sem evidência elegível; janela trienal diferente de 2022; precisão condicional não corrige cobertura. | P2 |
| Trabalho e renda | Indicador no piloto | 26 capitais na cesta; rendimento do Censo 2022. Conjuntura Brasil/UF em outros períodos. | Renda não mede toda a inserção laboral nem eficiência da política; redundância com condições habitacionais. | P2 |
| Segurança alimentar | Contexto; fora da cesta | PNADC: Brasil/cinco regiões, 2023–2024; MUNIC: 5.570 municípios, 2024. | Sem EBIA municipal comparável em 2022; existência de programa não mede segurança alimentar. | P3 |
| Assistência social e cuidado | Contexto; fora da cesta | Censo SUAS/RMA CRAS 2025: unidades e formulários unidade-mês, incluindo redes regionais/estaduais/OSC. | Sem demanda elegível, usuários únicos e resolução; volume de atendimentos não tem polaridade universal; período 2025. | P3 |
| Previdência | Sem painel publicado | Catálogo editorial sem painel publicado neste snapshot. | Sem contrato e evidência numérica revisados nesta rodada. | P4 |
| Segurança pública | Indicador no piloto | Piloto: 26 capitais, Atlas da Violência 2024, referência 2022. Painel: Brasil, 2025. | Depende do modelo de homicídios ocultos; não equivale a todos os crimes ou à resposta policial. | P2 |
| Justiça e direitos | Contexto; fora da cesta | 2.563 comarcas, abril/2025; defensorias de 27 UFs, 2024; tribunais, 2025. | Comarca/tribunal não equivale a município; sem demanda elegível ou resolução individual; períodos incompatíveis. | P3 |
| Habitação | Contexto; fora da cesta | FJP edição 2026: estimativas de 2024 para Brasil, regiões e 27 UFs. | UF não representa capital e 2024 não é 2022; renda e esgotamento já entram na cesta. | P1 |
| Saneamento | Indicador no piloto | Piloto municipal Censo/SIDRA 6805, 2022. Painel SINISA 2025: referência 2024, Brasil/regiões/UF. | Não mede tratamento, qualidade ou continuidade; não somar categorias filhas à categoria agregada. | P2 |
| Mobilidade e transporte | Indicador no piloto | Censo 2022 municipal; Pemob 2025 com respondentes; AOP 2019 com população de 2010. | Universo de trabalhadores com deslocamento; não cobre toda acessibilidade. AOP não tem a mesma coorte/ano. | P2 |
| Energia e conectividade | Contexto; fora da cesta | Energia: séries PNAD, Brasil/distribuidoras conforme produto; internet: Brasil urbano/rural, 2025. | Distribuidora não é município; tarifa homologada não é conta típica; internet nacional não representa capital. | P2 |
| Meio ambiente e clima | Contexto; fora da cesta | SINISA 2025, referência 2024; Brasil e cinco regiões, universos elegíveis. | Recorte não municipal/2022; planos e infraestrutura não equivalem a resultado ambiental; sobreposição com Saneamento. | P3 |
| Cultura | Contexto; fora da cesta | TIC Cultura 2024: estimativas nacionais; SIIC: despesas 2013–2023 por esfera/UF. | Sem frequência individual ou acesso municipal; equipamentos públicos/privados; gasto maior não implica resultado melhor. | P3 |
| Esporte e lazer | Sem painel publicado | Catálogo editorial sem painel publicado neste snapshot. | Sem contrato e evidência numérica revisados nesta rodada. | P4 |
| Serviços e cidadania | Sem painel publicado | Catálogo editorial sem painel publicado neste snapshot. | Sem contrato e evidência numérica revisados nesta rodada. | P4 |

A [matriz JSON](elegibilidade-16-capitulos.json) registra também ação seguinte, fonte de evidência, estado de publicação e impedimento de promoção automática de cada capítulo. Estados se referem à referência municipal de 2022; não julgam a utilidade dos painéis em seus próprios recortes. “Sem painel” se limita ao catálogo deste commit.

## Roadmap por critérios de conclusão

| Ordem | Entrega concreta | Critério de conclusão | Se a condição falhar |
|---|---|---|---|
| P0 — confiabilidade | Resolver timeout da reconciliação exaustiva do piloto e conferir nova CI | Mesmo teste de 325 pares e inversas aprovado; interface e suíte integral verdes no novo commit | Manter bloqueio de integração e investigar a falha, sem retirar assertivas |
| P1 — próxima etapa | Dossiê de viabilidade de Habitação municipal 2022 | Fonte oficial, códigos IBGE, 26 capitais, unidade/ano/universo, numerador e denominador auditáveis; definição de adensamento justificada | Registrar ausência/limite e seguir para Energia; não usar a UF nem mudar o ano silenciosamente |
| P2 — aquisições e manutenção | Auditar acesso municipal em Energia; manter dossiê de Saúde; preservar as cinco dimensões | Para Energia: mesma coorte/ano, ausências e dispersão avaliadas. Para Saúde: cobertura infantil municipal por ano, precisão e contrato temporal resolvidos | Permanecer como contexto/pesquisa; não estimar acesso municipal a partir de distribuidoras |
| P3 — construtos e geografias | Alimentação, Assistência, Justiça, Ambiente e Cultura | Definir resultado/acesso relevante, população elegível, geografia e período comparáveis antes da coleta | Manter indicadores próprios; não pontuar gasto, existência de programa ou volume como qualidade |
| P4 — fundação dos capítulos | Previdência, Esporte e Serviços | Contrato de indicador e fonte selecionados, coleta reproduzível e painel descritivo auditado | Exibir estágio de desenvolvimento, sem notas de preenchimento |
| Após candidato aprovado | Cesta v3 separada e análise de impacto | Recalcular toda a coorte; justificar pesos por conteúdo; analisar redundância, definições, ausências, pares invertidos e efeito da nova composição | Preservar v2 e apresentar motivo de rejeição do candidato |
| Antes da liberação | Revisão metodológica independente e integração ao produto | Aprovar construto, interpretação e limites; validar jornada, acessibilidade e identificação de edição | Continuar experimental, com produção bloqueada |

As prioridades não são estimativas de duração. A existência de publicação oficial e a resolução dos contratos são dependências externas; não há prazo confiável sem concluí-las.

## Contrato da próxima aquisição: Habitação

1. Investigar uma medida oficial de adensamento domiciliar entre residentes/domicílios de municípios em 2022. Registrar exatamente o que constitui cômodo/dormitório, o limiar e o universo; não escolher um limiar para favorecer resultados.
2. Confirmar as 26 capitais por código IBGE e excluir DF da coorte. Não aceitar geografia estadual, região metropolitana ou arranjo populacional como substituta.
3. Preservar metadados, consulta, data de captura, bytes/hash e notas. Informar se são contagens censitárias ou estimativas amostrais e as medidas de precisão disponíveis.
4. Conferir numerador, denominador positivo, hierarquias, totais, ausências e marcadores de sigilo. Ausência permanece ausência. Percentual deve respeitar 0–100.
5. Examinar validade de conteúdo e correlação com renda e saneamento; investigar piso/teto e dispersão. Correlação alta não determina exclusão sozinha, mas exige justificativa do peso conjunto.
6. Produzir um dossiê de aceitar/rejeitar para revisão. Não recalibrar v2, não preencher os demais capítulos e não anunciar escore integral.

Caso uma fonte municipal de 2022 não seja confirmada, o resultado válido da etapa é uma decisão documentada de não inclusão. Uma nova referência temporal exige outra edição e uma revisão de toda a cesta, não apenas do capítulo novo.

## Regras para qualquer expansão

- Resultados do cidadão, acesso, recursos e eficiência causal são objetos diferentes. O piloto mede resultados descritivos relativos; nenhuma expansão pode transformar o nome em avaliação causal do Estado.
- Referência congelada: 26 capitais, 2022; a janela de Saúde 2021–2023 depende de revisão explícita. Média 50 continua sendo propriedade da normalização.
- Pontuação por capítulo completo exige cobertura conceitual e justificativa dos componentes. Um único indicador proxy não basta para declarar capítulo resolvido.
- Entrada de indicador exige nova versão, pesos explícitos e comparação lado a lado com a cesta anterior. Variação por composição não é evolução histórica.
- Não somar os indicadores de todos os painéis com pesos iguais: isso premiaria capítulos com mais séries e duplicaria fenômenos como renda, infraestrutura e esgotamento.
- Comparação entre países e escore integral dos 16 capítulos continuam fora da implementação validada.

## Verificação desta revisão

O commit anterior teve `interface: success` e `testes: failure`. A falha foi timeout de 5.000 ms em “reconcilia inversões com a auditoria e deduplica os pesos”, não divergência numérica reportada: 4.608 testes passaram, um foi ignorado e um expirou. Nesta entrega o prazo daquele teste passa a 30.000 ms; todas as 325 comparações e inversas, contagens e assertivas são preservadas. Não é uma alteração de fórmula nem um teste de desempenho.

O inventário foi reconciliado com os 16 IDs do catálogo, seus 13 links publicados e as cinco dimensões do snapshot. Caminhos das evidências conferidos na árvore do commit. O corpo numérico do teste exaustivo foi executado localmente com Node 24, remoção de tipos e assertivas equivalentes: 650 avaliações, 37 pares com inversão e três empates desfeitos, em aproximadamente dois segundos. Essa execução não substitui a suíte Vitest/React nem o build completo.

Nova CI integral deve ser conferida no commit da entrega; não se atribui a ele o resultado da execução anterior.

## Evidências versionadas

- [docs/obee/resultados/EXPANSAO_V2.md](https://github.com/genarolins1975/scrutiniums/blob/64f6a9e1b42a64c8d161b29d3d3fa5f70f29ece7/docs/obee/resultados/EXPANSAO_V2.md)
- [docs/obee/resultados/CAPTURA_RECAPTURA_SAUDE.md](https://github.com/genarolins1975/scrutiniums/blob/64f6a9e1b42a64c8d161b29d3d3fa5f70f29ece7/docs/obee/resultados/CAPTURA_RECAPTURA_SAUDE.md)
- [src/app/eficiencia-estatal/page.tsx](https://github.com/genarolins1975/scrutiniums/blob/64f6a9e1b42a64c8d161b29d3d3fa5f70f29ece7/src/app/eficiencia-estatal/page.tsx)
- [src/lib/eficiencia/dimensoes.ts](https://github.com/genarolins1975/scrutiniums/blob/64f6a9e1b42a64c8d161b29d3d3fa5f70f29ece7/src/lib/eficiencia/dimensoes.ts)
- [src/lib/eficiencia/energia/dados.ts](https://github.com/genarolins1975/scrutiniums/blob/64f6a9e1b42a64c8d161b29d3d3fa5f70f29ece7/src/lib/eficiencia/energia/dados.ts)

Também foram considerados os contratos e limites documentados em [EXPANSAO_V2.md](EXPANSAO_V2.md), [CAPTURA_RECAPTURA_SAUDE.md](CAPTURA_RECAPTURA_SAUDE.md) e [ROBUSTEZ_EMPIRICA.md](ROBUSTEZ_EMPIRICA.md). Esta é uma revisão das evidências versionadas, não um levantamento exaustivo de todas as fontes públicas existentes.
