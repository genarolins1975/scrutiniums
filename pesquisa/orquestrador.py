"""Orquestrador da nota de conjuntura. Fora do pipeline de números e sem revisão humana.

Constituição v2: nenhuma etapa tem revisão humana. A nota é escrita por agentes, conferida
por código e revisada por três agentes independentes; só é aprovada por unanimidade.

Etapas e o que cada papel pode ver (isolamento é regra):

    analista_familias / analista_empresas   tabela de fatos
    replicador                              só a tabela de fatos e a pergunta
    consolidador                            rascunhos dos analistas
    critico                                 nota consolidada + tabela de fatos
    ── rodada de revisão (repete até a unanimidade ou até o limite de rodadas) ──
    revisao (consolidador)                  nota + objeções da rodada anterior + leitura do replicador
    validacao_mecanica                      código (pesquisa/validador.py)
    validador_constitucional                nota final + fatos em tabela
    revisor_independente                    nota final + fatos em JSON com ponteiros para a gold
    terceiro_revisor                        nota final + histórico bruto das séries na gold
    ── decisão por código: aprovada só se o validador e os três revisores aprovarem ──
    render                                  pacote de reprodutibilidade, decisão e métricas

Os três revisores não veem rascunhos, crítico, replicador nem o parecer um do outro, e
precisam diferir dois a dois em pelo menos três características (modelo, fornecedor,
evidência, apresentação, mandato); a configuração que não cumprir é recusada.

Backends:
    manual     grava o prompt em prompts/<etapa>.md e para; a resposta vai para
               saidas/<etapa>.md, escrita por um agente em sessão separada.
    anthropic  chama a API com o SDK oficial (`pip install anthropic`).

Uso:
    python3 -m pesquisa.orquestrador notas/2026-08 [--gold DIR] [--backend manual|anthropic]
"""
import argparse
import datetime as dt
import itertools
import json
import os
import re
import sys

from pesquisa import fatos_conjuntura as fc
from pesquisa import metricas
from pesquisa import nota as nt
from pesquisa import validador as vd

RAIZ = fc.RAIZ
NOTAS = os.path.join(RAIZ, "notas")
PAPEIS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "papeis")
ETAPAS_INICIAIS = ["analista_familias", "analista_empresas", "replicador", "consolidador", "critico"]
REVISORES = ["validador_constitucional", "revisor_independente", "terceiro_revisor"]
REVISORES_POR_ITEM = {"revisor_independente", "terceiro_revisor"}  # formato ITEM [grave|moderada|leve]
ETAPAS_DA_RODADA = ["revisao", "validacao_mecanica"] + REVISORES
PAPEL_DA_ETAPA = {"revisao": "consolidador"}
MODELOS_COM_FALLBACK = {"claude-opus-5", "claude-fable-5-1"}
MESES_HISTORICO = 13


class Pendente(Exception):
    """Etapa manual aguardando resposta em saidas/<etapa>.md."""


def dentro_de_notas(caminho):
    alvo = os.path.realpath(caminho)
    base = os.path.realpath(NOTAS)
    return alvo == base or alvo.startswith(base + os.sep)


def _ler(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def _gravar(ciclo, rel, conteudo):
    path = os.path.join(ciclo, rel)
    if not dentro_de_notas(path):
        raise PermissionError(f"escrita fora de notas/ recusada: {path}")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(conteudo if isinstance(conteudo, str) else json.dumps(conteudo, ensure_ascii=False, indent=1) + "\n")
    return path


# ---------------------------------------------------------------- independência dos revisores

def verificar_independencia(cfg):
    """Pares de revisores que diferem em menos características que o mínimo (vazio = ok)."""
    carac = cfg["caracteristicas_de_independencia"]
    minimo = cfg["minimo_diferencas_entre_revisores"]
    falhas = []
    for a, b in itertools.combinations(cfg["revisores"], 2):
        pa, pb = cfg["papeis"][a], cfg["papeis"][b]
        difs = [c for c in carac if pa.get(c) != pb.get(c)]
        if len(difs) < minimo:
            falhas.append({"par": [a, b], "diferencas": difs, "minimo": minimo})
    return falhas


def caracteristicas(cfg):
    return {r: {c: cfg["papeis"][r].get(c) for c in cfg["caracteristicas_de_independencia"]} for r in cfg["revisores"]}


# ---------------------------------------------------------------- evidências

def tabela_fatos(pacote):
    linhas = [f"Data base: {pacote['data_base']} · sha256_fatos: {pacote['sha256_fatos']}", "",
              "| id | fato | valor | sinal | data de referência |", "|---|---|---|---|---|"]
    for f in pacote["fatos"]:
        linhas.append(f"| {f['id']} | {f['rotulo']} | {f['texto']} | {f.get('sinal', '')} | {f['data_ref']} |")
    if pacote.get("lacunas"):
        linhas += ["", "Lacunas declaradas (use {{lacunas}}): " + "; ".join(l["fato"] for l in pacote["lacunas"])]
    if pacote.get("defasagens"):
        linhas += ["", "Séries com data própria (cite {{data:id}}): " + ", ".join(d["serie"] for d in pacote["defasagens"])]
    return "\n".join(linhas)


def fatos_json(pacote):
    """Mesmos fatos, outra apresentação: JSON com fórmula, insumos e ponteiro para a gold."""
    campos = ("id", "rotulo", "tipo", "valor", "unidade", "texto", "sinal", "data_ref", "fonte", "origem", "formula", "insumos")
    return json.dumps({"data_base": pacote["data_base"], "lacunas": pacote.get("lacunas", []),
                       "defasagens": pacote.get("defasagens", []),
                       "fatos": [{k: f[k] for k in campos if k in f} for f in pacote["fatos"]]},
                      ensure_ascii=False, indent=1)


def historico_bruto(gold_dir, data_base, meses=MESES_HISTORICO):
    """Evidência do terceiro revisor: a série publicada na gold, sem os textos prontos do pacote."""
    with open(os.path.join(gold_dir, fc.ARQUIVO), encoding="utf-8") as f:
        pulse = json.load(f)
    linhas = [f"Histórico publicado na gold até {data_base} (valores como estão na gold; yoy = variação "
              f"em doze meses publicada pelo pipeline; yoy_real = a mesma variação deflacionada, publicada "
              f"na gold com a fórmula declarada)."]
    for key, rotulo, _fam in fc.ESCOPO:
        s = pulse.get("series", {}).get(key)
        if not s:
            continue
        meta = s.get("meta") or {}
        obs = [o for o in s.get("obs") or [] if o["ref"][:7] <= data_base][-meses:]
        yoy = {o["ref"]: o["v"] for o in s.get("yoy") or []}
        real = {o["ref"]: o["v"] for o in s.get("yoy_real") or []}
        linhas.append(f"\n{rotulo} [{meta.get('unit')}; {meta.get('source')} {meta.get('series_code')}]")
        if s.get("yoy_real_nota"):
            linhas.append(f"  yoy_real publicado na gold: {s['yoy_real_nota']}")
        for o in obs:
            y, yr = yoy.get(o["ref"]), real.get(o["ref"])
            linhas.append(f"  {o['ref'][:7]}: {o['v']}" + (f" (yoy {y}" + (f"; yoy_real {yr}" if yr is not None else "") + ")"
                                                          if y is not None else ""))
    return "\n".join(linhas)


# ---------------------------------------------------------------- prompts

def sistema_do_papel(papel):
    """Instruções estáveis (cacheáveis): regras comuns + papel + constituição."""
    comum = "comum_revisores.md" if papel in REVISORES else "comum.md"
    return "\n\n".join([_ler(os.path.join(PAPEIS, comum)), _ler(os.path.join(PAPEIS, f"{papel}.md")),
                        "# Constituição editorial\n\n" + _ler(nt.CONSTITUICAO)])


def _nome(etapa, rodada=0):
    """Arquivo da etapa; cada rodada de revisão tem o seu (revisao, revisao_1, ...)."""
    return f"{etapa}_{rodada}" if etapa in ETAPAS_DA_RODADA and rodada else etapa


def _saida(ciclo, etapa, rodada=0):
    p = os.path.join(ciclo, "saidas", f"{_nome(etapa, rodada)}.md")
    return _ler(p) if os.path.exists(p) else None


def _extrair_nota(texto):
    """A nota começa no cabeçalho '---'; linhas NÃO ACATADO ficam de fora."""
    i = texto.find("---\n")
    corpo = texto[i:] if i >= 0 else texto
    return "\n".join(l for l in corpo.splitlines() if not l.startswith("NÃO ACATADO:")).strip() + "\n"


def _objecoes_da_rodada(ciclo, rodada):
    """O que a rodada anterior devolveu: itens do validador mecânico ou pareceres dos revisores."""
    vpath = os.path.join(ciclo, f"{_nome('validacao_mecanica', rodada)}.json")
    if os.path.exists(vpath):
        v = json.loads(_ler(vpath))
        if v["decisao"] != "aprovar":
            return "Validador mecânico:\n" + "\n".join(f"{i['codigo']} linha {i['linha']}: {i['motivo']}" for i in v["itens"])
    partes = []
    for r in REVISORES:
        s = _saida(ciclo, r, rodada)
        rotulo = "ABC"[REVISORES.index(r)]
        if s and decisao_do_parecer(s, r) != "aprovar":
            partes.append(f"Parecer de um revisor independente ({rotulo}), que devolveu:\n{s}")
        elif s and ITEM_QUALQUER.search(s):
            partes.append(f"Sugestões de um revisor independente ({rotulo}), que aprovou (não bloqueiam):\n{s}")
    return "\n\n".join(partes) or "nenhuma"


def entradas(etapa, ciclo, pacote, rodada=0, gold_dir=None):
    """Mensagem do usuário por etapa. Isolamento: cada etapa só lê o que a tabela do módulo permite."""
    fatos = tabela_fatos(pacote)
    if etapa in ("analista_familias", "analista_empresas"):
        return f"{fatos}\n\nEscreva os parágrafos do seu recorte para a nota de {pacote['data_base']}."
    if etapa == "replicador":
        return f"{fatos}\n\nPergunta: o que mudou no crédito em {pacote['data_base']}, para famílias e para empresas?"
    if etapa == "consolidador":
        return (f"{fatos}\n\nRascunho do analista de famílias:\n\n{_saida(ciclo, 'analista_familias')}\n\n"
                f"Rascunho do analista de empresas:\n\n{_saida(ciclo, 'analista_empresas')}\n\n"
                f"Consolide numa nota. data_base: {pacote['data_base']} · pacote_sha256: {pacote['sha256_fatos']}")
    if etapa == "critico":
        return f"{fatos}\n\nNota consolidada:\n\n{_extrair_nota(_saida(ciclo, 'consolidador'))}"
    if etapa == "revisao":
        anterior = _saida(ciclo, "revisao", rodada - 1) if rodada else _saida(ciclo, "consolidador")
        objecoes = _objecoes_da_rodada(ciclo, rodada - 1) if rodada else "nenhuma (primeira revisão)"
        return (f"{fatos}\n\nNota atual:\n\n{_extrair_nota(anterior)}\n\nObjeções do crítico:\n\n{_saida(ciclo, 'critico')}\n\n"
                f"Leitura do replicador:\n\n{_saida(ciclo, 'replicador')}\n\n"
                f"Devoluções da rodada anterior (validador mecânico e revisores):\n\n{objecoes}\n\n"
                f"Devolva a nota revisada. data_base: {pacote['data_base']} · pacote_sha256: {pacote['sha256_fatos']}")
    if etapa in REVISORES:
        return entrada_revisor(etapa, _ler(os.path.join(ciclo, "nota_final.md")), pacote, gold_dir)
    raise ValueError(etapa)


def entrada_revisor(revisor, nota_final, pacote, gold_dir):
    """Mensagem de cada revisor: a nota final e a evidência própria do papel. Usada pelo ciclo
    e pela bateria semântica, para que a medida seja feita com o prompt real."""
    if revisor == "validador_constitucional":
        return f"{tabela_fatos(pacote)}\n\nNota final:\n\n{nota_final}"
    if revisor == "revisor_independente":
        return f"Fatos do pacote (JSON):\n\n{fatos_json(pacote)}\n\nNota final:\n\n{nota_final}"
    if revisor == "terceiro_revisor":
        return f"{historico_bruto(gold_dir, pacote['data_base'])}\n\nNota final:\n\n{nota_final}"
    raise ValueError(revisor)


ITEM_GRAVE = re.compile(r"^\s*ITEM\s*\[?\s*grave\s*\]?\s*:", re.M | re.I)
CRITERIO_FALHA = re.compile(r"^\s*C\d\s*:\s*falha", re.M | re.I)
CRITERIO_OK = re.compile(r"^\s*C\d\s*:\s*ok", re.M | re.I)
ITEM_QUALQUER = re.compile(r"^\s*ITEM\s*\[?\s*(grave|moderada|leve)\s*\]?\s*:", re.M | re.I)


def decisao_declarada(texto):
    m = re.findall(r"DECISÃO:\s*(aprovar|devolver)", texto or "")
    return m[-1] if m else None


def decisao_do_parecer(texto, papel=None):
    """'aprovar', 'devolver' ou 'sem_decisao' (que conta como devolução).

    Revisores no formato ITEM (revisor independente e terceiro revisor): a decisão é derivada
    dos itens por código, não da linha DECISÃO. Devolve se e só se houver item grave;
    moderadas e leves são sugestões registradas que não bloqueiam (constituição v2, art. 6.5).
    Validador constitucional (formato C1 a C5): qualquer falha devolve, todas ok aprovam.
    Sem papel informado: vale a linha DECISÃO."""
    declarada = decisao_declarada(texto)
    if papel == "validador_constitucional":
        if CRITERIO_FALHA.search(texto or ""):
            return "devolver"
        return "aprovar" if CRITERIO_OK.search(texto or "") else (declarada or "sem_decisao")
    if papel in REVISORES_POR_ITEM:
        if ITEM_GRAVE.search(texto or ""):
            return "devolver"
        return "aprovar" if (declarada or ITEM_QUALQUER.search(texto or "")) else "sem_decisao"
    return declarada or "sem_decisao"


# ---------------------------------------------------------------- backends

def backend_manual(etapa, sistema, usuario, papel_cfg, ciclo=None, nome=None):
    raise Pendente(nome or etapa)


def backend_anthropic(etapa, sistema, usuario, papel_cfg, ciclo=None, nome=None):
    if papel_cfg.get("fornecedor", "anthropic") != "anthropic":
        raise NotImplementedError(f"{etapa}: fornecedor {papel_cfg['fornecedor']} sem backend configurado")
    import anthropic  # dependência opcional: só este backend a exige

    client = anthropic.Anthropic()
    extra = {}
    if papel_cfg["modelo"] in MODELOS_COM_FALLBACK:
        # recusa por classificador vira nova tentativa no modelo que a API recomenda para a
        # categoria; o modelo que efetivamente respondeu fica registrado no uso
        extra = {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"}
    resp = client.beta.messages.create(
        model=papel_cfg["modelo"],
        max_tokens=16000,
        output_config={"effort": papel_cfg.get("esforco", "high")},
        system=[{"type": "text", "text": sistema, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": usuario}],
        **extra,
    )
    if resp.stop_reason == "refusal":
        raise RuntimeError(f"{etapa}: recusa do modelo ({getattr(resp.stop_details, 'category', None)})")
    texto = "".join(b.text for b in resp.content if b.type == "text")
    u = resp.usage
    uso = {"modelo_pedido": papel_cfg["modelo"], "modelo_respondeu": resp.model,
           "fallback": any(getattr(it, "type", None) == "fallback_message" for it in (getattr(u, "iterations", None) or [])),
           "input_tokens": u.input_tokens, "output_tokens": u.output_tokens,
           "cache_read_input_tokens": getattr(u, "cache_read_input_tokens", None),
           "cache_creation_input_tokens": getattr(u, "cache_creation_input_tokens", None),
           "stop_reason": resp.stop_reason}
    return texto, uso


BACKENDS = {"manual": backend_manual, "anthropic": backend_anthropic}


# ---------------------------------------------------------------- execução

def _config():
    return json.loads(_ler(os.path.join(PAPEIS, "config.json")))


def _estado(ciclo):
    p = os.path.join(ciclo, "estado.json")
    return json.loads(_ler(p)) if os.path.exists(p) else None


def preparar(ciclo, gold_dir=fc.GOLD_PUBLICADA, retro=False):
    if not dentro_de_notas(ciclo):
        raise PermissionError(f"ciclo fora de notas/: {ciclo}")
    if _estado(ciclo):
        return _estado(ciclo)
    pacote = fc.construir(gold_dir)
    _gravar(ciclo, "pacote.json", pacote)
    os.makedirs(os.path.join(ciclo, "saidas"), exist_ok=True)
    estado = {"versao": 2, "data_base": pacote["data_base"], "retro": retro,
              "gold_dir": os.path.relpath(gold_dir, RAIZ),
              "criado_em": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
              "concluidas": [], "rodada_revisao": 0, "devolucoes": 0, "rodadas": []}
    _gravar(ciclo, "estado.json", estado)
    return estado


def _rodar_agente(ciclo, etapa, pacote, backend, cfg, rodada=0, gold_dir=None):
    papel = PAPEL_DA_ETAPA.get(etapa, etapa)
    nome = _nome(etapa, rodada)
    sistema, usuario = sistema_do_papel(papel), entradas(etapa, ciclo, pacote, rodada, gold_dir)
    _gravar(ciclo, f"prompts/{nome}.md", f"<!-- papel: {papel} -->\n# SISTEMA\n\n{sistema}\n\n# USUÁRIO\n\n{usuario}\n")
    if _saida(ciclo, etapa, rodada) is not None:
        return  # resposta já presente (modo manual, ou retomada)
    texto, uso = backend(etapa, sistema, usuario, cfg["papeis"][papel], ciclo, nome)
    _gravar(ciclo, f"saidas/{nome}.md", texto)
    _gravar(ciclo, f"uso/{nome}.json", {**uso, "papel": papel})


def _marcar(ciclo, estado, chave):
    estado["concluidas"].append(chave)
    _gravar(ciclo, "estado.json", estado)


def _rodada(ciclo, estado, pacote, backend, cfg, gold_dir):
    """Uma rodada de revisão. Devolve o registro da rodada (com 'unanime' True/False)."""
    r = estado["rodada_revisao"]
    feito = lambda e: f"{e}@{r}" in estado["concluidas"]
    if not feito("revisao"):
        _rodar_agente(ciclo, "revisao", pacote, backend, cfg, r)
        _marcar(ciclo, estado, f"revisao@{r}")
    registro = {"rodada": r}
    texto = _extrair_nota(_saida(ciclo, "revisao", r))
    if not feito("validacao_mecanica"):
        v = vd.validar(texto, pacote, gold_dir)
        _gravar(ciclo, f"{_nome('validacao_mecanica', r)}.json", v)
        _gravar(ciclo, "validacao_mecanica.json", v)
        _gravar(ciclo, "nota.md", texto)
        if v["decisao"] == "aprovar":
            _gravar(ciclo, "nota_final.md", nt.renderizar(texto, pacote))
        _marcar(ciclo, estado, f"validacao_mecanica@{r}")
    v = json.loads(_ler(os.path.join(ciclo, f"{_nome('validacao_mecanica', r)}.json")))
    registro["validador_mecanico"] = v["decisao"]
    if v["decisao"] != "aprovar":
        registro["unanime"] = False
        return registro
    for revisor in REVISORES:
        if not feito(revisor):
            _rodar_agente(ciclo, revisor, pacote, backend, cfg, r, gold_dir)
            _marcar(ciclo, estado, f"{revisor}@{r}")
        registro[revisor] = decisao_do_parecer(_saida(ciclo, revisor, r), revisor)
    registro["unanime"] = all(registro[x] == "aprovar" for x in REVISORES)
    return registro


def executar(ciclo, backend=backend_manual, gold_dir=fc.GOLD_PUBLICADA):
    """Avança o ciclo até a decisão final ou até uma etapa manual pendente. Devolve o estado."""
    cfg = _config()
    falhas = verificar_independencia(cfg)
    if falhas:
        raise ValueError(f"revisores sem independência mínima (constituição, art. 6.3): {falhas}")
    estado = preparar(ciclo, gold_dir)
    gold_dir = os.path.join(RAIZ, estado["gold_dir"])
    pacote = json.loads(_ler(os.path.join(ciclo, "pacote.json")))
    try:
        for etapa in ETAPAS_INICIAIS:
            if etapa not in estado["concluidas"]:
                _rodar_agente(ciclo, etapa, pacote, backend, cfg)
                _marcar(ciclo, estado, etapa)
        while "decisao_final" not in estado:
            reg = _rodada(ciclo, estado, pacote, backend, cfg, gold_dir)
            estado["rodadas"] = [x for x in estado["rodadas"] if x["rodada"] != reg["rodada"]] + [reg]
            if reg["unanime"]:
                estado["decisao_final"] = "aprovada"
            else:
                estado["devolucoes"] += 1
                if estado["rodada_revisao"] + 1 >= cfg["max_rodadas_revisao"]:
                    estado["decisao_final"] = "rejeitada"
                else:
                    estado["rodada_revisao"] += 1
            _gravar(ciclo, "estado.json", estado)
        if "render" not in estado["concluidas"]:
            texto = _ler(os.path.join(ciclo, "nota.md"))
            v = json.loads(_ler(os.path.join(ciclo, "validacao_mecanica.json")))
            papeis = {p: {**cfg["papeis"][p], "instrucoes_sha256": nt.sha256_texto(sistema_do_papel(p))}
                      for p in cfg["papeis"]}
            nt.gravar_pacote_reprodutibilidade(ciclo, pacote, texto, v, papeis, gold_dir)
            _gravar(ciclo, "decisao.json", {
                "decisao": estado["decisao_final"], "rodadas": estado["rodadas"],
                "regra": "aprovada só com validador mecânico e os três revisores aprovando (constituição v2, art. 6.5)",
                "revisores": caracteristicas(cfg), "revisao_humana": False,
                "publicacao": "degrau 1: nota aprovada fica só no repositório" if estado["decisao_final"] == "aprovada"
                              else "rejeitada: não é publicada"})
            _gravar(ciclo, "metricas.json", metricas.do_ciclo(ciclo))
            _marcar(ciclo, estado, "render")
    except Pendente as p:
        estado["pendente"] = str(p)
        _gravar(ciclo, "estado.json", estado)
        return estado
    estado.pop("pendente", None)
    _gravar(ciclo, "estado.json", estado)
    return estado


def main(argv=None):
    ap = argparse.ArgumentParser(description="Orquestrador da nota de conjuntura (sem revisão humana).")
    ap.add_argument("ciclo", help="diretório do ciclo, dentro de notas/ (ex.: notas/2026-08)")
    ap.add_argument("--gold", default=fc.GOLD_PUBLICADA)
    ap.add_argument("--backend", choices=sorted(BACKENDS), default="manual")
    args = ap.parse_args(argv)
    ciclo = os.path.abspath(args.ciclo)
    e = executar(ciclo, BACKENDS[args.backend], os.path.abspath(args.gold))
    if e.get("pendente"):
        print(f"pendente: {e['pendente']}. Prompt em {args.ciclo}/prompts/{e['pendente']}.md; "
              f"grave a resposta em {args.ciclo}/saidas/{e['pendente']}.md e rode de novo.")
        return 2
    print(f"ciclo concluído: {args.ciclo}; decisão: {e['decisao_final']} (decisao.json)")
    return 0 if e["decisao_final"] == "aprovada" else 3


if __name__ == "__main__":
    sys.exit(main())
