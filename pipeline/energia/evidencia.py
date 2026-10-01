"""Evidência "Comprove este número" (seção 11.5 da especificação).

Por que este módulo existe: a proveniência da gold (`Proveniencia`, drawer "Sobre
este dado") descreve uma SÉRIE; a evidência comprova UM número exibido (um KPI, uma
célula, um agregado de gráfico): o valor antes do arredondamento, o arquivo exato e
o seu sha256, as chaves das observações de origem, a fórmula com numerador e
denominador, os testes e a reconciliação, e como refazer a conta. Os módulos vinham
montando esse dicionário cada um a seu modo (período como texto ou dicionário,
chaves como texto ou lista, tolerância sem unidade, resultado "falhou",
"divergente" ou "executado"), e a interface não tinha como exibir tudo do mesmo
jeito. Este construtor fixa o contrato espelhado em src/lib/energia/evidencia.ts
(tipo `Evidencia`) e recusa, na geração da gold, a evidência que não comprova:

* número sem arquivo capturado com sha256 e instante de captura com fuso;
* ausência exibida como número (valor de cálculo nulo com algarismo no texto);
* número exibido sem nenhum teste, sem download ou sem chaves/consulta de origem;
* teste ou reconciliação com resultado fora de aprovado, ressalva, reprovado;
* reconciliação com tolerância sem unidade (número solto);
* numerador sem denominador (ou o contrário);
* PDF sem documento, edição, página e conferência da extração;
* milhares de chaves despejadas na interface sem manifesto para baixar.

A data de publicação pela fonte nunca é preenchida aqui: vem da vintage ou fica
None ("não inventar timestamp", seção 11.4). A citação gerada não tem data de
acesso, que é do leitor: a interface acrescenta "Acesso em" no momento da leitura.

Uso típico no builder de um módulo:

    from pipeline.energia import evidencia as ev
    v = base.ultima_vintage(con, DATASET, RECURSO)
    ficha = ev.construir(
        indicador="Tarifa residencial mediana", valor_exibido="R$ 0,8123/kWh",
        valor_calculo=812.3456, unidade="R$/MWh",
        periodo={"inicio": "2026-09-30", "fim": "2026-09-30"},
        entidade="distribuidoras com tarifa B1 vigente", universo="105 distribuidoras",
        fonte=ev.fonte_de_vintage("ANEEL", "Tarifas de aplicação", URL, v),
        chaves_origem=[...], formula="mediana de TE + TUSD", cobertura="105 de 108",
        tratamento_ausencia="distribuidora sem vigência fica fora",
        testes=[ev.teste("TE e TUSD somam o total", "aprovado", "105 de 105")],
        download=[{"rotulo": "Tarifas vigentes (CSV)", "url": "/energia/series/x.csv"}],
        reproducao="python3 pipeline/energia/executar_modulo.py conta --sem-coleta")
"""
import json
import math
import os
import re
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pipeline.energia import base  # noqa: E402

RESULTADOS = ("aprovado", "ressalva", "reprovado")
# Acima disto a lista de chaves não cabe na interface: publica-se a consulta e o
# manifesto completo para download, e a evidência guarda só as primeiras chaves.
LIMITE_CHAVES = 50
SITE = "https://scrutiniums.com/setor-eletrico"
AUSENTE = "sem dado"

# Ordem fixa das chaves do objeto publicado (a mesma do tipo TypeScript).
CAMPOS = (
    "indicador", "valor_exibido", "valor_calculo", "unidade", "periodo", "entidade", "universo", "filtros",
    "fonte", "extracao_pdf", "chaves_origem", "chaves_total", "consulta", "manifesto", "formula", "numerador",
    "denominador", "pesos", "exclusoes", "cobertura", "tratamento_ausencia", "versao", "revisoes", "testes",
    "reconciliacao", "download", "reproducao", "citacao",
)

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_ALGARISMO = re.compile(r"\d")
_PDF = re.compile(r"\.pdf(\.gz)?$", re.IGNORECASE)
_SO_NUMERO = re.compile(r"^[\u2212+\-]?[\d.,]+$")


class EvidenciaInvalida(ValueError):
    """Evidência que não comprova o número: a mensagem lista todos os problemas."""

    def __init__(self, problemas):
        self.problemas = list(problemas)
        super().__init__("evidência inválida: " + "; ".join(self.problemas))


# ---------------------------------------------------------------- auxiliares de montagem

def fonte_de_vintage(orgao, conjunto, url, vintage):
    """Bloco `fonte` a partir de uma vintage do silver (base.ultima_vintage). Sem vintage,
    os campos do arquivo ficam None: a validação então só aceita número ausente."""
    v = vintage or {}
    return {
        "orgao": orgao, "conjunto": conjunto, "recurso": v.get("recurso"), "url": v.get("url") or url,
        "arquivo": v.get("arquivo"), "sha256": v.get("sha256"), "capturado_em": v.get("capturado_em"),
        "publicado_em": v.get("publicado_em"),
    }


def arquivo_de_vintage(vintage):
    """Item de `fonte.arquivos` (número que usa mais de um arquivo, como anos diferentes)."""
    return {"recurso": vintage.get("recurso"), "arquivo": vintage.get("arquivo"), "sha256": vintage.get("sha256"),
            "capturado_em": vintage.get("capturado_em"), "publicado_em": vintage.get("publicado_em")}


def teste(nome, resultado, detalhe):
    """Um controle executado sobre o número, com veredito explícito."""
    return {"nome": nome, "resultado": resultado, "detalhe": detalhe}


def reconciliacao(descricao, resultado, tolerancia):
    """Conferência por outro caminho ou outro produto. `tolerancia` é texto com unidade
    ("0,005 R$/MWh", "1 kWh por linha"): tolerância universal sem unidade não serve."""
    return {"descricao": descricao, "resultado": resultado, "tolerancia": tolerancia}


def _milhar(n):
    return f"{n:,}".replace(",", ".")


def texto_revisoes(revisoes):
    """Texto de revisões a partir do que os módulos já calculam: None (detecção não se
    aplica), inteiro (observações revisadas), o bloco `revisoes_conhecidas` da
    proveniência ou texto pronto."""
    if revisoes is None:
        return "Detecção de revisões não disponível para este número."
    if isinstance(revisoes, str):
        return revisoes
    if isinstance(revisoes, bool):
        raise TypeError("revisões não podem ser booleanas")
    if isinstance(revisoes, int):
        if revisoes == 0:
            return "Nenhuma revisão detectada entre as capturas integradas."
        return f"{_milhar(revisoes)} {'observação revisada' if revisoes == 1 else 'observações revisadas'} pela fonte entre as capturas integradas."
    if isinstance(revisoes, dict) and "total" in revisoes:
        total = revisoes.get("total") or 0
        quando = revisoes.get("detectado_em")
        sufixo = f" Verificação em {quando[:10]}." if isinstance(quando, str) and quando else ""
        if total == 0:
            return "Nenhuma revisão detectada entre as capturas integradas." + sufixo
        exemplos = [f"{e.get('serie')} em {e.get('ref')}" for e in (revisoes.get("exemplos") or [])[:5]]
        lista = f" Mais recentes: {'; '.join(exemplos)}." if exemplos else ""
        return f"{_milhar(total)} {'observação revisada' if total == 1 else 'observações revisadas'} pela fonte entre as capturas integradas.{lista}{sufixo}"
    raise TypeError(f"formato de revisões não reconhecido: {type(revisoes).__name__}")


def _data_br(iso, hora=False):
    """'AAAA', 'AAAA-MM', 'AAAA-MM-DD' ou 'AAAA-MM-DDTHH:MM' → texto brasileiro, sem
    conversão de fuso (datas de referência são locais). `hora` mantém a hora local."""
    if not isinstance(iso, str) or not iso:
        return None
    partes = iso[:10].split("-")
    if len(partes) == 1:
        return partes[0]
    if len(partes) == 2:
        return f"{partes[1]}/{partes[0]}"
    a, m, d = partes
    txt = f"{d}/{m}/{a}"
    if hora and len(iso) >= 16 and iso[10] == "T" and not iso.endswith("Z"):
        txt += f" {iso[11:16]}"
    return txt


def _dia_brasilia(instante):
    """Dia (AAAA-MM-DD) de um carimbo UTC no horário de Brasília (UTC−3 fixo desde 2019,
    sem horário de verão), o mesmo dia que a interface exibe. Data sem hora passa igual."""
    if not isinstance(instante, str) or not instante:
        return None
    if len(instante) <= 10:
        return instante
    try:
        utc = datetime.fromisoformat(base.instante_utc(instante).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return instante[:10]
    return (utc - timedelta(hours=3)).date().isoformat()


def texto_periodo(periodo):
    """Mesma regra de textoPeriodo() no TypeScript: um só instante quando início e fim
    coincidem; hora local mantida quando o período é horário."""
    ini, fim = _data_br(periodo.get("inicio"), True), _data_br(periodo.get("fim"), True)
    if not ini and not fim:
        return "período não informado"
    if ini == fim or not fim:
        return ini
    if not ini:
        return f"até {fim}"
    return f"{ini} a {fim}"


def citacao(*, indicador, valor_exibido, unidade, entidade, periodo, fonte, versao, endereco=SITE):
    """Referência no formato ABNT simplificado, sem a data de acesso (acrescentada pela
    interface no momento da leitura). Mesma ordem de citacaoAcademica() no TypeScript."""
    pub = _dia_brasilia(versao.get("publicacao"))
    ano = pub[:4] if pub else "s.d."
    cap = _data_br(_dia_brasilia(fonte.get("capturado_em")))
    recurso = f"recurso {fonte['recurso']}" if fonte.get("recurso") else "recurso não identificado"
    captura = f", capturado em {cap}" if cap else ""
    codigo = f"código {versao['codigo']}" if versao.get("codigo") else "código não registrado"
    # a unidade entra só quando o texto exibido é um número puro ("123,46"); texto que já
    # traz unidade própria ("R$ 0,8123/kWh", "12,3%") fica como está na tela
    valor = f"{valor_exibido} {unidade}" if _SO_NUMERO.match(valor_exibido) and unidade else valor_exibido
    return (f"SCRUTINIUMS. {indicador}: {valor}, {entidade}, {texto_periodo(periodo)}. "
            f"Observatório Brasileiro do Setor Elétrico, {ano}. "
            f"Dados primários: {fonte.get('orgao')}, {fonte.get('conjunto')} ({recurso}{captura}). "
            f"Versão {versao.get('pipeline')}, {codigo}, publicada em {_data_br(pub) or 'data não registrada'}. "
            f"Disponível em: {endereco}.")


_VERSAO_CODIGO = []


def _versao_padrao():
    # versao_codigo() chama o git: uma vez por processo basta
    if not _VERSAO_CODIGO:
        _VERSAO_CODIGO.append(base.versao_codigo())
    return {"pipeline": base.VERSAO_PIPELINE, "codigo": _VERSAO_CODIGO[0], "publicacao": base.agora_utc()}


# ---------------------------------------------------------------- validação

def _texto(v):
    return isinstance(v, str) and v.strip() != ""


def _numero_ou_none(v):
    return v is None or (isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v))


def _instante_valido(v):
    try:
        base.instante_utc(v)
        return True
    except (ValueError, TypeError):
        return False


def _arquivo_pdf(fonte):
    nomes = [fonte.get("arquivo"), fonte.get("recurso"), fonte.get("url")]
    nomes += [a.get("arquivo") or a.get("recurso") for a in fonte.get("arquivos") or [] if isinstance(a, dict)]
    return any(isinstance(n, str) and _PDF.search(n.split("?")[0]) for n in nomes)


def _valida_arquivo(rotulo, a, exige, problemas):
    sha = a.get("sha256")
    if sha is not None and not (isinstance(sha, str) and _SHA256.match(sha)):
        problemas.append(f"{rotulo}.sha256 não é um sha256 hexadecimal minúsculo de 64 caracteres")
    cap = a.get("capturado_em")
    if cap is not None and not _instante_valido(cap):
        problemas.append(f"{rotulo}.capturado_em precisa de hora e fuso (ex.: 2026-09-30T10:00:00Z)")
    pub = a.get("publicado_em")
    if pub is not None and not _texto(pub):
        problemas.append(f"{rotulo}.publicado_em deve ser texto ou None (nunca inventado)")
    if exige:
        for campo in ("sha256", "capturado_em"):
            if a.get(campo) is None:
                problemas.append(f"número exibido sem {rotulo}.{campo}: hash e captura provam qual arquivo foi usado")
        if not _texto(a.get("arquivo")) and not _texto(a.get("recurso")):
            problemas.append(f"número exibido sem {rotulo}.arquivo nem {rotulo}.recurso")


def _valida_razao(nome, x, problemas):
    if x is None:
        return
    if not isinstance(x, dict) or not _texto(x.get("descricao")) or not _numero_ou_none(x.get("valor")):
        problemas.append(f"{nome} precisa de descricao (texto) e valor (número finito ou None)")


def _valida_veredito(rotulo, resultado, problemas):
    if resultado not in RESULTADOS:
        problemas.append(f"{rotulo}.resultado {resultado!r} fora de {', '.join(RESULTADOS)}")


def validar(ev):
    """Lista de problemas (vazia quando a evidência comprova o número)."""
    p = []
    if not isinstance(ev, dict):
        return ["evidência precisa ser um dicionário"]
    faltam = [c for c in CAMPOS if c not in ev]
    if faltam:
        p.append("campos ausentes: " + ", ".join(faltam))
    for campo in ("indicador", "valor_exibido", "unidade", "entidade", "universo", "formula", "cobertura",
                  "tratamento_ausencia", "revisoes", "reproducao", "citacao"):
        if campo in ev and not _texto(ev.get(campo)):
            p.append(f"{campo} obrigatório (texto não vazio)")

    valor = ev.get("valor_calculo")
    presente = valor is not None
    if not _numero_ou_none(valor):
        p.append("valor_calculo precisa ser número finito ou None (NaN e infinito não são valor)")
        presente = False
    exibido = ev.get("valor_exibido")
    if isinstance(exibido, str):
        if valor is None and _ALGARISMO.search(exibido):
            p.append("valor_calculo ausente mas valor_exibido tem algarismo: ausência nunca vira número")
        if presente and not _ALGARISMO.search(exibido):
            p.append("valor_calculo presente mas valor_exibido sem algarismo")

    per = ev.get("periodo")
    if not isinstance(per, dict) or not _texto(per.get("inicio")) or not _texto(per.get("fim")):
        p.append("periodo precisa de inicio e fim (texto ISO)")
    elif len(per["inicio"]) == len(per["fim"]) and per["inicio"] > per["fim"]:
        p.append("periodo com inicio depois do fim")

    for campo in ("filtros", "exclusoes", "chaves_origem"):
        v = ev.get(campo)
        if campo in ev and (not isinstance(v, list) or not all(_texto(x) for x in v)):
            p.append(f"{campo} precisa ser lista de textos")

    fonte = ev.get("fonte")
    if not isinstance(fonte, dict):
        p.append("fonte obrigatória")
        fonte = {}
    else:
        for campo in ("orgao", "conjunto", "url"):
            if not _texto(fonte.get(campo)):
                p.append(f"fonte.{campo} obrigatório")
        arquivos = fonte.get("arquivos")
        if arquivos is not None:
            if not isinstance(arquivos, list) or not arquivos or not all(isinstance(a, dict) for a in arquivos):
                p.append("fonte.arquivos, quando informado, é lista não vazia de arquivos")
            else:
                for i, a in enumerate(arquivos):
                    _valida_arquivo(f"fonte.arquivos[{i}]", a, presente, p)
        _valida_arquivo("fonte", fonte, presente and not arquivos, p)

    if _arquivo_pdf(fonte):
        x = ev.get("extracao_pdf")
        if not isinstance(x, dict) or not all(_texto(x.get(c)) for c in ("documento", "edicao", "pagina", "conferencia")):
            p.append("número extraído de PDF exige extracao_pdf com documento, edicao, pagina e conferencia")

    chaves = ev.get("chaves_origem") if isinstance(ev.get("chaves_origem"), list) else []
    if len(chaves) > LIMITE_CHAVES:
        p.append(f"mais de {LIMITE_CHAVES} chaves na evidência: publique consulta e manifesto")
    total = ev.get("chaves_total")
    if total is not None:
        if not isinstance(total, int) or isinstance(total, bool) or total < len(chaves):
            p.append("chaves_total menor que o número de chaves listadas")
        elif total > len(chaves) and not isinstance(ev.get("manifesto"), dict):
            p.append("lista de chaves truncada exige manifesto com a lista completa")
    consulta = ev.get("consulta")
    if consulta is not None and not _texto(consulta):
        p.append("consulta, quando informada, é texto não vazio")
    man = ev.get("manifesto")
    if man is not None and (not isinstance(man, dict) or not _texto(man.get("rotulo")) or not _texto(man.get("url"))):
        p.append("manifesto precisa de rotulo e url")
    if presente and not chaves and not _texto(consulta):
        p.append("número exibido sem chaves_origem nem consulta que as selecione")

    num, den = ev.get("numerador"), ev.get("denominador")
    _valida_razao("numerador", num, p)
    _valida_razao("denominador", den, p)
    if (num is None) != (den is None):
        p.append("numerador e denominador andam juntos: uma razão sem o outro termo não se refaz")
    if ev.get("pesos") is not None and not _texto(ev.get("pesos")):
        p.append("pesos, quando informado, é texto não vazio")

    versao = ev.get("versao")
    if not isinstance(versao, dict) or not _texto(versao.get("pipeline")) or not _texto(versao.get("publicacao")):
        p.append("versao precisa de pipeline e publicacao")
    elif versao.get("codigo") is not None and not _texto(versao.get("codigo")):
        p.append("versao.codigo é texto ou None")

    testes = ev.get("testes")
    if not isinstance(testes, list):
        p.append("testes precisa ser lista")
        testes = []
    for i, t in enumerate(testes):
        if not isinstance(t, dict) or not _texto(t.get("nome")) or not isinstance(t.get("detalhe"), str):
            p.append(f"testes[{i}] precisa de nome e detalhe")
            continue
        _valida_veredito(f"testes[{i}]", t.get("resultado"), p)
    if presente and not testes:
        p.append("número exibido sem nenhum teste executado")

    rec = ev.get("reconciliacao")
    if rec is not None:
        if not isinstance(rec, dict) or not _texto(rec.get("descricao")):
            p.append("reconciliacao precisa de descricao")
        else:
            _valida_veredito("reconciliacao", rec.get("resultado"), p)
            if not _texto(rec.get("tolerancia")):
                p.append("reconciliacao.tolerancia é texto com unidade (ex.: '0,005 R$/MWh'), não número solto")

    downloads = ev.get("download")
    if not isinstance(downloads, list) or not all(isinstance(d, dict) and _texto(d.get("rotulo")) and _texto(d.get("url")) for d in downloads):
        p.append("download precisa ser lista de {rotulo, url}")
    elif presente and not downloads:
        p.append("número exibido sem download dos dados")

    try:
        json.dumps(ev, allow_nan=False, ensure_ascii=False)
    except (TypeError, ValueError) as e:
        p.append(f"evidência não serializável em JSON estrito: {e}")
    return p


# ---------------------------------------------------------------- construtor

def construir(*, indicador, valor_exibido, valor_calculo, unidade, periodo, entidade, universo, fonte,
              formula, cobertura, tratamento_ausencia, reproducao, chaves_origem=(), consulta=None,
              manifesto=None, filtros=(), numerador=None, denominador=None, pesos=None, exclusoes=(),
              revisoes=None, testes=(), reconciliacao=None, download=(), extracao_pdf=None, versao=None,
              citacao_texto=None, endereco=SITE):
    """Monta e valida a evidência de um número. Levanta EvidenciaInvalida com todos os
    problemas de uma vez (o autor do módulo corrige tudo numa rodada).

    `valor_exibido` None vira "sem dado"; `revisoes` aceita None, inteiro, o bloco
    `revisoes_conhecidas` ou texto; mais de LIMITE_CHAVES chaves exigem `manifesto`
    e são truncadas, com `chaves_total` guardando a contagem real."""
    chaves = [str(c) for c in chaves_origem]
    total = None
    if len(chaves) > LIMITE_CHAVES and manifesto is not None:
        total = len(chaves)
        chaves = chaves[:LIMITE_CHAVES]
    versao = dict(versao) if versao else _versao_padrao()
    exibido = AUSENTE if valor_exibido is None else valor_exibido
    per = dict(periodo) if isinstance(periodo, dict) else periodo
    try:
        rev = texto_revisoes(revisoes)
    except TypeError as e:
        raise EvidenciaInvalida([str(e)]) from e
    ev = {
        "indicador": indicador,
        "valor_exibido": exibido,
        "valor_calculo": valor_calculo,
        "unidade": unidade,
        "periodo": per,
        "entidade": entidade,
        "universo": universo,
        "filtros": list(filtros),
        "fonte": dict(fonte) if isinstance(fonte, dict) else fonte,
        "extracao_pdf": extracao_pdf,
        "chaves_origem": chaves,
        "chaves_total": total,
        "consulta": consulta,
        "manifesto": manifesto,
        "formula": formula,
        "numerador": numerador,
        "denominador": denominador,
        "pesos": pesos,
        "exclusoes": list(exclusoes),
        "cobertura": cobertura,
        "tratamento_ausencia": tratamento_ausencia,
        "versao": versao,
        "revisoes": rev,
        "testes": list(testes),
        "reconciliacao": reconciliacao,
        "download": list(download),
        "reproducao": reproducao,
        "citacao": "",
    }
    if citacao_texto:
        ev["citacao"] = citacao_texto
    elif isinstance(per, dict) and isinstance(ev["fonte"], dict) and isinstance(versao, dict):
        ev["citacao"] = citacao(indicador=indicador, valor_exibido=exibido, unidade=unidade, entidade=entidade,
                                periodo=per, fonte=ev["fonte"], versao=versao, endereco=endereco)
    problemas = validar(ev)
    if problemas:
        raise EvidenciaInvalida(problemas)
    return ev
