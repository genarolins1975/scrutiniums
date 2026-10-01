"""Leitura dos cadastros da ANEEL usados pelo módulo Empresas (P036, P037 e P039).

Quatro conjuntos oficiais, todos com CNPJ publicado pela própria fonte (nenhum vínculo por
semelhança de nome, regra de pipeline/energia/entidades.py):

* Cadastro Institucional de Agentes (agentes-setor-eletrico.csv): CNPJ, sigla, razão social,
  situação e os ramos em que o agente atua (comercialização, distribuição, geração,
  transmissão). Os indicadores de ramo são autodeclarados no cadastro e incluem parques
  solares marcados como "distribuição"; por isso NÃO definem quem é distribuidora (quem define
  é a presença nas bases reguladas: SAMP, tarifas e continuidade).
* SIGA (siga-empreendimentos-geracao-diario.csv): cada usina com o núcleo do CEG, potência,
  fase e o campo de texto DscPropriRegimePariticipacao, no formato
  "44.0400% para NOME - 35.803.248/0001-75 (PIE), 20.0700% para ...". O texto é lido por
  expressão regular ancorada: a leitura só é aceita quando cobre o campo inteiro, do primeiro
  ao último caractere; qualquer sobra marca o campo como não lido (nunca um vínculo parcial).
* Agentes de Geração (agentes-geracao-energia-eletrica.csv): a mesma relação usina × agente
  em colunas (CNPJ ou CPF mascarado, percentual, regime), publicada mensalmente. O módulo
  usa o SIGA diário como base (mesmo arquivo da potência, mesma data) e este conjunto como
  conferência independente dos vínculos.
* Composição Societária, Polímero (composicao-societaria-polimero.parquet): árvores
  societárias declaradas pelos agentes à ANEEL por trimestre, com o sócio, o percentual sobre
  o nível acima e a marca de controlador. Lida em lotes do Parquet, só com as
  colunas necessárias (o CSV equivalente tem mais de 200 MB).
"""
import collections
import re
import unicodedata

from pipeline.energia import entidades

# ----------------------------------------------------------------------------- utilitários

UFS = {"AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI",
       "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"}

# Siglas de regime de exploração no texto do SIGA e o nome por extenso no conjunto Agentes de
# Geração (dicionário de dados da ANEEL; conferido nos dois arquivos de setembro de 2026).
REGIMES = {
    "PIE": "Produção Independente de Energia",
    "APE": "Autoprodução de Energia",
    "SP": "Serviço Público",
    "REG": "Registro",
}
REGIME_POR_EXTENSO = {v: k for k, v in REGIMES.items()}


def texto(v):
    if v is None:
        return None
    s = str(v).strip().strip('"').strip()
    return s or None


def numero(v):
    """'1.234,56', '1234,56', '1234.56' ou ',00' → float; vazio → None (nunca zero)."""
    s = texto(v)
    if s is None:
        return None
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".") if s.rfind(",") > s.rfind(".") else s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def nucleo(v):
    """Núcleo do CEG como inteiro em texto ('000008' no SIGA e '8' nos Agentes de Geração)."""
    s = texto(v)
    if s is None or not s.isdigit():
        return None
    return str(int(s))


def data_iso(v):
    """'2026-09-30', '30/09/2026' ou '01-09-2026' → 'AAAA-MM-DD'; marcador 1900 → None."""
    s = texto(v)
    if not s:
        return None
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        iso = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    else:
        m = re.match(r"^(\d{2})[/-](\d{2})[/-](\d{4})", s)
        if not m:
            return None
        iso = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return None if iso < "1901-01-01" else iso


def coordenada(v):
    """Grau decimal; 0 na fonte é "não informado" (fica None). A faixa do território é
    conferida por quem chama."""
    x = numero(v)
    if x is None or x == 0:
        return None
    return x


def tolerancia_soma_pp(n_proprietarios):
    """Tolerância da soma das participações de uma usina, em pontos percentuais. A fonte
    publica percentuais com 2 casas (Agentes de Geração) ou até 4 (SIGA): cada parcela pode
    carregar até 0,005 p.p. de arredondamento, então n parcelas somam até n × 0,005 p.p. Nada
    além disso é aceito como 100%."""
    return max(0.01, 0.005 * max(1, n_proprietarios))


# ----------------------------------------------------------------------------- cadastro de agentes

def le_cadastro_agentes(linhas):
    """Linhas do CSV do cadastro → ({cnpj: registro}, ocorrências). CNPJ repetido fica com a
    primeira linha e é contado; CNPJ inválido é contado e descartado."""
    out, ocorr = {}, {"linhas": 0, "cnpj_invalido": 0, "repetidos": 0, "data_geracao": None}
    for r in linhas:
        ocorr["linhas"] += 1
        c14 = entidades.cnpj(r.get("NumCnpj"))
        if not c14:
            ocorr["cnpj_invalido"] += 1
            continue
        ocorr["data_geracao"] = ocorr["data_geracao"] or data_iso(r.get("DatGeracaoConjuntoDados"))
        if c14 in out:
            ocorr["repetidos"] += 1
            continue
        sigla = texto(r.get("SigPessoa"))
        out[c14] = {
            "sigla": sigla,
            "razao_social": texto(r.get("NomRazaoSocial")),
            "ativo": texto(r.get("IdcAtivo")) == "A",
            "comercializacao": texto(r.get("IdcComercializacao")) == "1",
            "distribuicao": texto(r.get("IdcDistribuicao")) == "1",
            "geracao": texto(r.get("IdcGeracao")) == "1",
            "transmissao": texto(r.get("IdcTransmissao")) == "1",
        }
    return out, ocorr


# ----------------------------------------------------------------------------- SIGA

# Um proprietário: "<pct>% para <nome> - <CNPJ formatado ou vazio> (<REGIME>)", separados por
# ", ". O nome pode conter " - " e vírgulas (ex.: "DME DISTRIBUICAO S.A. - DMED"), por isso o
# CNPJ formatado (ou o vazio antes do parêntese) é a âncora do fim de cada item.
_PROPRIETARIO = re.compile(
    r"(?P<pct>\d+(?:[.,]\d+)?)%\s+para\s+(?P<nome>.*?)\s+-\s+(?P<doc>\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})?\s*"
    r"\((?P<regime>[A-Z]+)\)(?:,\s*|$)")


def proprietarios_siga(valor):
    """Texto DscPropriRegimePariticipacao → lista de {pct, nome, cnpj (14 dígitos ou None),
    regime (sigla)} ou None quando o campo é vazio, "Não Informado" ou não é lido por inteiro."""
    s = texto(valor)
    if not s or s.lower().startswith("não informado") or s.lower().startswith("nao informado"):
        return None
    itens, pos = [], 0
    for m in _PROPRIETARIO.finditer(s):
        if m.start() != pos:
            return None
        itens.append({
            "pct": float(m.group("pct").replace(",", ".")),
            "nome": texto(m.group("nome")),
            "cnpj": entidades.cnpj(m.group("doc")) if m.group("doc") else None,
            "regime": m.group("regime"),
        })
        pos = m.end()
    if pos != len(s) or not itens:
        return None
    return itens


def le_siga(linhas):
    """Linhas do CSV do SIGA → ({núcleo: usina}, ocorrências). Núcleo repetido com conteúdo
    idêntico conta uma vez; com conteúdo diferente fica a primeira ocorrência e o núcleo vai
    para a lista de divergentes (a potência nunca é somada duas vezes)."""
    out = {}
    ocorr = {"linhas": 0, "sem_nucleo": 0, "duplicadas_identicas": 0, "duplicadas_divergentes": [],
             "proprietarios_nao_informados": 0, "proprietarios_nao_lidos": [], "data_geracao": None, "fases": {}}
    for r in linhas:
        ocorr["linhas"] += 1
        k = nucleo(r.get("IdeNucleoCEG"))
        if k is None:
            ocorr["sem_nucleo"] += 1
            continue
        ocorr["data_geracao"] = ocorr["data_geracao"] or data_iso(r.get("DatGeracaoConjuntoDados"))
        bruto = texto(r.get("DscPropriRegimePariticipacao"))
        props = proprietarios_siga(bruto)
        lat, lon = coordenada(r.get("NumCoordNEmpreendimento")), coordenada(r.get("NumCoordEEmpreendimento"))
        if lat is None or lon is None or not (-35 <= lat <= 6) or not (-75 <= lon <= -28):
            lat = lon = None
        uf = texto(r.get("SigUFPrincipal"))
        fase = texto(r.get("DscFaseUsina")) or "(vazio)"
        reg = {
            "ceg": texto(r.get("CodCEG")),
            "nome": texto(r.get("NomEmpreendimento")),
            "uf": uf if uf in UFS else None,
            "tipo": texto(r.get("SigTipoGeracao")),
            "fase": fase,
            "origem": texto(r.get("DscOrigemCombustivel")),
            "fonte": texto(r.get("DscFonteCombustivel")),
            "kw_outorgado": numero(r.get("MdaPotenciaOutorgadaKw")),
            "kw_fiscalizado": numero(r.get("MdaPotenciaFiscalizadaKw")),
            "entrada_operacao": data_iso(r.get("DatEntradaOperacao")),
            "lat": lat, "lon": lon,
            "proprietarios_texto": bruto,
            "proprietarios": props,
        }
        if k in out:
            if out[k] == reg:
                ocorr["duplicadas_identicas"] += 1
            else:
                ocorr["duplicadas_divergentes"].append(k)
            continue
        ocorr["fases"][fase] = ocorr["fases"].get(fase, 0) + 1
        if props is None:
            if bruto is None or bruto.lower().startswith(("não informado", "nao informado")):
                ocorr["proprietarios_nao_informados"] += 1
            else:
                ocorr["proprietarios_nao_lidos"].append(k)
        out[k] = reg
    return out, ocorr


def estado_vinculo(props):
    """Estado do vínculo de uma usina a partir da lista de proprietários do SIGA:

    * sem_proprietario: campo vazio ou "Não Informado";
    * nao_lido: texto fora do formato (nenhum caso em 30/09/2026; nunca vira vínculo parcial);
    * soma_divergente: participações não somam 100% dentro da tolerância de arredondamento
      (ex.: matriz e filial com 100% cada, ou 0,01% no total);
    * inclui_sem_documento: soma válida, mas algum proprietário sem CNPJ (pessoa física nos
      registros de pequenas centrais); as parcelas com CNPJ continuam provadas;
    * vinculado: todos os proprietários com CNPJ e soma válida."""
    if props is None:
        return "sem_proprietario"
    if props == "nao_lido":
        return "nao_lido"
    soma = sum(p["pct"] for p in props)
    if abs(soma - 100.0) > tolerancia_soma_pp(len(props)):
        return "soma_divergente"
    if any(p["cnpj"] is None for p in props):
        return "inclui_sem_documento"
    return "vinculado"


# ----------------------------------------------------------------------------- Agentes de Geração

def le_agentes_geracao(linhas):
    """Linhas do CSV → ({núcleo: [vínculos]}, ocorrências). Documento com 14 dígitos é CNPJ;
    CPF vem mascarado pela fonte ('***.962.380-**') e fica como pessoa física sem chave."""
    out = collections.defaultdict(list)
    ocorr = {"linhas": 0, "sem_nucleo": 0, "cpf_mascarado": 0, "sem_documento": 0, "pct_ausente": 0,
             "data_geracao": None, "fases": collections.Counter()}
    for r in linhas:
        ocorr["linhas"] += 1
        k = nucleo(r.get("IdeNucleoCEG"))
        if k is None:
            ocorr["sem_nucleo"] += 1
            continue
        ocorr["data_geracao"] = ocorr["data_geracao"] or data_iso(r.get("DatGeracaoConjuntoDados"))
        doc = texto(r.get("NumCPFCNPJ")) or ""
        digitos = re.sub(r"\D", "", doc)
        if "*" in doc:
            c14, tipo = None, "cpf_mascarado"
            ocorr["cpf_mascarado"] += 1
        elif len(digitos) == 14:
            c14, tipo = digitos, "cnpj"
        else:
            c14, tipo = None, "sem_documento"
            ocorr["sem_documento"] += 1
        pct = numero(r.get("PctParticipacao"))
        if pct is None:
            ocorr["pct_ausente"] += 1
        regime = texto(r.get("DscRegimeExploracao"))
        fase = texto(r.get("DscFaseUsina"))
        ocorr["fases"][fase] += 1
        out[k].append({
            "cnpj": c14, "tipo_documento": tipo, "nome": texto(r.get("NomAgente")), "pct": pct,
            "regime": REGIME_POR_EXTENSO.get(regime, regime), "ceg": texto(r.get("CodCEG")),
            "usina": texto(r.get("NomEmpreendimento")), "tipo": texto(r.get("SigTipoGeracao")), "fase": fase,
        })
    ocorr["fases"] = dict(ocorr["fases"])
    return dict(out), ocorr


def compara_vinculos(siga, agentes):
    """Conferência independente SIGA × Agentes de Geração, usina a usina, só sobre os
    proprietários com CNPJ: mesma lista de CNPJ e mesmo percentual (tolerância de 0,01 p.p.,
    a precisão de 2 casas do conjunto Agentes de Geração). Os dois arquivos têm datas de
    geração diferentes (diário × mensal); divergência pode ser mudança real entre as datas."""
    res = {"comparadas": 0, "iguais": 0, "cnpj_diferentes": 0, "percentual_diferente": 0,
           "so_no_siga": 0, "so_em_agentes": 0, "exemplos": []}
    for k, u in siga.items():
        props = u.get("proprietarios")
        if not props:
            continue
        ag = agentes.get(k)
        if ag is None:
            res["so_no_siga"] += 1
            continue
        res["comparadas"] += 1
        a = collections.defaultdict(float)
        for x in props:
            if x["cnpj"]:
                a[x["cnpj"]] += x["pct"]
        b = collections.defaultdict(float)
        for x in ag:
            if x["cnpj"] and x["pct"] is not None:
                b[x["cnpj"]] += x["pct"]
        if set(a) != set(b):
            res["cnpj_diferentes"] += 1
            if len(res["exemplos"]) < 15:
                res["exemplos"].append({"nucleo": k, "motivo": "cnpj", "siga": sorted(a), "agentes": sorted(b)})
        elif any(abs(a[c] - b[c]) > 0.0100001 for c in a):
            res["percentual_diferente"] += 1
            if len(res["exemplos"]) < 15:
                res["exemplos"].append({"nucleo": k, "motivo": "percentual",
                                        "siga": {c: round(a[c], 4) for c in sorted(a)},
                                        "agentes": {c: round(b[c], 4) for c in sorted(b)}})
        else:
            res["iguais"] += 1
    res["so_em_agentes"] = sum(1 for k in agentes if k not in siga)
    return res


# ----------------------------------------------------------------------------- Polímero

COLUNAS_POLIMERO = ["AnoExercicio", "IdcTrimestreFormulario", "NumCPFCNPJPaiCadeiaSocietaria",
                    "NumNivelCadeiaSocietaria", "DscTipoCadeiaSocietaria", "NumCPFCNPJSocio",
                    "NomRazaoSocialSocio", "PctParticipacaoNivelAcima", "IdcPerfilSocietario",
                    "IdcGoverno", "IdcEmpresaEstrangeira", "IdcPessoaEstrangeira", "IdcCadSocietariaDesconhecida",
                    "NumOrdemCadeiaSocietaria"]
# Janela de declarações aceitas como vigentes: a última de cada agente dentro dos quatro
# trimestres até o de referência. Declaração mais antiga que isso não entra no grafo vigente
# (o agente pode ter mudado de controle sem que a base mostre); fica contada à parte.
JANELA_TRIMESTRES = 4
# Concordância mínima entre as listas de sócios de um nó (do próprio nó ou de árvores de
# terceiros) sobre QUEM é o controlador. Árvores de terceiros trazem erros isolados de
# preenchimento (em 30/09/2026, uma árvore punha uma controlada como controladora da
# holding); exigir unanimidade descartaria o controle de holdings citadas em centenas de
# árvores por causa de uma. Com 90%, até uma lista em cada dez pode discordar; a discordância
# fica publicada (concordancia) e abaixo disso o nó é "ambíguo".
LIMIAR_CONCORDANCIA = 0.9


# Nome de sócio sem CNPJ só é republicado em dois casos. (1) Perfil PJ com o indicador
# IdcEmpresaEstrangeira = SIM: a própria fonte declara que é pessoa jurídica estrangeira (em
# 30/09/2026, todas as 137.875 linhas PJ sem documento do Polímero tinham esse indicador e
# nenhuma linha PF ou DC o tinha). (2) Rótulo coletivo desta lista fechada, comparado depois de
# tirar acentos, caixa e espaços repetidos: ações em tesouraria, pulverizadas, minoritários,
# "demais acionistas" e afins, que não identificam ninguém. O perfil DC ("Demais
# Controladores", segundo o dicionário) mistura esses rótulos com empresas, fundos, governos,
# espólios e nomes de pessoas declaradas sem CPF; como a fonte não separa pessoa de empresa
# nesse perfil, todo nome DC fora da lista sai como MARCADOR_SEM_DOCUMENTO. Pessoa física
# (PF) nunca tem o nome republicado.
ROTULOS_COLETIVOS = frozenset({
    "acoes em tesouraria", "acoes tesouraria", "tesouraria", "cotas em tesouraria", "autodetencao",
    "acoes pulverizadas", "acoes/participacoes pulverizadas", "acionistas pulverizados", "acionista pulverizados",
    "cotistas pulverizados", "free float", "mercado (free float)", "acoes no mercado", "acoes b3",
    "acoes na bolsa (b3)", "demais acionistas", "demais controladores", "demais quotistas",
    "demais participacoes minoritarias", "minoritarios", "acionistas minoritarios", "acionista minoritarios",
    "participacao minoritaria", "outros", "diversos", "administradores", "administracao",
    "conselheiros e diretores", "cooperados", "empregados e aposentados",
})
MARCADOR_PF = "pessoa física"
MARCADOR_SEM_DOCUMENTO = "sócio sem documento"


def _rotulo_normalizado(nome):
    s = unicodedata.normalize("NFKD", nome or "")
    s = "".join(ch for ch in s if not unicodedata.combining(ch)).lower()
    return " ".join(s.split()).strip(" .,;:-")


def nome_publicavel(aresta):
    """Nome do sócio que pode ser republicado, ou None (regra em ROTULOS_COLETIVOS): com CNPJ;
    pessoa jurídica estrangeira declarada pela fonte; rótulo coletivo da lista fechada."""
    nome = aresta.get("nome")
    if not nome:
        return None
    if aresta.get("socio"):
        return nome
    if aresta.get("perfil") == "PJ" and aresta.get("empresa_estrangeira"):
        return nome
    if _rotulo_normalizado(nome) in ROTULOS_COLETIVOS:
        return nome
    return None


def rotulo_socio(aresta):
    """O que os arquivos publicam no lugar do nome: o nome, quando publicável; senão um
    marcador neutro (pessoa física ou sócio sem documento)."""
    return nome_publicavel(aresta) or (MARCADOR_PF if aresta.get("perfil") == "PF" else MARCADOR_SEM_DOCUMENTO)


def _chave_socio(doc, nome, perfil):
    """Chave do sócio: CNPJ (14 dígitos) quando a fonte o publica; pessoa física vem com o
    CPF mascarado ('***') e demais controladores (ações pulverizadas, fundos sem CNPJ,
    governo sem CNPJ) sem documento: ficam como nós terminais nomeados, sem chave comum
    entre árvores (não são a mesma entidade só porque o nome coincide)."""
    s = texto(doc)
    if s and s.isdigit() and len(s) <= 14 and perfil == "PJ":
        return entidades.cnpj(s)
    return None


def linhas_polimero(caminho, lote=200000):
    """Itera as linhas do Parquet do Polímero (só as colunas usadas), em lotes."""
    import pyarrow.parquet as pq
    arq = pq.ParquetFile(caminho)
    for b in arq.iter_batches(columns=COLUNAS_POLIMERO, batch_size=lote):
        d = b.to_pydict()
        for i in range(len(d["AnoExercicio"])):
            yield {c: d[c][i] for c in COLUNAS_POLIMERO}


def _periodo(r):
    return (int(r["AnoExercicio"]), int(r["IdcTrimestreFormulario"]))


def rotulo_periodo(p):
    return f"{p[0]}T{p[1]}" if p[1] else f"{p[0]} (mudança relevante)"


def le_polimero(abrir_linhas, janela=None):
    """Duas passadas pelas linhas do Parquet (ordenadas por NumOrdemCadeiaSocietaria, como
    publicadas), para não guardar na memória as árvores de todos os trimestres desde 2018:

    1. contagem de agentes declarantes por período, vigência de cada aresta (primeiro e
       último trimestre em que aparece) e os anos com "declaração de mudança societária
       relevante" (trimestre 0: a fonte informa o ano, não a data da mudança);
    2. árvores dos trimestres da janela que termina no trimestre de referência (cada árvore
       começa na linha de nível 0, cujo sócio é o próprio agente declarante).

    `abrir_linhas()` devolve um iterador novo a cada chamada. Retorna dict com: arvores
    {(raiz, período): [árvore, ...]}, eventos {raiz: [anos]}, periodos {período: agentes
    declarantes distintos},
    referencia (trimestre), vigencia {(pai, sócio): [primeiro, último]}, ocorrencias."""
    declarantes = collections.defaultdict(set)   # agentes distintos por trimestre (não árvores)
    eventos = collections.defaultdict(set)
    ultima_declaracao = {}
    vigencia = {}
    ocorr = {"linhas": 0, "arvores": 0, "fora_de_ordem": 0, "linha_sem_arvore": 0, "pct_ausente": 0,
             "cadeia_desconhecida": 0, "raiz_sem_cnpj": 0}
    per_atual, ordem_ant = None, None
    for r in abrir_linhas():
        ocorr["linhas"] += 1
        ordem = r.get("NumOrdemCadeiaSocietaria")
        if ordem_ant is not None and ordem is not None and ordem <= ordem_ant:
            ocorr["fora_de_ordem"] += 1
        ordem_ant = ordem
        per = _periodo(r)
        if r.get("NumNivelCadeiaSocietaria") == 0:
            per_atual = per
            ocorr["arvores"] += 1
            raiz = _chave_socio(r.get("NumCPFCNPJSocio"), None, "PJ")
            if raiz is None:
                ocorr["raiz_sem_cnpj"] += 1
            elif per[1] == 0:
                eventos[raiz].add(per[0])
            else:
                declarantes[per].add(raiz)
                if raiz not in ultima_declaracao or per > ultima_declaracao[raiz]:
                    ultima_declaracao[raiz] = per
            continue
        if per != per_atual:
            ocorr["linha_sem_arvore"] += 1
            continue
        if r.get("PctParticipacaoNivelAcima") is None:
            ocorr["pct_ausente"] += 1
        if texto(r.get("IdcCadSocietariaDesconhecida")) == "SIM":
            ocorr["cadeia_desconhecida"] += 1
        pai = entidades.cnpj(r.get("NumCPFCNPJPaiCadeiaSocietaria"))
        if per[1] == 0 or not pai:
            continue
        socio = _chave_socio(r.get("NumCPFCNPJSocio"), None, texto(r.get("IdcPerfilSocietario")))
        chave_v = (pai, socio or f"#{texto(r.get('NomRazaoSocialSocio'))}")
        v = vigencia.get(chave_v)
        if v is None:
            vigencia[chave_v] = [per, per]
        else:
            v[0] = min(v[0], per)
            v[1] = max(v[1], per)
    periodos = {p: len(v) for p, v in declarantes.items()}
    ref = periodo_referencia(periodos)
    janela = set(janela or (_trimestres_ate(ref, JANELA_TRIMESTRES) if ref else []))
    arvores = collections.defaultdict(list)
    atual, per_atual = None, None
    for r in abrir_linhas():
        per = _periodo(r)
        if r.get("NumNivelCadeiaSocietaria") == 0:
            per_atual = per
            raiz = _chave_socio(r.get("NumCPFCNPJSocio"), None, "PJ")
            atual = None
            if raiz and per in janela:
                atual = {"raiz": raiz, "nome": texto(r.get("NomRazaoSocialSocio")), "arestas": []}
                arvores[(raiz, per)].append(atual)
            continue
        if atual is None or per != per_atual:
            continue
        pct = r.get("PctParticipacaoNivelAcima")
        perfil = texto(r.get("IdcPerfilSocietario"))
        atual["arestas"].append({
            "pai": entidades.cnpj(r.get("NumCPFCNPJPaiCadeiaSocietaria")),
            "socio": _chave_socio(r.get("NumCPFCNPJSocio"), None, perfil),
            "nome": texto(r.get("NomRazaoSocialSocio")),
            "pct": None if pct is None else float(pct),
            "controlador": texto(r.get("DscTipoCadeiaSocietaria")) == "Controlador",
            "perfil": perfil,
            "governo": texto(r.get("IdcGoverno")) == "SIM",
            "estrangeira": texto(r.get("IdcEmpresaEstrangeira")) == "SIM" or texto(r.get("IdcPessoaEstrangeira")) == "SIM",
            "empresa_estrangeira": texto(r.get("IdcEmpresaEstrangeira")) == "SIM",
            "nivel": r.get("NumNivelCadeiaSocietaria"),
        })
    return {"arvores": dict(arvores), "eventos": {k: sorted(v) for k, v in eventos.items()},
            "periodos": periodos, "referencia": ref, "vigencia": vigencia, "ocorrencias": ocorr,
            "ultima_declaracao": ultima_declaracao}


def periodo_referencia(periodos, fracao_minima=0.9):
    """Último trimestre cujo número de agentes declarantes chega a `fracao_minima` do maior
    número entre os quatro trimestres anteriores: um trimestre ainda em preenchimento (poucas
    declarações) não vira referência."""
    trims = sorted(p for p in periodos if p[1] != 0)
    for i in range(len(trims) - 1, -1, -1):
        anteriores = [periodos[p] for p in trims[max(0, i - 4):i]]
        if not anteriores or periodos[trims[i]] >= fracao_minima * max(anteriores):
            return trims[i]
    return None


def _trimestres_ate(ref, n):
    out, (a, t) = [], ref
    for _ in range(n):
        out.append((a, t))
        a, t = (a, t - 1) if t > 1 else (a - 1, 4)
    return out


def _assinatura_controle(arestas_do_no):
    """O que decide o controle de um nó: quem são os sócios marcados como controladores
    (chave e perfil). Percentuais variam entre declarações do mesmo trimestre (cada agente
    declara numa data) sem mudar o controle."""
    return tuple(sorted({(x["socio"] or f"#{x['nome']}", x["perfil"] or "") for x in arestas_do_no if x["controlador"]}))


def _listas_da_arvore(arv):
    """{pai: [arestas com percentual DIRETO]} de uma árvore.

    O percentual publicado (PctParticipacaoNivelAcima) é, segundo o dicionário e conferido
    nos dados (967 de 968 casos do 1º trimestre de 2026 em que o pai tem participação entre
    1% e 99%: a soma dos sócios do nível 2 é igual à participação do pai no agente), relativo
    ao agente declarante (raiz da árvore), não ao nível imediatamente acima. O percentual
    direto de S em X é então 100 × pct(S) ÷ pct(X), quando X aparece uma única vez como sócio
    na árvore; X em mais de um caminho deixa o percentual direto indefinido (None). Sócio
    repetido na lista de X com percentuais diferentes também fica None."""
    rel = {arv["raiz"]: 100.0}
    repetidos = set()
    for a in arv["arestas"]:
        if a["socio"]:
            if a["socio"] in rel and a["socio"] != arv["raiz"]:
                repetidos.add(a["socio"])
            rel[a["socio"]] = a["pct"]
    por_pai = collections.defaultdict(dict)
    for a in arv["arestas"]:
        x = a["pai"]
        if not x:
            continue
        base_x = rel.get(x) if x not in repetidos else None
        direto = None
        if a["pct"] is not None and base_x:
            direto = 100.0 * a["pct"] / base_x
        chave = a["socio"] or f"#{a['nome']}"
        novo = {**a, "pct": direto, "pct_raiz": a["pct"]}
        ant = por_pai[x].get(chave)
        if ant is None:
            por_pai[x][chave] = novo
        else:
            if ant["pct"] is None or direto is None or abs(ant["pct"] - direto) > 0.01:
                ant["pct"] = None
            ant["controlador"] = ant["controlador"] or a["controlador"]
    return {x: list(d.values()) for x, d in por_pai.items()}


def grafo_vigente(pol, ref):
    """Grafo societário vigente no trimestre `ref`.

    Para cada agente declarante, usa a última declaração trimestral dentro da janela de
    JANELA_TRIMESTRES até `ref`. Os sócios de um nó X vêm, em ordem de prioridade: (1) da
    declaração do próprio X, quando X declara; (2) das árvores de outros agentes em que X
    aparece como pai. Havendo mais de uma lista para X, elas precisam concordar sobre quem é
    controlador; se concordam, vale a lista mais frequente e a faixa do percentual direto do
    controlador fica registrada; se discordam, X fica "ambíguo" (sem controlador atribuído).

    Retorna {"socios": {X: [arestas]}, "origem": {X: 'propria'|'terceiros'|'ambigua'},
    "declaracao": {X: período}, "faixa_pct": {X: (mín, máx)}, "ambiguos": [...],
    "fora_janela": n, "declarantes": n, "janela": [...]}."""
    janela = set(_trimestres_ate(ref, JANELA_TRIMESTRES))
    ultima = {}
    for (raiz, per) in pol["arvores"]:
        if per in janela and (raiz not in ultima or per > ultima[raiz]):
            ultima[raiz] = per
    inicio = min(janela)
    fora = {raiz for raiz, per in (pol.get("ultima_declaracao") or {}).items() if per < inicio}
    proprias = collections.defaultdict(list)     # X -> listas declaradas pelo próprio X
    terceiros = collections.defaultdict(list)    # X -> listas de X nas árvores de outros
    for raiz, per in ultima.items():
        for arv in pol["arvores"][(raiz, per)]:
            for pai, lst in _listas_da_arvore(arv).items():
                (proprias if pai == raiz else terceiros)[pai].append(lst)
    socios, origem, faixa, ambiguos, concord = {}, {}, {}, [], {}

    def assin_lista(lst):
        return tuple(sorted((a["socio"] or a["nome"] or "", round(a["pct"], 4) if a["pct"] is not None else -1.0)
                            for a in lst))

    for x in set(proprias) | set(terceiros):
        listas, org = (proprias[x], "propria") if proprias.get(x) else (terceiros[x], "terceiros")
        sigs = collections.Counter(_assinatura_controle(lst) for lst in listas)
        sig, n_sig = sigs.most_common(1)[0]
        concord[x] = (n_sig, len(listas))
        if n_sig < LIMIAR_CONCORDANCIA * len(listas) or (len(sigs) > 1 and sigs.most_common(2)[1][1] == n_sig):
            origem[x] = "ambigua"
            ambiguos.append(x)
            continue
        listas = [lst for lst in listas if _assinatura_controle(lst) == sig]
        contagem = collections.Counter(assin_lista(lst) for lst in listas)
        mais = contagem.most_common(1)[0][0]
        socios[x] = next(lst for lst in listas if assin_lista(lst) == mais)
        origem[x] = org
        vals = [a["pct"] for lst in listas for a in lst if a["controlador"] and a["pct"] is not None]
        if vals:
            faixa[x] = (min(vals), max(vals))
    return {"socios": socios, "origem": origem, "declaracao": dict(ultima), "faixa_pct": faixa,
            "concordancia": concord, "ambiguos": ambiguos, "fora_janela": len(fora), "declarantes": len(ultima), "janela": sorted(janela)}


MOTIVOS_TOPO = {
    "sem_declaracao": "o agente não aparece na composição societária declarada à ANEEL na janela vigente",
    "ambigua": "declarações do mesmo trimestre discordam sobre quem é o controlador",
    "sem_controlador": "nenhum sócio marcado como controlador",
    "compartilhado": "mais de um sócio marcado como controlador (controle compartilhado)",
    "pessoa_fisica": "controlador único é pessoa física (CPF mascarado pela fonte)",
    "sem_cnpj": "controlador único sem CNPJ publicado (empresa estrangeira, governo, fundo ou sócio declarado sem documento)",
    "ciclo": "a cadeia de controladores volta a um nó já visitado",
}


def controlador_direto(g, x):
    """(controlador CNPJ | None, motivo | None, aresta) do nó x no grafo vigente."""
    if x not in g["origem"]:
        return None, "sem_declaracao", None
    if g["origem"][x] == "ambigua":
        return None, "ambigua", None
    ctrl = [a for a in g["socios"].get(x, []) if a["controlador"]]
    # o mesmo controlador em duas linhas (duas classes de ações, dois caminhos) é um só
    if len({(a["socio"] or f"#{a['nome']}") for a in ctrl}) == 1:
        ctrl = ctrl[:1]
    if not ctrl:
        return None, "sem_controlador", None
    if len(ctrl) > 1:
        return None, "compartilhado", None
    a = ctrl[0]
    if a["perfil"] == "PF":
        return None, "pessoa_fisica", a
    if not a["socio"]:
        return None, "sem_cnpj", a
    return a["socio"], None, a


def cadeia_de_controle(g, x, limite=25):
    """Sobe pelos controladores únicos declarados a partir de x. Retorna {"topo": CNPJ do
    último nó com CNPJ, "cadeia": [x, ..., topo], "motivo_parada": chave de MOTIVOS_TOPO,
    "acima": nome do controlador sem CNPJ quando publicável (nome_publicavel), senão None,
    "pcts": [participação de cada controlador sobre o nó abaixo]}."""
    cadeia, pcts, vistos = [x], [], {x}
    atual = x
    for _ in range(limite):
        prox, motivo, aresta = controlador_direto(g, atual)
        if prox is None:
            # só nome publicável (nome_publicavel): pessoa física e sócio DC sem documento não
            # são nomeados; o motivo de parada já diz por que a cadeia termina ali
            acima = nome_publicavel(aresta) if aresta else None
            return {"topo": atual, "cadeia": cadeia, "motivo_parada": motivo, "pcts": pcts, "acima": acima}
        if prox in vistos:
            return {"topo": atual, "cadeia": cadeia, "motivo_parada": "ciclo", "pcts": pcts, "acima": None}
        vistos.add(prox)
        cadeia.append(prox)
        pcts.append(aresta["pct"])
        atual = prox
    return {"topo": atual, "cadeia": cadeia, "motivo_parada": "ciclo", "pcts": pcts, "acima": None}
