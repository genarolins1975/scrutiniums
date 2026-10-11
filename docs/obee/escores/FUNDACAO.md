# Fundação de dados dos escores OBEE

Etapa 2 do roadmap. Esta entrega adiciona uma matriz de 15 fichas, adaptadores para evidências reais, um gate de elegibilidade e um relatório reproduzível. Não altera o contrato v0.4, notas ou interface pública.

## Resultado

- 15 pilares documentados, 0 validados para pontuação.
- Prova com Recife e Curitiba: Saeb 2023, português, anos iniciais, rede municipal. Valores reproduzidos do CSV existente: 199,90 e 218,13 pontos da escala Saeb, respectivamente. Não são notas OBEE nem medidas de toda a educação no território.
- Contexto regional separado: domicílios em segurança alimentar, PNADC 2024, Nordeste 65,2% e Sul 86,4%. Não atribuídos às cidades nem ao escore de atendimento.
- Dois perfis com cinco capítulos e 15 motivos por pilar; notas agregadas indisponíveis.

A prova verifica integração de evidências já publicadas no repositório, não uma nova auditoria dos arquivos oficiais originais. Base consultada: `d14ca1c01b215cfae1afa10573c1e923bab27d12`. Cada observação guarda caminho, hash dos bytes, período, universo e localizador. O relatório não é destinado a public/.

## Reprodução

```sh
python3 -m unittest pipeline.eficiencia_escores.test_fundacao -v
python3 -m pipeline.eficiencia_escores.fundacao --output docs/obee/escores/diagnostico-fundacao.json
```

Somente Python padrão. Os testes usam exemplos sintéticos apenas para regras matemáticas, separados das observações reais. Nove testes aprovados no ambiente local. Build, TypeScript, suíte completa e interface não foram executados nesta entrega isolada.

## Decisões de implementação

O piloto usa um indicador de aprendizagem como evidência candidata; não preenche qualidade com Saeb sem validação de participação e referências. Os demais pilares permanecem indisponíveis. Nenhuma referência numérica foi inventada. A integração de todos os capítulos e o cálculo real continuam dependentes da obtenção de medidas adequadas.

O agregador recebe uma cesta explícita e verifica território, edição e janela comparável. A janela deve ser validada antes da produção; sua igualdade textual sozinha não comprova comparabilidade. A versão diagnóstica não substitui o cálculo TypeScript em produção. Os perfis são preparados para a futura interface, ainda sem adaptador de apresentação.

## Fichas dos 15 pilares

### Educação — access

- Indicador candidato: Atendimento da população elegível.
- Fórmula: 100 × pessoas elegíveis atendidas / pessoas elegíveis.
- Denominador ou universo: Pessoas elegíveis residentes, por etapa.
- Evidência existente: Censo Escolar: matrículas; população total IBGE.
- Cobertura existente: 26 capitais; rede municipal; edições por indicador.
- Fonte de diagnóstico: [pipeline/eficiencia/catalogo_indicadores.json](https://github.com/genarolins1975/scrutiniums/blob/d14ca1c01b215cfae1afa10573c1e923bab27d12/pipeline/eficiencia/catalogo_indicadores.json).
- Estado: `COBERTURA_INSUFICIENTE`. Referências inferior e superior pendentes; nenhuma nota calculada.
- Bloqueio: Matrículas não são pessoas únicas residentes; população total não é população elegível. Referências de pontuação não validadas
- Ação necessária: Integrar frequência por idade/residência e definir perímetro público.

### Educação — response

- Indicador candidato: Cumprimento do calendário.
- Fórmula: 100 × dias de atendimento cumpridos / dias previstos.
- Denominador ou universo: Dias previstos no calendário da mesma rede e ano.
- Evidência existente: Aprovação escolar é fluxo; não mede calendário cumprido.
- Cobertura existente: 26 capitais; rede municipal; edições por indicador.
- Fonte de diagnóstico: [pipeline/eficiencia/catalogo_indicadores.json](https://github.com/genarolins1975/scrutiniums/blob/d14ca1c01b215cfae1afa10573c1e923bab27d12/pipeline/eficiencia/catalogo_indicadores.json).
- Estado: `COBERTURA_INSUFICIENTE`. Referências inferior e superior pendentes; nenhuma nota calculada.
- Bloqueio: Calendário realizado e espera por matrícula não integrados. Referências de pontuação não validadas
- Ação necessária: Buscar execução do calendário e fila com coortes e datas.

### Educação — quality

- Indicador candidato: Aprendizagem no Saeb.
- Fórmula: Proficiência média publicada, por etapa e disciplina; sem média entre escalas.
- Denominador ou universo: Universo de participantes da rede municipal na etapa e disciplina.
- Evidência existente: Saeb, edu.saeb.rede_municipal; piloto 2023.
- Cobertura existente: 26 capitais; rede municipal; edições por indicador.
- Fonte de diagnóstico: [pipeline/eficiencia/catalogo_indicadores.json](https://github.com/genarolins1975/scrutiniums/blob/d14ca1c01b215cfae1afa10573c1e923bab27d12/pipeline/eficiencia/catalogo_indicadores.json).
- Estado: `REFERENCIA_PENDENTE`. Referências inferior e superior pendentes; nenhuma nota calculada.
- Bloqueio: Âncoras e representatividade ainda não validadas; evitar duplicação com IDEB. Referências de pontuação não validadas
- Ação necessária: Validar participação, escala e referências por etapa/disciplina.

### Saúde — access

- Indicador candidato: Necessidade assistencial atendida.
- Fórmula: 100 × pessoas com necessidade atendida / pessoas com necessidade.
- Denominador ou universo: Pessoas com necessidade na janela e modalidade.
- Evidência existente: APS potencial e CNES.
- Cobertura existente: 26 capitais; APS por competência; ICSAP 2021–2024.
- Fonte de diagnóstico: [docs/obee/saude/CATALOGO_COBERTURA_FORMULAS.md](https://github.com/genarolins1975/scrutiniums/blob/d14ca1c01b215cfae1afa10573c1e923bab27d12/docs/obee/saude/CATALOGO_COBERTURA_FORMULAS.md).
- Estado: `COBERTURA_INSUFICIENTE`. Referências inferior e superior pendentes; nenhuma nota calculada.
- Bloqueio: Capacidade teórica e cadastro não demonstram atendimento efetivo. Referências de pontuação não validadas
- Ação necessária: Localizar pesquisa de necessidade e atendimento ou registro com demanda completa.

### Saúde — response

- Indicador candidato: Espera por cuidado.
- Fórmula: Mediana de dias entre solicitação elegível e atendimento; fila aberta separada.
- Denominador ou universo: Solicitações da mesma coorte e procedimento; censura explicitada.
- Evidência existente: Não há série integrada de espera ou continuidade.
- Cobertura existente: 26 capitais; APS por competência; ICSAP 2021–2024.
- Fonte de diagnóstico: [docs/obee/saude/CATALOGO_COBERTURA_FORMULAS.md](https://github.com/genarolins1975/scrutiniums/blob/d14ca1c01b215cfae1afa10573c1e923bab27d12/docs/obee/saude/CATALOGO_COBERTURA_FORMULAS.md).
- Estado: `COBERTURA_INSUFICIENTE`. Referências inferior e superior pendentes; nenhuma nota calculada.
- Bloqueio: Só casos concluídos podem ocultar os que continuam aguardando. Referências de pontuação não validadas
- Ação necessária: Integrar coortes de solicitações e atendimento, com pendentes.

### Saúde — quality

- Indicador candidato: Resultados e segurança do cuidado.
- Fórmula: Indicador específico após ajuste de risco validado; não fixado nesta edição.
- Denominador ou universo: População em risco e universo assistencial compatível.
- Evidência existente: ICSAP bruta por residência e cobertura de planos.
- Cobertura existente: 26 capitais; APS por competência; ICSAP 2021–2024.
- Fonte de diagnóstico: [docs/obee/saude/CATALOGO_COBERTURA_FORMULAS.md](https://github.com/genarolins1975/scrutiniums/blob/d14ca1c01b215cfae1afa10573c1e923bab27d12/docs/obee/saude/CATALOGO_COBERTURA_FORMULAS.md).
- Estado: `COBERTURA_INSUFICIENTE`. Referências inferior e superior pendentes; nenhuma nota calculada.
- Bloqueio: Taxa bruta não ajusta idade nem oferta; não mede causalmente qualidade. Referências de pontuação não validadas
- Ação necessária: Avaliar desfecho com ajuste e fontes de segurança, preservando bruto.

### Trabalho e Renda — access

- Indicador candidato: Acesso à intermediação ou qualificação.
- Fórmula: 100 × elegíveis únicos atendidos / elegíveis demandantes.
- Denominador ou universo: Demandantes elegíveis por modalidade.
- Evidência existente: PNAD, Censo, CadÚnico e cursos autorizados.
- Cobertura existente: PNAD Brasil/UF até 2026T2; Censo municipal 2022; CNAP outubro 2026.
- Fonte de diagnóstico: [docs/obee/TRABALHO_RENDA_DADOS.md](https://github.com/genarolins1975/scrutiniums/blob/d14ca1c01b215cfae1afa10573c1e923bab27d12/docs/obee/TRABALHO_RENDA_DADOS.md).
- Estado: `COBERTURA_INSUFICIENTE`. Referências inferior e superior pendentes; nenhuma nota calculada.
- Bloqueio: Autorização não é vaga, matrícula nem atendimento; cadastro não é demanda. Referências de pontuação não validadas
- Ação necessária: Integrar registros de intermediação/qualificação com demanda e atendimento.

### Trabalho e Renda — response

- Indicador candidato: Conclusão do atendimento.
- Fórmula: 100 × atendimentos concluídos na janela pactuada / solicitações elegíveis da coorte.
- Denominador ou universo: Solicitações elegíveis da mesma modalidade e coorte.
- Evidência existente: Cursos autorizados sem trajetórias de atendimento.
- Cobertura existente: PNAD Brasil/UF até 2026T2; Censo municipal 2022; CNAP outubro 2026.
- Fonte de diagnóstico: [docs/obee/TRABALHO_RENDA_DADOS.md](https://github.com/genarolins1975/scrutiniums/blob/d14ca1c01b215cfae1afa10573c1e923bab27d12/docs/obee/TRABALHO_RENDA_DADOS.md).
- Estado: `COBERTURA_INSUFICIENTE`. Referências inferior e superior pendentes; nenhuma nota calculada.
- Bloqueio: Faltam datas, coortes, pendências e conclusão. Referências de pontuação não validadas
- Ação necessária: Localizar acompanhamento dos atendimentos e cursos realizados.

### Trabalho e Renda — quality

- Indicador candidato: Inserção e permanência após atendimento.
- Fórmula: 100 × participantes inseridos e mantidos no horizonte / participantes acompanháveis da coorte.
- Denominador ou universo: Participantes elegíveis com acompanhamento; perdas explicitadas.
- Evidência existente: PNAD e vínculos Caged como contexto.
- Cobertura existente: PNAD Brasil/UF até 2026T2; Censo municipal 2022; CNAP outubro 2026.
- Fonte de diagnóstico: [docs/obee/TRABALHO_RENDA_DADOS.md](https://github.com/genarolins1975/scrutiniums/blob/d14ca1c01b215cfae1afa10573c1e923bab27d12/docs/obee/TRABALHO_RENDA_DADOS.md).
- Estado: `COBERTURA_INSUFICIENTE`. Referências inferior e superior pendentes; nenhuma nota calculada.
- Bloqueio: Não há ligação entre serviço e trajetória individual; perdas podem enviesar. Referências de pontuação não validadas
- Ação necessária: Definir horizonte, rastreamento e ajuste de perfil; não alegar causalidade.

### Segurança Alimentar — access

- Indicador candidato: Atendimento alimentar por modalidade.
- Fórmula: 100 × pessoas elegíveis únicas atendidas / pessoas elegíveis.
- Denominador ou universo: Elegíveis à modalidade; sem somar PNAE, restaurantes e auxílio.
- Evidência existente: EBIA e equipamentos/ações MUNIC.
- Cobertura existente: PNADC Brasil/regiões 2023–2024; MUNIC 2024 com perguntas 2023.
- Fonte de diagnóstico: [docs/obee/seguranca-alimentar/README.md](https://github.com/genarolins1975/scrutiniums/blob/d14ca1c01b215cfae1afa10573c1e923bab27d12/docs/obee/seguranca-alimentar/README.md).
- Estado: `COBERTURA_INSUFICIENTE`. Referências inferior e superior pendentes; nenhuma nota calculada.
- Bloqueio: EBIA é desfecho; existência de equipamento não mede atendimento. Referências de pontuação não validadas
- Ação necessária: Integrar atendimentos e denominadores próprios por modalidade.

### Segurança Alimentar — response

- Indicador candidato: Regularidade das entregas.
- Fórmula: 100 × entregas previstas efetivamente cumpridas / entregas previstas.
- Denominador ou universo: Entregas ou dias previstos na mesma modalidade.
- Evidência existente: Declaração de ações MUNIC.
- Cobertura existente: PNADC Brasil/regiões 2023–2024; MUNIC 2024 com perguntas 2023.
- Fonte de diagnóstico: [docs/obee/seguranca-alimentar/README.md](https://github.com/genarolins1975/scrutiniums/blob/d14ca1c01b215cfae1afa10573c1e923bab27d12/docs/obee/seguranca-alimentar/README.md).
- Estado: `COBERTURA_INSUFICIENTE`. Referências inferior e superior pendentes; nenhuma nota calculada.
- Bloqueio: Faltam registros de entregas e interrupções. Referências de pontuação não validadas
- Ação necessária: Integrar calendário previsto e execução verificada.

### Segurança Alimentar — quality

- Indicador candidato: Conformidade nutricional e sanitária.
- Fórmula: 100 × entregas conformes / entregas avaliadas em amostra representativa.
- Denominador ou universo: Entregas avaliadas; desenho da amostra e cobertura explícitos.
- Evidência existente: Não há conformidade de entrega integrada.
- Cobertura existente: PNADC Brasil/regiões 2023–2024; MUNIC 2024 com perguntas 2023.
- Fonte de diagnóstico: [docs/obee/seguranca-alimentar/README.md](https://github.com/genarolins1975/scrutiniums/blob/d14ca1c01b215cfae1afa10573c1e923bab27d12/docs/obee/seguranca-alimentar/README.md).
- Estado: `COBERTURA_INSUFICIENTE`. Referências inferior e superior pendentes; nenhuma nota calculada.
- Bloqueio: Quantidade e existência de programas não medem conformidade. Referências de pontuação não validadas
- Ação necessária: Localizar inspeções e amostras comparáveis; validar protocolos.

### Assistência Social e Cuidado — access

- Indicador candidato: Atendimento da demanda elegível.
- Fórmula: 100 × pessoas ou famílias elegíveis únicas atendidas / demanda elegível.
- Denominador ou universo: Demanda da modalidade, unidade pessoa ou família fixa.
- Evidência existente: CRAS/CREAS/centros-dia e RMA a1,a2,c1,c5.
- Cobertura existente: Censo SUAS e RMA CRAS 2025; unidade/mês e agrupamento por UF.
- Fonte de diagnóstico: [docs/obee/assistencia/README.md](https://github.com/genarolins1975/scrutiniums/blob/d14ca1c01b215cfae1afa10573c1e923bab27d12/docs/obee/assistencia/README.md).
- Estado: `COBERTURA_INSUFICIENTE`. Referências inferior e superior pendentes; nenhuma nota calculada.
- Bloqueio: Registros podem repetir usuários; CadÚnico não é toda a demanda. Referências de pontuação não validadas
- Ação necessária: Deduplicar e definir demanda e cobertura das unidades ativas.

### Assistência Social e Cuidado — response

- Indicador candidato: Continuidade e encaminhamento concluído.
- Fórmula: 100 × acompanhamentos previstos concluídos / acompanhamentos previstos da coorte.
- Denominador ou universo: Coorte elegível por modalidade; pendências mantidas.
- Evidência existente: Espera cadastral e práticas declaradas no Censo SUAS.
- Cobertura existente: Censo SUAS e RMA CRAS 2025; unidade/mês e agrupamento por UF.
- Fonte de diagnóstico: [docs/obee/assistencia/README.md](https://github.com/genarolins1975/scrutiniums/blob/d14ca1c01b215cfae1afa10573c1e923bab27d12/docs/obee/assistencia/README.md).
- Estado: `COBERTURA_INSUFICIENTE`. Referências inferior e superior pendentes; nenhuma nota calculada.
- Bloqueio: Espera cadastral não é espera geral; plano não prova continuidade. Referências de pontuação não validadas
- Ação necessária: Integrar trajetória e conclusão; não somar estoques mensais.

### Assistência Social e Cuidado — quality

- Indicador candidato: Adequação e segurança do cuidado.
- Fórmula: 100 × atendimentos conformes / atendimentos avaliados com desenho válido.
- Denominador ou universo: Atendimentos avaliados por modalidade e protocolo.
- Evidência existente: Estrutura e acessibilidade autodeclaradas.
- Cobertura existente: Censo SUAS e RMA CRAS 2025; unidade/mês e agrupamento por UF.
- Fonte de diagnóstico: [docs/obee/assistencia/README.md](https://github.com/genarolins1975/scrutiniums/blob/d14ca1c01b215cfae1afa10573c1e923bab27d12/docs/obee/assistencia/README.md).
- Estado: `COBERTURA_INSUFICIENTE`. Referências inferior e superior pendentes; nenhuma nota calculada.
- Bloqueio: Autodeclaração não equivale a inspeção ou resultado do cuidado. Referências de pontuação não validadas
- Ação necessária: Integrar inspeção, segurança e resultado verificável.

## Próximas dependências

1. Selecionar medidas de acesso e resposta com denominador e coortes compatíveis.
2. Validar âncoras por indicador, etapa e modalidade; concluir análise metodológica.
3. Ampliar adaptadores para os indicadores aprovados sem transferir UF/região para município.
4. Integrar o resumo à página inicial com ausências explícitas; só então ativar cálculo quando elegível.

A fundação técnica e o inventário estão implementados; o aceite integral da etapa 2, que exige duas unidades com escore válido de ponta a ponta, permanece bloqueado por dados e referências. O piloto demonstra o caminho de dados e o bloqueio correto, não satisfaz esse aceite numérico.

