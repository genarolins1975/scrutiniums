# Inventário e arquitetura do OBEE

## 1. O que foi examinado

Exame do repositório `scrutiniums` (commit de partida `2065ba07f`, 08/10/2026), por inspeção de código. O "Observatório Brasileiro de Crédito" citado no prompt é o domínio `credito` deste mesmo repositório: o design e a implementação foram examinados no código, não apenas visualmente. Nenhum outro projeto foi acessado.

| Item | Estado observado | Evidência | Decisão |
| --- | --- | --- | --- |
| Plataforma, framework e comandos | Existe | Next.js 14 (App Router), TypeScript, Tailwind; `npm run dev/build/lint/test`; `package.json` | Reutilizar |
| Padrão de domínio analítico em páginas estáticas | Existe | Setor Elétrico: `src/app/setor-eletrico`, gold lida no build (`src/lib/energia/gold.ts`) | Reutilizar o padrão; domínio próprio `eficiencia` |
| Pipeline de dados com proveniência | Existe | `pipeline/energia/` (bronze com sha256, gold com proveniência), Python stdlib | Adaptar: `pipeline/eficiencia/`, mais simples (dados anuais, sem vintages) |
| Registro de domínios | Existe | `src/lib/dominios.ts` (credito, energia) | Não alterado nesta etapa (ver decisão D6) |
| Tokens visuais, tipografia, rótulos | Existe | `tailwind.config.ts`, `src/app/globals.css`, fontes locais Playfair, Inter, Archivo Narrow | Reutilizar; acrescentado o acento `obee` |
| Estado de filtros na URL | Existe | `src/lib/energia/estadoUrl.ts` (puro) e `src/components/energia/useEstadoUrl.ts` | Reutilizar sem cópia |
| Escalas e ticks de gráfico | Existe | `src/lib/energia/escalas.ts` (`dominioBonito`, `escalaLinear`) | Reutilizar |
| Selo de natureza, drawer de proveniência, painel de seis perguntas | Existe | `src/components/evidencia/*` | Parcial: `Indisponivel` reutilizado; o `PainelEvidencia` não, porque seus campos "Por que isso importa?" e "O que mudou?" induzem conclusão, vedada pela regra editorial do OBEE |
| Testes | Existe | vitest (`src/tests`), unittest (`pipeline/tests`), CI em `.github/workflows/ci.yml` | Novos testes nos dois conjuntos; nada a configurar no CI |
| Revisão visual | Parcial | Sem Playwright no projeto; Chromium e Playwright globais no ambiente | Capturas e axe-core por script fora do repositório (registrado em VALIDACAO.md) |
| Fontes de educação e contas públicas | Ausente | Nenhum coletor de INEP, Siconfi ou IBGE-IPCA no repositório | Implementado |
| Credenciais | Não necessárias | APIs e arquivos públicos | Nenhuma credencial criada |
| Publicação | Existe | Vercel a partir de `main` (README, workflows) | Fora desta etapa: entrega em branch |

Problemas técnicos concretos encontrados e tratados:

1. **Cadeia de certificado incompleta em `download.inep.gov.br`** (intermediário "RNP ICPEdu GR46 OV TLS CA 2025" ausente). Tratamento: intermediário obtido pelo endereço AIA do próprio certificado (GlobalSign) e acrescentado a um pacote de CAs local da coleta. A verificação TLS nunca foi desligada.
2. **ATU 2022**: o `.xlsx` do pacote oficial não confere com o MD5 publicado pelo INEP no mesmo pacote (regravado depois do arquivo de MD5); o `.ods` confere. Regra adotada: ler a planilha cuja integridade confere. Comparação feita: 380 linhas das capitais idênticas entre `.xlsx` e `.ods`.
3. **Censo Escolar 2025 mudou de leiaute**: tabelas separadas (escola, matrícula, turma, docente, gestor, curso técnico). As contagens por escola vêm da `Tabela_Matricula`. O extrator trata os dois leiautes.
4. **`dadosabertos.fnde.gov.br` (Siope) respondeu 502 no proxy** em 08/10/2026. O Siope não era necessário ao piloto; fica para a expansão.
5. **Nota informativa do Ideb 2025**: o endereço citado na própria planilha do INEP (`download.inep.gov.br/ideb/nota_informativa_ideb_2025.pdf`) retornou 404 em 08/10/2026. Os códigos de não divulgação foram tirados da legenda da planilha, que é fonte primária.

## 2. Decisões

| # | Decisão | Motivo |
| --- | --- | --- |
| D1 | OBEE como terceiro domínio da plataforma (`eficiencia`), rota `/eficiencia-estatal` | Reaproveita conta, tokens, layout, CI e deploy; nenhuma infraestrutura nova |
| D2 | Tema do piloto: educação municipal nas capitais | Fontes oficiais acessíveis e verificáveis para recursos, atendimento e resultado; viabilidade confirmada antes de fixar o tema. A alternativa judicial não foi necessária |
| D3 | Pipeline em Python stdlib, com leitores próprios de `.xlsx` e `.ods` | O CI não instala dependências para reconstruir a gold; mantém o padrão do repositório |
| D4 | Seed versionado com recortes das capitais (5,7 MB) e manifesto com URL, data, sha256 e MD5 de cada pacote original | Pacotes do INEP têm até 540 MB; o recorte permite reproduzir sem rede e auditar linha a linha |
| D5 | Uma página com aprofundamento progressivo (entender, explorar, auditar) em vez de várias rotas | Exigência do prompt; menos superfície para manter |
| D6 | OBEE fora de `DOMINIOS`, da home e do rodapé nesta etapa; só no sitemap | Com um painel, apresentá-lo como observatório no seletor de domínios sugeriria completude. A entrada no registro é decisão de publicação (CONTINUIDADE.md) |
| D7 | Despesa por matrícula avaliada e não publicada | Perímetros incompatíveis, medidos (M01): conveniadas chegam a 49,7% da rede municipal em 2025 |
| D8 | DCA como fonte da despesa; RREO só como conferência | DCA é a declaração anual de contas; somar os dois duplicaria o mesmo gasto |
| D9 | Cor só para seleção: petróleo `#00697F` contra neutro `#858072` | Validado pelo script da skill de visualização: CVD ΔE 10,8, visão normal ΔE 15,7, contraste ≥ 3:1. O critério de croma da paleta categórica não se aplica a um par de ênfase; o destaque também usa tamanho, anel e rótulo |

## 3. Arquitetura implementada

```
Fonte oficial ──► pipeline/eficiencia/fontes/*.py   (coleta, integridade, recorte das capitais)
                     │  data/eficiencia/bronze (fora do git, opcional)
                     ▼
                pipeline/eficiencia/seed/          (recortes CSV/JSON gzip determinísticos + manifesto.json)
                     ▼
                conferencia.py política de conferência DCA × RREO × MSC (pura, versionada)
                     ▼
                padroniza.py   observações tipadas: indicador, ente, ano, etapa, componente, valor, status, nota,
                               nota_material, elegivel_comparacao, conferencia, fonte, registro
                     ▼
                validacoes.py  V01 a V13 automáticas + M01 e M02 medições
                     ▼
                gold.py        promove(): monta gold e séries em pasta temporária; só substitui public/eficiencia
                               sem validação reprovada (senão grava em data/eficiencia/diagnostico e sai com código 1)
                     ▼
src/lib/eficiencia/dados.ts    leitura no build e payload compacto do cliente (tuplas, textos deduplicados)
src/lib/eficiencia/consulta.ts seleção, pares, mediana, composição, linhas da tabela e CSV (sem cálculo contábil)
src/components/eficiencia/     painel, gráficos SVG, passaporte
src/app/eficiencia-estatal/    rota estática
```

Responsabilidades separadas logicamente (coleta, padronização, validação, cálculo, consulta e exportação, interface), sem serviços separados.

### Modelo de dados mínimo

* **Ente e território**: `entes.py` (código IBGE de 7 dígitos, UF, região, tipo de ente). DF registrado com motivo de exclusão.
* **Rede**: dependência administrativa do Censo (municipal = 3; privada conveniada com o município = 4 com parceria municipal). Responsável (ente), local da escola (município) e rede são campos distintos; município de residência do aluno não é usado.
* **Indicador e versão**: `catalogo_indicadores.json` (id estável, ficha completa, versão metodológica, estado de publicação).
* **Fonte e versão da extração**: `seed/manifesto.json` (URL, membro do pacote, publicado em, capturado em, sha256 do original e do recorte, MD5 conferido).
* **Observação**: ente, ano, etapa, componente, valor, status, nota, materialidade da nota, elegibilidade para comparação, fonte, registro; participação (composição); conferência completa na despesa (situação, RREO, MSC, diferença, evidências, sha256 das fontes, quebra de série).
* **Cobertura e comparabilidade**: calculadas na gold por indicador, ano e etapa; capitais sem valor listadas com estado.

### Estados de dado

`OBSERVADO`, `NAO_APLICAVEL`, `NAO_DIVULGADO`, `AUSENTE_NA_COLETA`, `DESATUALIZADO`, `INCONSISTENTE`, `INCOMPLETO`, `NAO_COMPARAVEL`, `INDISPONIVEL_TEMPORARIAMENTE`. Só `OBSERVADO` tem valor (validação V09). Elegibilidade para comparação é dimensão separada do estado: um valor `OBSERVADO` pode estar fora das comparações (V13).

### Componentes de interface

| Componente | Função |
| --- | --- |
| `PainelEducacao` | Controles (capital, ano, etapa, indicador da comparação, grupo, moeda, disciplina, copiar link, restaurar), números de orientação, séries, comparação, decomposição e tabela auditável |
| `MiniSerie` | Série com lacunas (nunca ponte entre anos sem valor nem com valor fora das comparações, marcado em losango), anotações de quebra, dica por ponteiro e teclado |
| `Ressalva` | Nota ou ressalva ao lado do valor, em `details`/`summary` (abre por teclado), com rótulo distinto para nota, ressalva e fora das comparações |
| `GraficoPontosPares` | Pontos por capital, ordem alfabética ou por valor, seleção destacada, mediana do grupo |
| `BarrasComposicao` | Composição em barras de cor única, na ordem da classificação oficial |
| `Passaporte` / `FichaConteudo` | Ficha de 16 campos, em diálogo (a partir do valor, do gráfico e da tabela) e na seção de métodos |
| `CabecalhoObee` | Marca, etapa declarada e atalhos para as seções |

Tokens novos: `obee` (`DEFAULT #00697F`, `dark #0B4F5E`, `fundo #E6EFF0`, `tinta #14243A`, `neutro #858072`) em `tailwind.config.ts` e variáveis `--cor-obee*` em `globals.css`. Contraste conferido em teste.
