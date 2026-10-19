"""Vigília de frescor por domínio: uma issue por observatório fora do limiar.

Uso:
    python3 scripts/vigilancia.py dominios            # avalia e abre/comenta/fecha issues (precisa do gh)
    python3 scripts/vigilancia_frescor.py --relatorio # só imprime a situação de cada domínio

Lê src/lib/frescor/limiares.json, a MESMA fonte da faixa de frescor das
entradas (src/lib/frescor/regras.ts): cadência, limiar e onde cada domínio
publica as próprias datas. A regra é a mesma nas duas linguagens; os casos de
src/lib/frescor/casos.json são conferidos pelos testes de ambas
(pipeline/tests/test_vigilancia_frescor.py e src/tests/frescor-dominios.test.ts).

Para cada domínio:
- em dia: silêncio; se havia issue aberta deste domínio, comenta que voltou a
  ficar em dia e a fecha;
- atrasado, retido em parte ou sem data: abre a issue do domínio ou, se já
  existe uma aberta com o mesmo título, comenta nela (nunca duplica).

Os arquivos são lidos do checkout (o workflow roda no main). Arquivo ausente
ou ilegível conta como "sem data", que também vira issue: vigia cego para um
domínio é pior que alerta falso.
"""
import json
import math
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
LIMIARES = RAIZ / "src" / "lib" / "frescor" / "limiares.json"
DIA_S = 86400
BRASILIA = timezone(timedelta(hours=-3))


def carregar_limiares(caminho=LIMIARES):
    return json.loads(Path(caminho).read_text(encoding="utf-8"))


def valores_no_campo(obj, campo):
    """Valores no caminho "a.b.c", com "*" para todos os itens de um objeto ou lista; nulos descartados."""
    atuais = [obj]
    for parte in campo.split("."):
        proximos = []
        for v in atuais:
            if isinstance(v, dict):
                if parte == "*":
                    proximos.extend(v.values())
                elif parte in v:
                    proximos.append(v[parte])
            elif isinstance(v, list) and parte == "*":
                proximos.extend(v)
        atuais = proximos
    return [v for v in atuais if v is not None]


_DATA = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_DATA_HORA = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$")


def instante(valor):
    """Data sem hora é a meia-noite de Brasília; com hora e sem fuso é UTC. O resto não é data."""
    if not isinstance(valor, str):
        return None
    s = valor.strip()
    try:
        if _DATA.match(s):
            return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=BRASILIA)
        if not _DATA_HORA.match(s):
            return None
        s = re.sub(r"(\.\d{3})\d+", r"\1", s)
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        d = datetime.fromisoformat(s)
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def referencia_normal(valor):
    if isinstance(valor, bool):
        return None
    if isinstance(valor, int) and 1900 <= valor <= 2999:
        return str(valor)
    if not isinstance(valor, str):
        return None
    m = re.match(r"^(\d{4})(-(0[1-9]|1[0-2]))?(-(0[1-9]|[12]\d|3[01]))?(?!\d)", valor.strip())
    if not m or (m.group(4) and not m.group(2)):
        return None
    return m.group(0)


def extrair(limiares, dominio, ler):
    """Datas de um domínio com um leitor de arquivos; arquivo ausente ou ilegível é ausência de data."""
    d = limiares["dominios"][dominio]
    cache = {}

    def conteudo(arquivo):
        if arquivo not in cache:
            try:
                cache[arquivo] = ler(arquivo)
            except Exception:  # ausência, JSON quebrado: sem data, não erro
                cache[arquivo] = None
        return cache[arquivo]

    def datas(origens):
        achadas = []
        for o in origens or []:
            for v in valores_no_campo(conteudo(o["arquivo"]), o["campo"]):
                t = instante(v)
                if t:
                    achadas.append((t, v))
        return sorted(achadas, key=lambda x: x[0])

    pub = datas(d.get("publicacao"))
    partes = datas(d.get("partes"))
    refs = sorted(r for o in d["referencia"] for r in map(referencia_normal, valores_no_campo(conteudo(o["arquivo"]), o["campo"])) if r)
    return {
        "id": dominio,
        "publicadoEm": pub[0][1] if pub else None,
        "parteMaisRecente": partes[-1][1] if partes else None,
        "referencia": refs[-1] if refs else None,
    }


def _dias_desde(iso, agora):
    t = instante(iso)
    if t is None:
        return None
    return max(0, math.floor((agora - t).total_seconds() / DIA_S))


def situacao(limiares, dados, agora):
    """A regra de src/lib/frescor/regras.ts (situacaoDominio), linha a linha."""
    c = limiares["cadencias"][limiares["dominios"][dados["id"]]["cadencia"]]
    intervalo, limite = c["intervalo"], c["limite"]
    base = {"intervalo": intervalo, "limite": limite}
    dias = _dias_desde(dados.get("publicadoEm"), agora)
    if dias is None:
        return {**base, "estado": "sem-data", "dias": None, "atrasoDias": None}
    if dias < limite:
        return {**base, "estado": "em-dia", "dias": dias, "atrasoDias": 0}
    dias_parte = _dias_desde(dados.get("parteMaisRecente"), agora)
    if dias_parte is not None and dias_parte < limite:
        return {**base, "estado": "retida", "dias": dias, "atrasoDias": max(0, dias - intervalo)}
    ref = min(dias_parte, dias) if dias_parte is not None else dias
    return {**base, "estado": "atrasado", "dias": dias, "atrasoDias": max(0, ref - intervalo)}


def titulo_issue(limiares, dominio):
    return f"Vigília de frescor: {limiares['dominios'][dominio]['nome']}"


def _data_br(iso):
    t = instante(iso)
    return t.astimezone(BRASILIA).strftime("%d/%m/%Y") if t else "data não informada"


def corpo_issue(limiares, dados, s, agora):
    d = limiares["dominios"][dados["id"]]
    c = limiares["cadencias"][d["cadencia"]]
    n = s["atrasoDias"]
    dias = lambda k: f"{k} dia" if k == 1 else f"{k} dias"
    resumo = {
        "atrasado": f"**Atualização atrasada há {dias(n)}** (cadência {c['rotulo']}, limiar de {c['limite']} dias).",
        "retida": f"**Publicação retida em parte há {dias(n)}**: a parte mais recente saiu em {_data_br(dados['parteMaisRecente'])}, "
                  f"mas há parte sem atualização desde {_data_br(dados['publicadoEm'])} (limiar de {c['limite']} dias).",
        "sem-data": "**Sem data de publicação legível**: nenhum dos campos declarados em limiares.json trouxe data. "
                    "A faixa da entrada mostra \"data não informada\" e não avalia a situação.",
    }[s["estado"]]
    origens = "\n".join(f"- `{o['arquivo']}` → `{o['campo']}`" for o in d["publicacao"] + d.get("partes", []))
    return (
        f"{resumo}\n\n"
        f"- Domínio: {d['nome']} ({d['rotulo']})\n"
        f"- Última atualização (a mais antiga declarada): {_data_br(dados['publicadoEm'])}\n"
        f"- Referência mais recente dos números principais: {dados['referencia'] or 'não informada'} ({d['referenciaRotulo']})\n"
        f"- Avaliado em {agora.astimezone(BRASILIA).strftime('%d/%m/%Y %H:%M')} (Brasília)\n\n"
        f"{d['nota']}\n\n"
        "A faixa de frescor da entrada já mostra este estado ao leitor. Datas lidas de:\n"
        f"{origens}\n\n"
        "Causas mais prováveis: publicação retida pelos testes (ver a issue de retenção do domínio, quando houver), "
        "execução do pipeline interrompida, coleta manual pendente ou campo de data renomeado. "
        "Limiares e campos: `src/lib/frescor/limiares.json`."
    )


def _gh(args):
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout


def issue_aberta(titulo, repo, gh=_gh):
    """Número da issue ABERTA com exatamente este título, ou None. A busca do gh é aproximada; o filtro é exato."""
    saida = gh(["issue", "list", "--repo", repo, "--state", "open", "--search", f'"{titulo}" in:title',
                "--json", "number,title", "--limit", "50"])
    for i in json.loads(saida or "[]"):
        if i.get("title") == titulo:
            return i["number"]
    return None


def vigiar(limiares, ler, agora, repo, responsavel=None, gh=_gh):
    """Avalia todos os domínios e abre, comenta ou fecha a issue de cada um. Devolve o relatório."""
    linhas = []
    for dominio in limiares["dominios"]:
        dados = extrair(limiares, dominio, ler)
        s = situacao(limiares, dados, agora)
        titulo = titulo_issue(limiares, dominio)
        numero = issue_aberta(titulo, repo, gh)
        if s["estado"] == "em-dia":
            if numero is not None:
                gh(["issue", "comment", str(numero), "--repo", repo, "--body",
                    f"Voltou a ficar em dia: última atualização em {_data_br(dados['publicadoEm'])}. Issue fechada pela vigília."])
                gh(["issue", "close", str(numero), "--repo", repo, "--reason", "completed"])
                linhas.append(f"{dominio}: em dia; issue #{numero} fechada")
            else:
                linhas.append(f"{dominio}: em dia")
            continue
        corpo = corpo_issue(limiares, dados, s, agora)
        if numero is not None:
            gh(["issue", "comment", str(numero), "--repo", repo, "--body", corpo])
            linhas.append(f"{dominio}: {s['estado']}; comentário na issue #{numero}")
        else:
            args = ["issue", "create", "--repo", repo, "--title", titulo, "--body", corpo]
            if responsavel:
                args += ["--assignee", responsavel]
            gh(args)
            linhas.append(f"{dominio}: {s['estado']}; issue aberta")
    return linhas


def ler_do_checkout(arquivo):
    return json.loads((RAIZ / arquivo).read_text(encoding="utf-8"))


def relatorio(limiares, ler, agora):
    saida = []
    for dominio in limiares["dominios"]:
        dados = extrair(limiares, dominio, ler)
        s = situacao(limiares, dados, agora)
        saida.append(f"{dominio}: {s['estado']} (atualizado em {_data_br(dados['publicadoEm'])}, "
                     f"referência {dados['referencia'] or 'não informada'}, atraso {s['atrasoDias']})")
    return saida


def main(argv=None):
    import os
    argv = sys.argv[1:] if argv is None else argv
    limiares = carregar_limiares()
    agora = datetime.now(timezone.utc)
    if "--relatorio" in argv:
        print("\n".join(relatorio(limiares, ler_do_checkout, agora)))
        return 0
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not repo:
        print("GITHUB_REPOSITORY ausente: use --relatorio para só avaliar.", file=sys.stderr)
        return 2
    print("\n".join(vigiar(limiares, ler_do_checkout, agora, repo, os.environ.get("GITHUB_REPOSITORY_OWNER"))))
    return 0


if __name__ == "__main__":
    sys.exit(main())
