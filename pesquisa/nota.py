"""Formato da nota, renderizador determinístico e manifesto de reprodutibilidade (piloto, PR 3).

Uma nota é texto com marcadores. Nenhum número é escrito por agente: o valor entra na
renderização, a partir do pacote de fatos (docs/CONSTITUICAO.md, art. 1).

Formato da fonte da nota (`nota.md`):

    ---
    tipo: conjuntura
    data_base: 2026-07
    pacote_sha256: <sha256_fatos do pacote>
    degrau: 1
    declaracao_interesse:
    ---
    # Título, sem dígitos
    [EVIDÊNCIA] A inadimplência total ficou em {{inad_total.nivel}} em {{data:inad_total.nivel}}.
    [INFERÊNCIA] ... Refutaria esta leitura: ...

Marcadores:
    {{id}}          texto do fato com sinal (ex.: "+0,30 p.p.", "4,88%")
    {{id|abs}}      texto do fato sem sinal (exige palavra de direção junto; validador M6)
    {{data:id}}     data de referência do fato (ex.: "jul/2026")
    {{fonte:id}}    fonte do fato (ex.: "BCB/SGS 21082")
    {{data_base}}   data base da nota
    {{lacunas}}     lista das lacunas declaradas no pacote

Todo parágrafo abre com uma classe: [EVIDÊNCIA], [INFERÊNCIA] ou [RECOMENDAÇÃO].
Títulos (#) não levam classe.
"""
import hashlib
import json
import os
import re
import subprocess

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONSTITUICAO = os.path.join(RAIZ, "docs", "CONSTITUICAO.md")

CLASSES = {"EVIDÊNCIA": "Evidência", "INFERÊNCIA": "Inferência", "RECOMENDAÇÃO": "Recomendação"}
MARCADOR_CLASSE = re.compile(r"^\[(EVIDÊNCIA|INFERÊNCIA|RECOMENDAÇÃO)\]\s*")
MARCADOR = re.compile(r"\{\{\s*(?:(data|fonte):)?([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)?)(?:\|(abs))?\s*\}\}")
MESES = ("jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez")
FRASE_REVISAO = ("Os dados do BCB são revisados nas divulgações seguintes; os números desta nota valem "
                 "para a gold identificada no pacote de reprodutibilidade.")


def mes_ano(ref):
    """'2026-07' ou '2026-07-01' → 'jul/2026'."""
    r = str(ref or "")
    if len(r) >= 7 and r[4] == "-" and r[5:7].isdigit() and 1 <= int(r[5:7]) <= 12:
        return f"{MESES[int(r[5:7]) - 1]}/{r[:4]}"
    return r


def sha256_texto(t):
    return hashlib.sha256(t.encode("utf-8")).hexdigest()


def sha256_arquivo(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


# ---------------------------------------------------------------- leitura

def ler_nota(texto):
    """Separa cabeçalho (chave: valor) e corpo. Devolve (cabecalho, blocos), em que cada
    bloco é {"tipo": "titulo"|"paragrafo", "classe": str|None, "texto": str, "linha": n}."""
    cab, corpo, inicio = {}, texto, 1
    m = re.match(r"^---\n(.*?)\n---\n", texto, flags=re.S)
    if m:
        for linha in m.group(1).splitlines():
            if ":" in linha:
                k, v = linha.split(":", 1)
                cab[k.strip()] = v.strip()
        corpo = texto[m.end():]
        inicio = m.group(0).count("\n") + 1
    blocos, atual, linha_ini = [], [], None
    for n, linha in enumerate(corpo.splitlines(), start=inicio):
        if not linha.strip():
            if atual:
                blocos.append((linha_ini, " ".join(atual)))
                atual = []
            continue
        if linha.startswith("#"):
            if atual:
                blocos.append((linha_ini, " ".join(atual)))
                atual = []
            blocos.append((n, linha))
            continue
        if not atual:
            linha_ini = n
        atual.append(linha.strip())
    if atual:
        blocos.append((linha_ini, " ".join(atual)))
    out = []
    for n, b in blocos:
        if b.startswith("#"):
            out.append({"tipo": "titulo", "classe": None, "texto": b.lstrip("#").strip(),
                        "nivel": len(b) - len(b.lstrip("#")), "linha": n})
            continue
        m = MARCADOR_CLASSE.match(b)
        out.append({"tipo": "paragrafo", "classe": m.group(1) if m else None,
                    "texto": b[m.end():] if m else b, "linha": n})
    return cab, out


def marcadores(texto):
    """[(inicio, fim, modo, id, abs)] em ordem; modo None = valor, 'data' ou 'fonte'."""
    return [(m.start(), m.end(), m.group(1), m.group(2), bool(m.group(3))) for m in MARCADOR.finditer(texto)]


# ---------------------------------------------------------------- renderização

def _valor_marcador(modo, fid, absoluto, fatos, pacote):
    if fid == "data_base":
        return mes_ano(pacote["data_base"])
    if fid == "lacunas":
        lac = pacote.get("lacunas") or []
        return "; ".join(f"{l['fato']}: {l['motivo']}" for l in lac) if lac else "nenhuma lacuna no escopo"
    f = fatos[fid]
    if modo == "data":
        return mes_ano(f["data_ref"])
    if modo == "fonte":
        return f["fonte"]
    return f["texto_abs"] if absoluto and "texto_abs" in f else f["texto"]


def substituir(texto, pacote):
    fatos = {f["id"]: f for f in pacote["fatos"]}
    out = MARCADOR.sub(lambda m: _valor_marcador(m.group(1), m.group(2), bool(m.group(3)), fatos, pacote), texto)
    # abreviatura no fim da frase não ganha segundo ponto ("0,98 p.p..")
    return re.sub(r"\b(p\.p|a\.a|a\.m)\.\.", r"\1.", out)


def renderizar(texto_nota, pacote):
    """Nota final em Markdown: marcadores substituídos pelo pacote, classe explícita em cada
    parágrafo, tabela de fontes de todos os fatos citados e frase de sujeição a revisão.
    Determinístico: mesma nota e mesmo pacote, mesmo texto."""
    cab, blocos = ler_nota(texto_nota)
    fatos = {f["id"]: f for f in pacote["fatos"]}
    citados = []
    linhas = []
    for b in blocos:
        for _i, _f, _modo, fid, _a in marcadores(b["texto"]):
            if fid in fatos and fid not in citados:
                citados.append(fid)
        corpo = substituir(b["texto"], pacote)
        if b["tipo"] == "titulo":
            linhas.append(f"{'#' * b['nivel']} {corpo}")
        else:
            rotulo = CLASSES.get(b["classe"], "Sem classe")
            linhas.append(f"*{rotulo}.* {corpo}")
        linhas.append("")
    if cab.get("declaracao_interesse"):
        linhas += [f"*Declaração de interesse.* {cab['declaracao_interesse']}", ""]
    linhas += ["## Fontes dos números", "",
               "| Fato | Valor | Data de referência | Fonte |", "|---|---|---|---|"]
    for fid in citados:
        f = fatos[fid]
        linhas.append(f"| {f['rotulo']} | {f['texto']} | {mes_ano(f['data_ref'])} | {f['fonte']} |")
    linhas += ["", FRASE_REVISAO, "",
               f"Pacote de fatos `{pacote['sha256_fatos'][:16]}`, data base {mes_ano(pacote['data_base'])}. "
               f"Verificação: `python3 -m pesquisa.fatos_conjuntura --verificar pacote.json`.", ""]
    return "\n".join(linhas)


# ---------------------------------------------------------------- manifesto

def _commit_da_gold(gold_dir):
    try:
        r = subprocess.run(["git", "log", "-1", "--format=%H", "--", "pulse.json"], cwd=gold_dir,
                           capture_output=True, text=True, timeout=20)
        return r.stdout.strip() or None
    except (OSError, subprocess.SubprocessError):
        return None


def manifesto(pacote, texto_nota, texto_final, validacao=None, papeis=None, gold_dir=None):
    """Tudo o que um leitor precisa para refazer a nota: commit e hashes da gold, hash dos
    fatos, da constituição, da fonte e do texto final, decisão do validador e o modelo e a
    versão usados por papel (`papeis`: {papel: {"modelo": ..., "instrucoes_sha256": ...}})."""
    return {
        "tipo": "manifesto_nota",
        "versao": 1,
        "data_base": pacote["data_base"],
        "gold": pacote["gold"],
        "gold_commit": _commit_da_gold(gold_dir) if gold_dir else None,
        "sha256_fatos": pacote["sha256_fatos"],
        "constituicao_sha256": sha256_arquivo(CONSTITUICAO) if os.path.exists(CONSTITUICAO) else None,
        "nota_sha256": sha256_texto(texto_nota),
        "nota_final_sha256": sha256_texto(texto_final),
        "validador": ({"decisao": validacao.get("decisao"), "versao": validacao.get("versao_validador")}
                      if validacao else None),
        "papeis": papeis or {},
        "como_verificar": ["git checkout <gold_commit>",
                           "python3 -m pesquisa.fatos_conjuntura --verificar pacote.json",
                           "python3 -m pesquisa.validador nota.md --pacote pacote.json"],
    }


def gravar_pacote_reprodutibilidade(destino, pacote, texto_nota, validacao, papeis=None, gold_dir=None):
    """Grava em `destino` o conjunto publicado com cada nota (docs/AVALIACAO_AGENTES, seção 4f)."""
    os.makedirs(destino, exist_ok=True)
    final = renderizar(texto_nota, pacote)
    arquivos = {
        "nota.md": texto_nota,
        "nota_final.md": final,
        "pacote.json": json.dumps(pacote, ensure_ascii=False, indent=1) + "\n",
        "validador.json": json.dumps(validacao, ensure_ascii=False, indent=1) + "\n",
        "manifesto.json": json.dumps(manifesto(pacote, texto_nota, final, validacao, papeis, gold_dir),
                                     ensure_ascii=False, indent=1) + "\n",
    }
    for nome, conteudo in arquivos.items():
        with open(os.path.join(destino, nome), "w", encoding="utf-8") as f:
            f.write(conteudo)
    return sorted(arquivos)
