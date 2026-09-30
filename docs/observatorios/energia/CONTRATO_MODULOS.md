# Contrato de implementação dos módulos do Observatório do Setor Elétrico

Este contrato vale para todo módulo temático (Perdas, Qualidade, Conta de luz, Inclusão, Transição, Empresas, Expansão, Regulação, Mercado) e para as extensões dos módulos de operação (Água e clima, Geração, Carga, Rede, PLD, Previsões). A especificação de produto está em `docs/observatorios/energia/ESPECIFICACAO.md` (cópia do prompt mestre); o que ela proíbe (seção 2.2) é proibido aqui.

## 1. Arquivos por módulo (dono exclusivo)

| Camada | Caminho | Observação |
| --- | --- | --- |
| Coleta e gold | `pipeline/energia/modulos/<id>.py` | `REGISTRO`, `coletar(con, ctx)`, `construir(con, ctx)`; descoberto automaticamente pelo `run.py` |
| Parsers longos | `pipeline/energia/fontes/<fonte>_<id>.py` | opcional |
| Métricas | `pipeline/energia/metricas/<id>.py` | `METRICAS = [...]`, validadas por `metricas.validar` |
| Testes Python | `pipeline/tests/test_energia_<id>.py` | sem rede; usam amostras reais recortadas em `pipeline/tests/dados/energia_<id>/` (poucos KB) |
| Gold publicada | `public/energia/gold/<id>.json` | até ~400 KB; lida no build pelas páginas |
| Séries e tabelas para download | `public/energia/series/<id>_*.csv` | até ~5 MB cada; `;` como separador, ponto decimal, vazio = ausência |
| Tipos TS | `src/lib/energia/tipos-<id>.ts` | espelho exato da gold |
| Verbetes | `src/lib/energia/conteudo/conceitos-<id>.ts` | já criado (vazio); mesmo slug de um verbete base o substitui |
| Página(s) | `src/app/setor-eletrico/<rota>/**` | fase de interface |
| Componentes do módulo | `src/components/energia/<Modulo><Nome>.tsx` | planos na pasta (o teste de tokens não recursa) |
| Testes TS | `src/tests/energia-<id>.test.ts` | contrato da gold, equivalência gráfico/tabela/exportação, textos derivados |
| Documento de método | `docs/observatorios/energia/modulos/<id>.md` | fontes verificadas com data, método, fórmulas, cobertura, limitações, bloqueios e evidências de aceite por ID P0xx |

Arquivos compartilhados que o módulo **não** edita: `run.py`, `base.py`, `catalogo.py`, `gold.ts`, `tipos.ts`, `navegacao.ts`, `mapa.ts`, `conceitos.ts`, `datasets.ts`, `globals.css`, `tailwind.config.ts`, páginas de outros módulos. Precisa de mudança num deles? Descreva no documento do módulo, seção "Pedidos ao integrador".

Módulos de operação já existentes (PLD, hidrologia, carga, geração, rede, CMO, modelos) têm dono único: o agente daquele tema pode editar o builder existente (`pipeline/energia/gold/<tema>.py`) e a página existente; dados novos (conjuntos ONS adicionais) entram como módulo novo `pipeline/energia/modulos/<tema>_<extensao>.py` com gold própria, para não disputar `fontes/ons.py`.

## 2. Pipeline

```python
REGISTRO = {
    "id": "perdas", "gold": "perdas.json", "familia": "aneel_distribuicao", "ordem": 40,
    "datasets": [{
        "orgao": "ANEEL", "nome": "samp-balanco", "slug": "aneel-samp-balanco",
        "dataset_silver": "aneel_samp_balanco", "titulo": "SAMP: balanço energético das distribuidoras",
        "estado": "UTILIZADO EM INDICADOR", "url": "https://dadosabertos.aneel.gov.br/dataset/samp-balanco",
        "licenca": "Open Data Commons Open Database License (ODbL)",
        "paginas": [{"rotulo": "Perdas", "href": "/setor-eletrico/perdas"}],
        "downloads": ["/energia/series/perdas_distribuidoras.csv"], "quebras": [],
    }],
    "arquivos": {"/energia/series/perdas_distribuidoras.csv": "colunas, unidades e regra de ausência"},
}
```

* **Coleta** (`coletar`): use `pipeline/energia/fontes/ckan.py` (`coleta_pacote`, `baixar_recurso`, `le_csv_bronze`, `numero_br`, `vintages_vigentes`, `meta_local`). Download em fluxo para o bronze com sha256, vintage no silver da família (`data/energia/silver/<familia>.db`), política de recoleta por `last_modified` e idade. Parquet: `pyarrow` (em `pipeline/energia/requirements.txt`) quando a fonte publica Parquet oficial equivalente ao CSV; registre qual recurso foi usado. Fonte fora do CKAN (IBGE, CVM, EPE, MCTI, gov.br): mesmo padrão com `base.salva_bronze_arquivo` + `base.registra_vintage`, e `url` e `licenca` declaradas no REGISTRO. Nunca contorne bloqueio de acesso (CCEE responde 403 "Acesso bloqueado"; não troque user-agent para se passar por navegador).
* **Silver**: séries numéricas em `observacoes` via `base.grava_observacoes` (revisão fica registrada); cadastros, cronogramas e atos em `registros` via `base.grava_registros` (texto, com histórico e reconstituição por data em `base.registros_como_estavam_em`). Conjuntos enormes (milhões de linhas por UC ou por usina e meia hora) entram agregados no grão publicado, com a agregação documentada; o arquivo original fica no bronze com sha256.
* **Gold** (`construir`): começa por `comum.cabecalho(nome)`; falha vira `comum.stub(nome, motivo)` (a sentinela mantém a publicação anterior). Todo indicador tem proveniência de `comum.proveniencia(...)` (natureza, fonte com órgão, conjunto, recurso, URL e licença, unidade, frequência, período de referência, captura, cobertura, transformações, fórmula quando calculado, snapshot, limitações não vazias, download). Use `comum.snapshot_de(con, dataset_silver)` para o snapshot.
* **Evidência** ("Comprove este número", seção 11.5): KPIs e agregados principais levam um objeto `evidencia` montado por `pipeline/energia/evidencia.py` (se ainda não existir quando você começar, produza o dict com os campos: `valor_exibido, valor_calculo, unidade, periodo, entidade, universo, filtros, fonte{orgao, conjunto, recurso, url, arquivo, sha256, capturado_em, publicado_em}, chaves_origem, formula, numerador{descricao, valor}, denominador{descricao, valor}, pesos, exclusoes, cobertura, tratamento_ausencia, versao{pipeline, codigo, publicacao}, revisoes, testes[{nome, resultado, detalhe}], reconciliacao{descricao, resultado, tolerancia}, download[{rotulo, url}], reproducao, citacao`).
* **Métricas**: toda medida publicada tem definição em `pipeline/energia/metricas/<id>.py` com os campos de `pipeline/energia/metricas/__init__.py`. A fórmula roda no pipeline; a interface só lê.
* **Identidade**: `pipeline/energia/entidades.py`. Chave canônica de pessoa jurídica = CNPJ com 14 dígitos. Nada de vínculo por semelhança de nome.
* **Execução local**: `python3 pipeline/energia/executar_modulo.py <id>` (coleta + gold) e `--sem-coleta` (só gold). Não rode `run.py` inteiro nem `next build` (o diretório é compartilhado com outros agentes). O silver principal `data/energia/silver/energia.db` (ONS e CCEE originais) é só leitura para os módulos.

## 3. Regras numéricas (seção 11.6)

* MW é potência, MWh energia, MWmed exige período; converter pela duração de cada intervalo.
* Ausência, zero, não se aplica e suprimido são estados distintos; nulo nunca vira zero, não é interpolado nem repetido sem rótulo.
* Taxas agregadas: `100 × Σ numeradores / Σ denominadores` compatíveis; nunca média simples de percentuais com bases diferentes nem soma de percentuais.
* DEC em horas e FEC em interrupções por consumidor, com os pesos oficiais; centésimos de hora não são minutos.
* Ano parcial não compete com ano completo em ranking sem ajuste e aviso.
* Datas: período de referência, publicação pela fonte (só se a fonte informa), captura, processamento, validação e vigência são campos distintos. Data de captura nunca substitui data do dado.
* Tolerâncias de reconciliação específicas por unidade e precisão, justificadas; nada de percentual universal.
* Associação não é causalidade: textos automáticos seguem regras determinísticas e testadas.

## 4. Testes que detectam erro real

* Reconciliação com a fonte por caminho independente: total publicado pela própria fonte (relatório, painel oficial, PDF) ou releitura do arquivo original por outro código, com valores concretos (entidade, período, número esperado) escritos no teste.
* Casos de robustez: entidade grande, pequena, multiestadual, mudança societária, valor extremo e ausência.
* Nulo, zero e não se aplica distintos; unidades convertidas; agregação ponderada; vigência respeitada.
* Nada de teste que só repete a fórmula da implementação.

## 5. Interface (fase 2)

Componentes compartilhados em `src/components/energia/` (catálogo em `docs/observatorios/COMPONENTES_ENERGIA.md`): `PainelEvidencia`, `ModoProfundidade` (Entender, Analisar, Auditar), `GraficoLinhas` (zoom, cursor sincronizado), `GraficoBarras`, `GraficoPontos`, `GraficoDispersao`, `Histograma`, `MapaCalor`, `MapaCoropletico` (geometria IBGE em `public/energia/geo/`), `TabelaInterativa` (ordenação, busca, CSV/XLSX das linhas filtradas), `Comparador` (até 4), `useEstadoUrl` (filtros na URL, voltar/avançar), `ComproveNumero`, `Numero`, `PequenosMultiplos`, `Cronograma`, `LinhaDoTempo`. Anatomia do painel numérico: seção 7.2 da especificação. Páginas `force-static`, leitura da gold com `lerGold<T>("<id>.json")` de `src/lib/energia/gold.ts`. Nenhum hexadecimal solto; cores por token/variável CSS.

### 5.1 Peso da página

Props de componente cliente viajam no HTML e no fluxo RSC. Não passe séries inteiras de milhares de pontos a um componente cliente: publique na gold o recorte que a página mostra (ex.: últimos 3 anos diários, histórico longo mensal), e deixe o detalhe para o CSV de download ou para `fetch` no cliente de um JSON em `public/energia/series/` sob demanda (ao abrir a aba ou o modo Analisar). Meta: HTML de cada página abaixo de ~600 KB. Tabelas grandes (milhares de linhas) carregam no cliente sob demanda.

### 5.2 Validação física e de esquema

Todo builder valida limites físicos e de domínio antes de publicar (ex.: energia e potência não negativas onde a grandeza não admite sinal, percentuais em faixa, datas não futuras além do horizonte da fonte, chaves únicas, contagem esperada por entidade e período). Violação crítica vira stub com motivo (a sentinela mantém a última publicação válida); violação não crítica vira ressalva visível na proveniência. Valor atípico não é descartado sem conferência no arquivo original.

## 6. Documento do módulo (`docs/observatorios/energia/modulos/<id>.md`)

1. Painéis cobertos (IDs P0xx) e estado honesto de cada um (concluído, concluído com limitação declarada, bloqueado com evidência).
2. Fontes verificadas: órgão, conjunto, recurso exato, URL, data de consulta, licença, período, grão, frequência, revisões.
3. Método: fórmulas, numeradores e denominadores, agregação, vigências, identidade de entidades, tratamento de ausência.
4. Evidências de aceite: números conferidos contra a fonte (entidade, período, valor da gold, valor da fonte, diferença, tolerância).
5. Limitações materiais e o que não se pode concluir.
6. Pedidos ao integrador (mudanças em arquivos compartilhados).
