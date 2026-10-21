# Participação Saeb 2023: especificação de tabulação agregada

Preparada em 12/10/2026. **Minuta técnica; não enviada.** Não solicita registros de alunos, identificadores mascarados ou reidentificação.

## Objeto

Solicitar ao Inep tabulação existente, ou orientação para fonte pública equivalente, que permita avaliar a participação no Saeb 2023 no mesmo universo das médias municipais publicadas de Língua Portuguesa do 5º ano do ensino fundamental: dependência municipal, localização urbana, 26 capitais estaduais, sem Distrito Federal.

## Campos necessários

| Campo | Definição solicitada |
|---|---|
| Município | Nome, UF e código IBGE público |
| Edição, etapa e disciplina | 2023, 5º ano EF, Língua Portuguesa |
| Dependência e localização | Municipal e urbana, com classificação oficial |
| População elegível | Quantidade e regra de inclusão no denominador |
| Participantes | Quantidade e critério de presença/resultado válido |
| Participação | Taxa, fórmula, arredondamento e escala |
| Divulgação | Indicador de divulgação, supressão e motivo |
| Comparabilidade | Ressalvas, exclusões e relação com MEDIA_5_LP publicada |

Se participação for definida conjuntamente para as disciplinas, informar essa definição e sua compatibilidade com a média de Língua Portuguesa. Informar tratamento de transferências, provas extras, escolas/estudantes sem resultado e demais exclusões aplicáveis. Solicitar dicionário e versão/data de atualização. Preferir CSV ou XLSX e preservar sigilo estatístico.

## Capitais

Aracaju, Belém, Belo Horizonte, Boa Vista, Campo Grande, Cuiabá, Curitiba, Florianópolis, Fortaleza, Goiânia, João Pessoa, Macapá, Maceió, Manaus, Natal, Palmas, Porto Alegre, Porto Velho, Recife, Rio Branco, Rio de Janeiro, Salvador, São Luís, São Paulo, Teresina e Vitória. Códigos públicos estão no cadastro versionado `src/lib/eficiencia/panorama-atlas.json`.

## Por que as fontes já examinadas não substituem a tabulação

- Resultados municipais Saeb: média com recorte municipal urbano, mas planilha revisada sem os denominadores necessários.
- TS_ESCOLA dos microdados gerais: possui participação por etapa, porém só distingue pública/privada; municípios e escolas mascarados.
- VAAR/Fundeb: o dicionário identifica município IBGE e dependência administrativa. A planilha publicada oferece IPSaeb por ente; para municípios, reúne 5º e 9º anos. O dicionário revisado não oferece localização urbana. A microbase ainda não foi inspecionada e não se infere seu conteúdo além do dicionário.

## Critério de encerramento

Uma resposta sem etapa ou localização permanece insuficiente para o piloto atual. Não substituir silenciosamente o universo. Eventual revisão para outro indicador exige contrato próprio, revisão metodológica e conferência das referências. Mesmo com participação compatível, ainda faltam validação das âncoras e os demais componentes para um escore de capítulo.

Envio externo depende de autorização explícita; esta entrega apenas prepara o material.
