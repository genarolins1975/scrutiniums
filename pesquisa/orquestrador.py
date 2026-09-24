"""Orquestrador da nota de conjuntura (piloto, PR 5). Fora do pipeline de números.

Etapas, em ordem, com as entradas que cada papel pode ver (isolamento é regra, não gosto):

    analista_familias / analista_empresas   tabela de fatos + modelo da nota
    replicador                              só a tabela de fatos e a pergunta
    consolidador                            rascunhos dos analistas
    critico                                 nota consolidada + tabela de fatos
    revisao (consolidador)                  nota + objeções + leitura do replicador + itens do validador
    validacao_mecanica                      código (pesquisa/validador.py); devolve à revisão até o limite
    validador_constitucional                só a nota renderizada, a tabela e a constituição
    render                                  nota final + pacote de reprodutibilidade + métricas

Backends:
    manual     grava o prompt em prompts/<etapa>.md e para; a resposta é colocada em
               saidas/<etapa>.md (por pessoa ou por sessão separada de agente) e o comando
               é rodado de novo. Serve para rodar sem chave de API e sem custo.
    anthropic  chama a API com o SDK oficial (`pip install anthropic`); registra tokens e o
               modelo que respondeu em uso/<etapa>.json.
    Um backend é qualquer função (etapa, sistema, usuario, papel_cfg) → (texto, uso).

Tudo é escrito dentro de notas/; qualquer outro destino é recusado.

Uso:
    python3 -m pesquisa.orquestrador notas/2026-08 [--gold DIR] [--backend manual|anthropic]
"""
import argparse
import datetime as dt
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
ETAPAS = ["analista_familias", "analista_empresas", "replicador", "consolidador", "critico",
          "revisao", "validacao_mecanica", "validador_constitucional", "render"]
PAPEL_DA_ETAPA = {"revisao": "consolidador"}


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


def sistema_do_papel(papel):
    """Instruções estáveis (cacheáveis): regras comuns + papel + constituição."""
    return "\n\n".join([_ler(os.path.join(PAPEIS, "comum.md")), _ler(os.path.join(PAPEIS, f"{papel}.md")),
                        "# Constituição editorial\n\n" + _ler(nt.CONSTITUICAO)])


def _nome(etapa, rodada=0):
    """Arquivo de saída da etapa; cada rodada de revisão tem o seu (revisao, revisao_1, ...)."""
    return f"{etapa}_{rodada}" if etapa == "revisao" and rodada else etapa


def _saida(ciclo, etapa, rodada=0):
    p = os.path.join(ciclo, "saidas", f"{_nome(etapa, rodada)}.md")
    return _ler(p) if os.path.exists(p) else None


def _extrair_nota(texto):
    """A nota começa no cabeçalho '---'; linhas NÃO ACATADO ficam de fora."""
    i = texto.find("---\n")
    corpo = texto[i:] if i >= 0 else texto
    return "\n".join(l for l in corpo.splitlines() if not l.startswith("NÃO ACATADO:")).strip() + "\n"


def entradas(etapa, ciclo, pacote, rodada=0):
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
        itens = ""
        vpath = os.path.join(ciclo, "validacao_mecanica.json")
        if rodada and os.path.exists(vpath):
            v = json.loads(_ler(vpath))
            itens = "\n".join(f"{i['codigo']} linha {i['linha']}: {i['motivo']}" for i in v["itens"])
        return (f"{fatos}\n\nNota atual:\n\n{_extrair_nota(anterior)}\n\nObjeções do crítico:\n\n{_saida(ciclo, 'critico')}\n\n"
                f"Leitura do replicador:\n\n{_saida(ciclo, 'replicador')}\n\n"
                f"Itens do validador mecânico:\n\n{itens or 'nenhum (primeira revisão)'}\n\n"
                f"Devolva a nota revisada. data_base: {pacote['data_base']} · pacote_sha256: {pacote['sha256_fatos']}")
    if etapa == "validador_constitucional":
        return f"{fatos}\n\nNota renderizada:\n\n{_ler(os.path.join(ciclo, 'nota_final.md'))}"
    raise ValueError(etapa)


# ---------------------------------------------------------------- backends

def backend_manual(etapa, sistema, usuario, papel_cfg, ciclo=None):
    raise Pendente(etapa if etapa != "revisao" else _nome(etapa, (_estado(ciclo) or {}).get("rodada_revisao", 0)))


def backend_anthropic(etapa, sistema, usuario, papel_cfg, ciclo=None):
    import anthropic  # dependência opcional: só este backend a exige

    client = anthropic.Anthropic()
    resp = client.beta.messages.create(
        model=papel_cfg["modelo"],
        max_tokens=16000,
        # recusa por classificador vira nova tentativa no modelo que a API recomenda para a
        # categoria; o modelo que efetivamente respondeu fica registrado no uso
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": papel_cfg.get("esforco", "high")},
        system=[{"type": "text", "text": sistema, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": usuario}],
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
    os.makedirs(os.path.join(ciclo, "saidas"), exist_ok=True)  # onde as respostas manuais são gravadas
    estado = {"data_base": pacote["data_base"], "retro": retro, "gold_dir": os.path.relpath(gold_dir, RAIZ),
              "criado_em": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
              "concluidas": [], "rodada_revisao": 0, "devolucoes": 0}
    _gravar(ciclo, "estado.json", estado)
    _gravar(ciclo, "editor.json", {"inicio": None, "fim": None, "minutos": None, "decisao": None,
                                   "erros_factuais_encontrados": [], "observacoes": None,
                                   "instrucao": "Preencher ao revisar: inicio e fim em ISO 8601, decisao publicar | editar | rejeitar; cada erro factual que o validador deixou passar vai para erros_factuais_encontrados e para pesquisa/registro_erros.json."})
    return estado


def _rodar_agente(ciclo, etapa, pacote, backend, cfg, rodada=0):
    papel = PAPEL_DA_ETAPA.get(etapa, etapa)
    nome = _nome(etapa, rodada)
    sistema, usuario = sistema_do_papel(papel), entradas(etapa, ciclo, pacote, rodada)
    _gravar(ciclo, f"prompts/{nome}.md", f"<!-- papel: {papel} -->\n# SISTEMA\n\n{sistema}\n\n# USUÁRIO\n\n{usuario}\n")
    if _saida(ciclo, etapa, rodada) is not None:
        return  # resposta já presente (modo manual, ou retomada)
    texto, uso = backend(etapa, sistema, usuario, cfg["papeis"][papel], ciclo)
    _gravar(ciclo, f"saidas/{nome}.md", texto)
    _gravar(ciclo, f"uso/{nome}.json", {**uso, "papel": papel})


def _decisao_constitucional(texto):
    m = re.search(r"DECISÃO:\s*(aprovar|devolver)", texto or "")
    return m.group(1) if m else "sem_decisao"


def executar(ciclo, backend=backend_manual, gold_dir=fc.GOLD_PUBLICADA):
    """Avança o ciclo até terminar ou até uma etapa manual pendente. Devolve o estado."""
    estado = preparar(ciclo, gold_dir)
    pacote = json.loads(_ler(os.path.join(ciclo, "pacote.json")))
    cfg = _config()
    try:
        for etapa in ETAPAS:
            if etapa in estado["concluidas"]:
                continue
            if etapa == "validacao_mecanica":
                texto = _extrair_nota(_saida(ciclo, "revisao", estado["rodada_revisao"]))
                v = vd.validar(texto, pacote, os.path.join(RAIZ, estado["gold_dir"]))
                _gravar(ciclo, "validacao_mecanica.json", v)
                _gravar(ciclo, "nota.md", texto)
                if v["decisao"] != "aprovar":
                    estado["devolucoes"] += 1
                    if estado["rodada_revisao"] + 1 >= cfg["max_rodadas_revisao"]:
                        estado["parado"] = f"validador: {v['decisao']} após {cfg['max_rodadas_revisao']} rodadas; vai ao editor"
                        break
                    estado["rodada_revisao"] += 1
                    estado["concluidas"].remove("revisao")
                    _gravar(ciclo, "estado.json", estado)
                    return executar(ciclo, backend, gold_dir)
                _gravar(ciclo, "nota_final.md", nt.renderizar(texto, pacote))
            elif etapa == "validador_constitucional":
                _rodar_agente(ciclo, etapa, pacote, backend, cfg)
                estado["decisao_constitucional"] = _decisao_constitucional(_saida(ciclo, etapa))
            elif etapa == "render":
                texto = _ler(os.path.join(ciclo, "nota.md"))
                v = json.loads(_ler(os.path.join(ciclo, "validacao_mecanica.json")))
                papeis = {p: {"modelo": c["modelo"], "instrucoes_sha256": nt.sha256_texto(sistema_do_papel(p))}
                          for p, c in cfg["papeis"].items()}
                nt.gravar_pacote_reprodutibilidade(ciclo, pacote, texto, v, papeis, os.path.join(RAIZ, estado["gold_dir"]))
                _gravar(ciclo, "metricas.json", metricas.do_ciclo(ciclo))
            else:
                _rodar_agente(ciclo, etapa, pacote, backend, cfg, estado["rodada_revisao"] if etapa == "revisao" else 0)
            estado["concluidas"].append(etapa)
            _gravar(ciclo, "estado.json", estado)
    except Pendente as p:
        estado["pendente"] = str(p)
        _gravar(ciclo, "estado.json", estado)
        return estado
    estado.pop("pendente", None)
    _gravar(ciclo, "estado.json", estado)
    return estado


def main(argv=None):
    ap = argparse.ArgumentParser(description="Orquestrador da nota de conjuntura (piloto, degrau 1).")
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
    if e.get("parado"):
        print(f"parado: {e['parado']}")
        return 3
    print(f"ciclo concluído: {args.ciclo}; revisão do editor em editor.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
