# Primeiro componente real: qualidade da Educação

Proposta operacional de 11/10/2026. Não aprova referência, escore ou alteração da cesta.

## Objeto do piloto

Proficiência média em Língua Portuguesa no 5º ano do ensino fundamental, Saeb 2023, escolas urbanas da rede municipal, nas 26 capitais estaduais. O piloto utiliza uma etapa e uma disciplina para evitar mistura de escalas. A cobertura efetiva deve ser apurada, sem preencher ausências. A rede é definida pela escola, não pela residência do estudante.

Isso operacionaliza apenas `education.quality`. O capítulo Educação exige também acesso e resposta; o agregado exige a cesta completa aprovada. Validar a aprendizagem não autoriza chamar o resultado de satisfação, eficiência ou nota de todos os serviços educacionais.

## Evidência conferida

Reinspeção do arquivo local preservado `Resultados_Saeb_2023_Brasil_Estados_Municipios.xlsb`, aba Municípios, com 113 colunas. O manifesto JSON anexo registra cabeçalhos e SHA-256. A conferência confirma, sem constituir nova descoberta, a auditoria em `docs/obee/cobertura/AUDITORIA_FONTE_SAEB.md`: não há campos de participantes, população elegível ou taxa de participação nessa aba.

Não foram recalculadas as 104 posições da conciliação anterior nem adquirida nova planilha. A inspeção desta rodada foi do cabeçalho e do hash. O indicador descritivo atual permanece inalterado.

## Dados necessários para a próxima execução

| Evidência | Critério de aceitação |
|---|---|
| Dicionário dos microdados | Identificar quais campos e arquivos efetivamente existem; não presumir nomes de variáveis |
| Chaves do recorte | Município IBGE, edição, dependência, localização, etapa e disciplina compatíveis com o resultado |
| Participação | Numerador e denominador com definição oficial, recorte coincidente e regras de transferências/provas extras registradas |
| Ausências | Motivo de não divulgação identificado por célula; não inferido apenas de vazio |
| Comparabilidade | Revisão da seleção, cobertura e limitações; participação isolada não encerra a validação do indicador |
| Referências OBEE | Âncoras justificadas para a escala específica; sem usar o maior/menor valor observado automaticamente como padrão de serviço |
| Composição | Verificar sobreposição com Ideb e documentar qual informação entra uma única vez |

Se a fonte só fornecer participação para o total urbano e rural, ela não atende ao piloto urbano. Nesse caso deve-se avaliar uma nova edição metodológica usando a proficiência do universo total, preservando os valores e a identificação da edição anterior. Essa mudança não está autorizada por este documento e não foi executada.

## Aquisição e sequência

1. Portal oficial de microdados consultado; o endereço do pacote foi extraído do HTML oficial: https://download.inep.gov.br/microdados/microdados_saeb_2023.zip. Localizar o pacote não comprova que seus campos sustentam o piloto.
2. Aquisição seletiva concluída nesta rodada: dicionário e TS_ESCOLA obtidos e conferidos, conforme diligência abaixo. Buscar agora publicação oficial que discrimine a rede municipal urbana; não presumir que o pacote aberto resolva esse recorte.
3. Reconciliar participantes e denominadores por recorte, mantendo os casos sem evidência separados.
4. Produzir proposta das referências e analisar sensibilidade com dados reais. Submeter a decisão metodológica antes da promoção de `validated`.
5. Somente depois avaliar acesso e resposta para fechar o capítulo. Nenhuma pendência é resolvida pela remoção silenciosa de um pilar.

Fontes consultadas:

- Resultados oficiais: https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/saeb/resultados
- Microdados oficiais: https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/saeb
- Captura anterior: https://download.inep.gov.br/saeb/resultados/planilha_de_resultados_2023.rar

Não se utilizou como evidência substantiva o conteúdo de notas técnicas localizado apenas em resultados de busca: a tentativa de abertura da Nota Técnica 34 retornou 502, e a Nota Conjunta 25/2023 exigiu verificação humana. Nenhuma verificação humana foi contornada.

## Saída desta etapa

Contrato do piloto e requisitos de aquisição registrados em formato legível e JSON, com fontes identificadas. Nenhuma ficha foi promovida a validada; nenhum escore real foi calculado; nenhum ajuste visual ou publicação foi realizado nesta rodada. A conclusão do piloto segue dependente da evidência específica da rede municipal e validação das referências.

## Diligência nova: microdados efetivamente inspecionados

O download integral (693.837.927 bytes) atingiu timeout após 41.450.195 bytes. O servidor confirmou suporte a HTTP Range. Foram então obtidos apenas o índice do ZIP, o dicionário XLSX (217.559 bytes) e TS_ESCOLA.csv (21.685.665 bytes descomprimidos). Cada membro foi conferido por tamanho e CRC32 do ZIP, além de SHA-256 local. O ZIP integral não foi adquirido.

TS_ESCOLA contém **70.151 registros** e os campos `NU_MATRICULADOS_CENSO_5EF`, `NU_PRESENTES_5EF` e `TAXA_PARTICIPACAO_5EF`. Contudo, o campo de rede é `IN_PUBLICA`, sem distinção entre municipal, estadual e federal. O dicionário identifica `ID_MUNICIPIO` e `ID_ESCOLA` como máscaras fictícias. `ID_UF` com `ID_AREA` permite separar capital/interior por UF; isso não resolve a dependência administrativa exigida pelo piloto. Não houve tentativa de reconstruir identidades escolares nem junção com códigos IBGE.

**Decisão:** a dificuldade de aquisição parcial foi superada, mas esta fonte não sustenta a conciliação da participação do universo municipal urbano usado no painel. Não substituir rede municipal por rede pública, não calcular participação municipal a partir deste campo e não promover a ficha a validada.

Evidência reproduzível em `MICRODADOS_SAEB_2023_DILIGENCIA.json`: hashes, membros, cabeçalhos e células do dicionário com linhas originais. A extração do dicionário e a inspeção da escola não equivalem à leitura dos microdados individuais de estudantes ou de todo o relatório técnico.

Reprodução, usando apenas biblioteca padrão Python:

```sh
python3 scripts/eficiencia/auditar-microdados-saeb.py --acquire --cache-dir /tmp/saeb-piloto --output docs/obee/escores/MICRODADOS_SAEB_2023_DILIGENCIA.json
```

Sem `--acquire`, o script confere os membros locais contra o manifesto e refaz a inspeção. A nova fonte prioritária passa a ser uma tabulação oficial de participação por **rede municipal, localização urbana e etapa**. Caso não esteja publicada, preparar pedido de tabulação ao Inep; nenhum pedido externo foi enviado nesta rodada.
