# Dados reais para calibração — revisão de 11/10/2026

Captura nova: IBGE/SIDRA 10056, Censo 2022, variável 3795. São 104 observações das 26 capitais estaduais e quatro do Brasil: faixas 0–3, 4–5, 6–14 e 15–17 anos, sexo e cor/raça totais. Todas as 108 células são numéricas nesta captura. Respostas originais, metadados, consultas e hashes SHA-256 estão em `evidencias/`. O total Brasil vem da fonte; não é média das capitais.

## O avanço e o limite

A frequência por idade e residência é evidência mais adequada de acesso territorial do que matrículas divididas pela população total. A tabela, porém, não distingue rede pública/privada nem demanda por atendimento público. Portanto entra como contexto descritivo e não substitui `education.access`. Também não deve ser agregada automaticamente ao Saeb 2023 da rede municipal urbana: ano, universo e medida diferem. Referências 0/100 não são aprovadas apenas porque a unidade é percentual.

A extração não integra ainda a interface pública. Nenhuma referência de escore é liberada. A comparação contextual não mede qualidade, satisfação ou eficiência causal.

## Revisão das 15 fichas

Revisão baseada nas fichas e documentação dos cinco capítulos no commit `76bfae2ab506535d295580cb853aa389ca1e6d1c`. Os demais capítulos não receberam nova captura primária nesta entrega.

| Componente | Evidência disponível | Pendência para o escore |
|---|---|---|
| education.access | Nova captura: frequência escolar 2022 nas 26 capitais, todas as redes | Integrar frequência por idade/residência e definir perímetro público. |
| education.response | Aprovação escolar é fluxo; não mede calendário cumprido | Buscar execução do calendário e fila com coortes e datas. |
| education.quality | Saeb, edu.saeb.rede_municipal; piloto 2023 | Validar participação, escala e referências por etapa/disciplina. |
| health.access | APS potencial e CNES | Localizar pesquisa de necessidade e atendimento ou registro com demanda completa. |
| health.response | Não há série integrada de espera ou continuidade | Integrar coortes de solicitações e atendimento, com pendentes. |
| health.quality | ICSAP bruta por residência e cobertura de planos | Avaliar desfecho com ajuste e fontes de segurança, preservando bruto. |
| work.access | PNAD, Censo, CadÚnico e cursos autorizados | Integrar registros de intermediação/qualificação com demanda e atendimento. |
| work.response | Cursos autorizados sem trajetórias de atendimento | Localizar acompanhamento dos atendimentos e cursos realizados. |
| work.quality | PNAD e vínculos Caged como contexto | Definir horizonte, rastreamento e ajuste de perfil; não alegar causalidade. |
| food.access | EBIA e equipamentos/ações MUNIC | Integrar atendimentos e denominadores próprios por modalidade. |
| food.response | Declaração de ações MUNIC | Integrar calendário previsto e execução verificada. |
| food.quality | Não há conformidade de entrega integrada | Localizar inspeções e amostras comparáveis; validar protocolos. |
| assistance.access | CRAS/CREAS/centros-dia e RMA a1,a2,c1,c5 | Deduplicar e definir demanda e cobertura das unidades ativas. |
| assistance.response | Espera cadastral e práticas declaradas no Censo SUAS | Integrar trajetória e conclusão; não somar estoques mensais. |
| assistance.quality | Estrutura e acessibilidade autodeclaradas | Integrar inspeção, segurança e resultado verificável. |

## Ordem de execução proposta

1. Integrar frequência escolar como comparação contextual na página inicial, com faixa etária selecionável, ano 2022, fonte e ressalva sobre redes.
2. Resolver recorte público/residencial do acesso e participação do Saeb; manter a nota de Educação bloqueada enquanto faltarem resposta e referências.
3. Priorizar registros de demanda e atendimento em Saúde e Assistência; capacidade instalada e formulários mensais não resolvem os denominadores.
4. Em Trabalho e Alimentação, localizar trajetórias e execução por modalidade; resultados sociais gerais permanecem contexto.
5. Só definir âncoras e calibrar a cesta quando existir cobertura compatível. A arquitetura uniforme de três pilares pode exigir revisão metodológica se as fontes não suportarem esses conceitos; não preencher com proxies silenciosamente.

## Reprodução

```
python3 -m pipeline.eficiencia_escores.coletar_frequencia
python3 -m pipeline.eficiencia_escores.verificar_frequencia
```

A conferência valida hashes, 26 códigos municipais × quatro idades, quatro registros nacionais, ausência de duplicatas, período, variável, sexo, cor/raça, unidade e intervalo. Símbolos da fonte são preservados, sem conversão silenciosa em zero. Verificações desta captura passaram; não constituem validação metodológica do escore.



## Integração ao Atlas — 11/10/2026

A página inicial passa a oferecer frequência escolar e aprendizagem Saeb como medidas alternativas na mesma seção. Frequência usa as duas capitais selecionadas e a taxa nacional publicada, quatro faixas etárias, barras de 0–100%, tabela equivalente e CSV integral (108 observações). A referência temporal e a inclusão de redes públicas/privadas ficam visíveis. Indicador e faixa etária são preservados na URL junto às capitais, com restauração por histórico.

A frequência é a medida inicial da comparação municipal; o resumo de aprendizagem no topo permanece identificado como Saeb e seu link abre essa medida. A comparação regional de segurança alimentar é preservada. Nenhum desses valores preenche escores.

Reprodução: `python3 scripts/eficiencia/gerar-frequencia-atlas.py`. O gerador verifica os hashes originais, recortes, duplicatas e cobertura exata antes de materializar JSON/CSV. Oito testes Vitest conferem todos os valores/hashes, download e renderização das quatro faixas. Tipos e lint dos componentes passaram. Build e verificação visual são registrados no PR após a execução.

Foi corrigida a preservação de bytes dos originais SIDRA de capitais e Brasil: a transferência anterior havia convertido CRLF em LF. Os arquivos foram restaurados da captura original preservada, sem mudança dos valores ou dos hashes declarados no manifesto.
