"""Dash data engine: tratamento, tipagem e análise de bases com pandas.

Roda no navegador via Pyodide (components/py-worker.js), então os dados nunca
saem do computador da pessoa (CLAUDE.md §8). Também roda em CPython comum, que
é como os testes em engine/tests/ o exercitam.

Entrada (JSON): {"kind": "matrix", "matrix": [[...], ...]} com a planilha crua
(cabeçalho incluso, onde quer que esteja) ou {"kind": "json", "text": "..."}.
Saída (JSON): cabeçalho limpo, schema e perfis no formato que o front já usa,
colunas tipadas, relatório de qualidade e insights calculados sem IA.

Princípio: o tipo de cada coluna é decidido pelos valores da coluna INTEIRA
(separador decimal, ordem de dia/mês), nunca célula a célula. O nome da coluna
só desempata ou ajusta a semântica (soma faz sentido? é preço unitário?).
"""

import json
import math
import re
import unicodedata

import numpy as np
import pandas as pd

ENGINE_VERSION = "1.0.0"

# Tokens que significam "sem valor" em exports de Excel/ERP/sistemas.
NULL_TOKENS = {
    "", "-", "--", "---", "—", "–", ".", "?", "n/a", "na", "n.a.", "nan", "null",
    "none", "nil", "#n/d", "#n/a", "#na", "#value!", "#valor!", "#div/0!", "#ref!",
    "#name?", "#nome?", "#num!", "#null!", "s/d", "s/i", "sem dado", "sem dados",
    "não informado", "nao informado", "undefined",
}

MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
DIAS_SEMANA = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]
MONTH_TOKENS = {
    "jan": 1, "fev": 2, "feb": 2, "mar": 3, "abr": 4, "apr": 4, "mai": 5, "may": 5,
    "jun": 6, "jul": 7, "ago": 8, "aug": 8, "set": 9, "sep": 9, "out": 10, "oct": 10,
    "nov": 11, "dez": 12, "dec": 12,
}

BOOL_TOKENS = {"sim", "não", "nao", "true", "false", "yes", "no", "y", "n", "1", "0", "t", "f",
               "verdadeiro", "falso", "v", "ativo", "inativo", "pago", "on", "off", "s"}
POS_TOKENS = {"sim", "true", "yes", "y", "1", "verdadeiro", "v", "t", "ativo", "pago", "on", "s"}

TOTAL_LABEL = re.compile(r"^\s*(sub\s*-?\s*total|total(\s+geral)?|totais|soma(\s+geral)?|grand\s+total|sum)\b", re.I)
# Rótulo que é SÓ "total" (sem nome de produto/cliente junto): "TOTAL", "Total geral:".
TOTAL_WHOLE = re.compile(r"^\s*(sub\s*-?\s*total|total(\s+geral)?|totais|soma(\s+geral)?|grand\s+total|sum|total\s+do\s+(m[eê]s|dia|per[ií]odo|ano))\s*:?\s*$", re.I)
# Id "forte" no nome: com valores inteiros vira identificador mesmo repetindo
# (ID Cliente, Código do Produto em tabela de vendas). Plural ("pedidos") é contagem.
STRONG_ID_NAME = re.compile(r"(^|[_\s.])id($|[_\s.])|^id_|_id$|\bc[oó]d(igo)?\b|\bsku\b|matr[ií]cula|\bcpf\b|\bcnpj\b|\bcep\b|protocolo|\bpedido\b|nota\s+fiscal|^nf$", re.I)
METRIC_NAME = re.compile(r"impress|clique|click|visit|sess[aãoõ]|alcance|seguidor|view|total|valor|receita|venda|fatur", re.I)
ID_NAME = re.compile(r"(^|[_\s])id($|[_\s])|c[oó]d|sku|cpf|cnpj|matr[ií]c|^numero|num_|_num|pedido|nota|protocolo|cep|telefone|celular|fone|^n[ºo°]\s|^#$", re.I)
ORDER_NAME = re.compile(r"(pedido|order|num_venda|venda_id|cod_venda|numero_pedido|nota_fiscal|^nf$|^id$|order_id)", re.I)
QTY_NAME = re.compile(r"(qtd|qtde|qty|quantidade|unidades|volume|count|^num$|^qt$|^n$|itens)", re.I)
SALARY_NAME = re.compile(r"sal[aá]ri|remunera|folha|proventos|vencimento", re.I)
MONEY_NAME = re.compile(r"receita|fatur|custo|preç|preco|montante|gmv|revenue|price|amount|sal[aá]rio|ticket|valor|venda|despesa|gasto|pagamento|lucro|margem|r\$", re.I)
# Medidas em que SOMAR não tem significado (idade somada, preço unitário somado…).
NON_ADDITIVE_NAME = re.compile(
    r"(^|[\s_])idade($|[\s_])|^age$|_age|preç|preco|price|unit[aá]ri|por_unidade|taxa|(^|[\s_])rate|percent|pct|%|m[eé]dia|avg|mean|"
    r"(^|[\s_])nota($|[\s_])|score|rating|avalia|temperatura|^temp|latitude|longitude|^lat$|^lon$|^lng$|ticket|margem|margin|"
    r"[ií]ndice|ratio|raz[aã]o|nps|satisf|estrela|^ano$|year|altura|peso_m[eé]dio|cota[cç][aã]o|c[aâ]mbio|saldo|estoque_atual",
    re.I,
)
# Termos que, sozinhos, já dizem "não some" (média, unitário, taxa…).
_ALWAYS_NON_ADDITIVE = re.compile(r"m[eé]dia|avg|mean|unit[aá]ri|por_unidade|taxa|(^|[\s_])rate|percent|pct|%", re.I)
_TOTAL_WORD = re.compile(r"\b(valor|total|receita|faturamento|montante|soma)\b", re.I)


def _non_additive(lname):
    """Medida em que somar não faz sentido? Quantidade é sempre aditiva, e
    "Valor da Nota"/"Preço Total" também (o nome diz que é um total)."""
    n = _strip_accents(lname)
    if _ALWAYS_NON_ADDITIVE.search(n):
        return True
    if QTY_NAME.search(n) or _TOTAL_WORD.search(n):
        return False
    return bool(NON_ADDITIVE_NAME.search(n))


VALUE_TERMS = ["receita", "faturamento", "revenue", "gmv", "montante", "vendas", "venda", "valor", "total", "sales", "amount"]
SALES_DIM = re.compile(r"produto|product|sku|item|canal|channel|cliente|customer|vendedor|seller|loja|store|marketplace|pedido|order", re.I)
SALES_VALUE = re.compile(r"receita|fatur|venda|revenue|gmv|sales|ticket", re.I)
REGION_NAME = re.compile(r"regi|estado|^uf$|uf_|cidade|munic|state|local|pa[ií]s|bairro", re.I)
PRODUCT_NAME = re.compile(r"produt|item|sku|servi[cç]|modelo|curso|categoria|product", re.I)
CHANNEL_NAME = re.compile(r"canal|channel|origem|fonte|source|m[ií]dia|plataforma", re.I)

MAX_UNIQUE_CATEGORY = 100

# Dados pessoais (LGPD): colunas cujos valores parecem e-mail, CPF, CNPJ ou
# telefone nunca entram em insights nem nos fatos que vão para a IA.
PII_VALUE = re.compile(
    r"[^@\s]+@[^@\s]+\.[a-z]{2,}"                       # e-mail
    r"|\d{3}\.?\d{3}\.?\d{3}-?\d{2}"                    # CPF
    r"|\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}"             # CNPJ
    r"|(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}",          # telefone BR
    re.I,
)
# Para mascarar trechos dentro de um texto (insight, fato, rótulo de gráfico).
PII_SEARCH = re.compile(
    r"[\w.+-]+@[\w-]+(\.[\w-]+)+"
    r"|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b"
    r"|\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b"
    r"|(\+?55\s?)?\(?\b\d{2}\)?\s?9?\d{4}-\d{4}\b",
    re.I,
)
PII_NAME = re.compile(r"e-?mail|cpf|cnpj|telefone|celular|whats|fone|rg$|^rg_|documento", re.I)
# Métricas em que SUBIR é ruim (custo, devolução…): cores e textos se invertem.
INVERSE_NAME = re.compile(r"custo|despesa|gasto|devolu|cancel|atraso|churn|reclama|multa|juros|inadimpl|perda|estorno|defeito", re.I)
FLAG_NAME = re.compile(r"flag|ativo|pago|^is_|cancel|churn|aprovad|convert", re.I)


# ─────────────────────────── utilidades ───────────────────────────

def _clean_text(v):
    """Célula crua → texto aparado ou None (tokens nulos viram None)."""
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    s = str(v)
    s = s.replace("﻿", "").replace("​", "").replace(" ", " ")
    s = _RE_WS.sub(" ", s).strip()
    if s.lower() in NULL_TOKENS:
        return None
    return s


def _clean_matrix(matrix):
    """Limpa a matriz coluna a coluna sobre os valores únicos e tira linhas vazias."""
    if not matrix:
        return []
    width = max(len(r or []) for r in matrix)
    raw = pd.DataFrame([list(r or []) + [None] * (width - len(r or [])) for r in matrix], dtype=object)
    for c in raw.columns:
        codes, uniq = pd.factorize(raw[c], use_na_sentinel=True)
        cleaned = np.array([_clean_text(u) for u in uniq] + [None], dtype=object)
        raw[c] = cleaned[codes]
    rows = raw.to_numpy(dtype=object).tolist()
    return [r for r in rows if any(x is not None for x in r)]


def _finite(x):
    """Número → float JSON-seguro (NaN/inf viram None)."""
    if x is None:
        return None
    try:
        f = float(x)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def _r(x, nd=2):
    f = _finite(x)
    return None if f is None else round(f, nd)


def _fmt_num(v, decimals=0):
    """Formata no padrão pt-BR (1.234,5)."""
    if v is None:
        return "—"
    s = f"{v:,.{decimals}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_compact(v, money=False):
    if v is None:
        return "—"
    a = abs(v)
    pre = "R$ " if money else ""
    if a >= 1e9:
        return pre + _fmt_num(v / 1e9, 1) + " bi"
    if a >= 1e6:
        return pre + _fmt_num(v / 1e6, 1) + " mi"
    if a >= 1e3:
        return pre + _fmt_num(v / 1e3, 1) + " mil"
    if money:
        return pre + _fmt_num(v, 2)
    return _fmt_num(v, 0 if float(v).is_integer() else 1)


def _fmt_pct(p, decimals=0):
    return _fmt_num(p, decimals) + "%"


def _short(label, n=28):
    s = str(label)
    return s if len(s) <= n else s[: n - 1] + "…"


def _strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


# ─────────────────────────── leitura / estrutura ───────────────────────────

def _matrix_from_json(text):
    """JSON/NDJSON → matriz, achatando objetos aninhados com json_normalize
    (endereco.uf vira a coluna "endereco.uf" em vez de um texto JSON)."""
    text = (text or "").strip()
    records = None
    try:
        data = json.loads(text)
        if isinstance(data, list):
            records = data
        elif isinstance(data, dict):
            for key in ("data", "rows", "records", "items", "results", "dados"):
                if isinstance(data.get(key), list):
                    records = data[key]
                    break
    except json.JSONDecodeError:
        # NDJSON (um objeto por linha), mesmo vindo num arquivo .json.
        records = []
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                raise ValueError("o arquivo não é um JSON válido nem um objeto por linha (NDJSON).")
    if not records:
        raise ValueError("o JSON precisa ser uma lista de objetos (ou {\"data\": [...]}).")
    records = [r for r in records if isinstance(r, dict)]
    if not records:
        raise ValueError("o JSON não tem objetos com campos reconhecíveis.")

    # Inteiros acima de 2^53 (ids, chaves de NF-e) perderiam dígitos ao virar
    # float64 numa coluna com nulos: viram texto antes do json_normalize.
    def keep_big(v):
        if isinstance(v, bool):
            return v
        if isinstance(v, int) and abs(v) > 2 ** 53:
            return str(v)
        if isinstance(v, dict):
            return {k: keep_big(x) for k, x in v.items()}
        if isinstance(v, list):
            return [keep_big(x) for x in v]
        return v

    records = [keep_big(r) for r in records]
    df = pd.json_normalize(records, max_level=3)
    # Coluna de inteiros com nulo vira float64 ("101.0"): volta a ser inteiro.
    for c in df.columns:
        col = df[c]
        if pd.api.types.is_float_dtype(col) and col.notna().any():
            vals = col.dropna()
            if np.all(np.mod(vals, 1) == 0) and vals.abs().max() < 2 ** 53:
                df[c] = col.astype("Int64")

    def cell(v):
        if v is None or v is pd.NA:
            return None
        if isinstance(v, float) and math.isnan(v):
            return None
        if isinstance(v, bool):
            return "sim" if v else "não"
        if isinstance(v, (int, np.integer)):
            return str(int(v))
        if isinstance(v, (float, np.floating)):
            return repr(float(v))  # ponto decimal inequívoco; a coluna é marcada como "."
        if isinstance(v, (list, dict)):
            if isinstance(v, list) and all(isinstance(x, (str, int, float)) for x in v):
                return "; ".join(str(x) for x in v)
            return json.dumps(v, ensure_ascii=False)
        return str(v)

    header = [str(c) for c in df.columns]
    rows = [[cell(v) for v in row] for row in df.itertuples(index=False, name=None)]
    native_numeric = {str(c) for c in df.columns if pd.api.types.is_numeric_dtype(df[c]) and not pd.api.types.is_bool_dtype(df[c])}
    return [header] + rows, native_numeric


def _looks_like_value(s):
    return bool(re.fullmatch(r"[-+(]?\s*(r\$|us\$|\$|€)?\s*[\d.,]+\s*%?\)?", s.lower())) or bool(
        re.fullmatch(r"\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}.*", s))


def _detect_header(matrix):
    """Acha a linha do cabeçalho: exports de ERP/Excel costumam ter título,
    data de emissão ou "sep=;" antes. Escolhe, entre as 20 primeiras linhas, a
    primeira com muitas células preenchidas, quase todas texto (não número/data)."""
    rows = matrix[:60]
    filled = [sum(1 for c in r if c is not None) for r in rows]
    if not filled:
        return 0
    data_width = int(np.percentile([f for f in filled if f > 0] or [0], 75))
    need = max(2, math.ceil(data_width * 0.6)) if data_width >= 2 else 1
    for i, r in enumerate(rows[:20]):
        cells = [c for c in r if c is not None]
        if len(cells) < need:
            continue
        texty = sum(1 for c in cells if not _looks_like_value(c))
        if texty / len(cells) >= 0.6:
            return i
    for i, f in enumerate(filled):
        if f > 0:
            return i
    return 0


def _clean_header(raw):
    out, seen = [], {}
    for i, h in enumerate(raw):
        name = (h or "").strip().strip('"').strip()
        if not name:
            name = f"coluna_{i + 1}"
        base, n = name, seen.get(name.lower(), 0)
        if n:
            name = f"{base} ({n + 1})"
            while name.lower() in seen:
                n += 1
                name = f"{base} ({n + 1})"
        seen[base.lower()] = n + 1
        seen.setdefault(name.lower(), 1)
        out.append(name)
    return out


# ─────────────────────────── números ───────────────────────────

_NUM_STRIP = re.compile(r"(r\$|us\$|brl|usd|eur|\$|€|£|¥|%|\s)", re.I)


_RE_SCI = re.compile(r"\d+(\.\d+)?[eE][+-]?\d+")
_RE_NUMCORE = re.compile(r"[\d.,]*\d[\d.,]*")
_RE_TWO_DEC = re.compile(r"[.,]\d{2}$")
_RE_WS = re.compile(r"\s+")


def _number_shape(s):
    """Texto já sem símbolos → (sinal, núcleo) ou None se não for número."""
    neg = False
    if s.startswith("(") and s.endswith(")"):
        neg, s = True, s[1:-1]
    if s.endswith("-") and len(s) > 1:
        neg, s = True, s[:-1]
    if s.startswith(("-", "+")):
        neg, s = s[0] == "-", s[1:]
    if _RE_SCI.fullmatch(s):
        return neg, s, "sci"
    if not s or not _RE_NUMCORE.fullmatch(s):
        return None
    return neg, s, None


def _decimal_vote(core):
    """Voto de separador decimal de UM valor: ',' / '.' / None (ambíguo)."""
    has_dot, has_comma = "." in core, "," in core
    if has_dot and has_comma:
        return "," if core.rfind(",") > core.rfind(".") else "."
    if has_comma:
        parts = core.split(",")
        if len(parts) > 2:
            return "."          # 1,234,567 → vírgula é milhar
        return None if len(parts[1]) == 3 and parts[0] not in ("", "0") else ","
    if has_dot:
        parts = core.split(".")
        if len(parts) > 2:
            return ","          # 1.234.567 → ponto é milhar
        return None if len(parts[1]) == 3 and parts[0] not in ("", "0") else "."
    return None


def _to_float(core, decimal):
    if decimal == ",":
        core = core.replace(".", "").replace(",", ".")
    else:
        core = core.replace(",", "")
    try:
        return float(core)
    except ValueError:
        return None


def _parse_number_series(values, dataset_decimal=None, native_dot=False):
    """Série de textos → (floats, info). O separador decimal é decidido pela
    coluna: votos dos valores inequívocos; se a coluna toda for ambígua
    ("1.500", "2.300"), usa a tendência do arquivo, senão trata como milhar."""
    shapes = []
    votes = {",": 0, ".": 0}
    has_currency = has_percent = False
    for v in values:
        if v is None:
            shapes.append(None)
            continue
        low = v.lower()
        if not has_currency and re.search(r"r\$|us\$|\$|€|£|brl|usd", low):
            has_currency = True
        if not has_percent and "%" in v:
            has_percent = True
        sh = _number_shape(_NUM_STRIP.sub("", v))
        shapes.append(sh)
        if sh and sh[2] is None:
            dv = _decimal_vote(sh[1])
            if dv:
                votes[dv] += 1
    if native_dot:
        decimal, how = ".", "nativo"
    elif votes[","] or votes["."]:
        decimal = "," if votes[","] >= votes["."] else "."
        how = "coluna"
    elif dataset_decimal:
        decimal, how = dataset_decimal, "arquivo"
    else:
        decimal, how = None, "milhar"
    out = []
    for sh in shapes:
        if sh is None:
            out.append(np.nan)
            continue
        neg, core, kind = sh
        if kind == "sci":
            f = float(core)
        elif decimal is None:
            # Só valores ambíguos/sem separador: "1.500" e "1,500" = milhar.
            f = _to_float(core.replace(",", "").replace(".", ""), ".")
        else:
            f = _to_float(core, decimal)
        # 1e308 e afins somam infinito ("R$ inf bi"): ninguém tem esse valor.
        out.append(np.nan if f is None or not math.isfinite(f) or abs(f) >= 1e15 else (-f if neg else f))
    arr = np.array(out, dtype="float64")
    return arr, {"decimal": decimal, "decimalSource": how, "votes": votes,
                 "hasCurrency": has_currency, "hasPercent": has_percent}


_COORD_NAME = re.compile(r"lat|long|lng|^lon$|coord|geo", re.I)


def _dataset_decimal(raw_df, native_numeric):
    """Separador decimal predominante no arquivo, que desempata colunas em que
    todo valor é ambíguo ("85.000"). Vota por COLUNA, não por célula, e ignora
    coordenadas e valores com 4+ casas: latitude "-23.3471" vem com ponto até em
    planilha brasileira e não pode transformar R$ 85.000 em 85,0."""
    col_votes = {",": 0, ".": 0}
    for c in raw_df.columns:
        if c in native_numeric or _COORD_NAME.search(str(c)):
            continue
        votes = {",": 0, ".": 0}
        for v in raw_df[c].dropna().head(500):
            sh = _number_shape(_NUM_STRIP.sub("", v))
            if not sh or sh[2] is not None:
                continue
            core = sh[1]
            dv = _decimal_vote(core)
            if not dv:
                continue
            both = "." in core and "," in core
            if not both and len(core.rsplit(dv, 1)[-1]) >= 4:
                continue
            votes[dv] += 1
        if votes[","] or votes["."]:
            col_votes["," if votes[","] >= votes["."] else "."] += 1
    if not (col_votes[","] or col_votes["."]):
        return None
    return "," if col_votes[","] >= col_votes["."] else "."


# ─────────────────────────── datas ───────────────────────────

_RE_ISO = re.compile(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ tT].*)?$")
_RE_DMY = re.compile(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:[ tT,].*)?$")
_RE_MY = re.compile(r"^(\d{1,2})[-/.](\d{4})$")
_RE_YM = re.compile(r"^(\d{4})[-/.](\d{1,2})$")
_RE_MON_Y = re.compile(r"^([a-zç]{3,9})\.?[\s/.-]*(?:de\s+)?(\d{2}|\d{4})$")
_RE_D_MON_Y = re.compile(r"^(\d{1,2})[\s/.-]*(?:de\s+)?([a-zç]{3,9})\.?[\s/.-]*(?:de\s+)?(\d{2}|\d{4})$")


_LOOKS_DATE = re.compile(r"^\d{1,4}[-/.]\d{1,4}([-/.]\d{1,4})?([ tT,].*)?$|^\d{0,2}[\s/.-]*(de\s+)?[a-zç]{3,9}\.?[\s/.-]*(de\s+)?\d{2,4}$", re.I)


def _looks_like_date(v):
    return bool(_LOOKS_DATE.match(v.strip()))


def _year(y):
    y = int(y)
    if y < 100:
        y += 2000 if y < 70 else 1900
    return y


_MONTH_FULL = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro",
               "outubro", "novembro", "dezembro", "january", "february", "march", "april", "may", "june",
               "july", "august", "september", "october", "november", "december"]


def _month_token(tok):
    """Abreviação ("set", "out") ou começo do nome do mês ("março", "sept").
    "Setor 01", "Outlet 21" e "Novo 24" NÃO são datas."""
    tok = _strip_accents(tok.lower())
    if len(tok) < 3:
        return None
    if len(tok) > 3 and not any(full.startswith(tok) for full in _MONTH_FULL):
        return None
    return MONTH_TOKENS.get(tok[:3])


def _parse_date_series(values):
    """Série de textos → (datetime64, info). A ordem dia/mês é decidida pela
    coluna (algum primeiro campo > 12 → dia primeiro; algum segundo > 12 → mês
    primeiro; sem evidência → padrão brasileiro DD/MM)."""
    parts = []
    first_gt12 = second_gt12 = False
    kinds = {}
    for v in values:
        if v is None:
            parts.append(None)
            continue
        s = v.strip().lower()
        m = _RE_ISO.match(s)
        if m:
            parts.append(("ymd", int(m[1]), int(m[2]), int(m[3])))
            kinds["iso"] = kinds.get("iso", 0) + 1
            continue
        m = _RE_DMY.match(s)
        if m:
            a, b = int(m[1]), int(m[2])
            first_gt12 |= a > 12
            second_gt12 |= b > 12
            parts.append(("ab", a, b, _year(m[3])))
            kinds["dmy"] = kinds.get("dmy", 0) + 1
            continue
        m = _RE_MY.match(s)
        if m:
            parts.append(("ymd", int(m[2]), int(m[1]), 1))
            kinds["mes"] = kinds.get("mes", 0) + 1
            continue
        m = _RE_YM.match(s)
        if m and 1 <= int(m[2]) <= 12:
            parts.append(("ymd", int(m[1]), int(m[2]), 1))
            kinds["mes"] = kinds.get("mes", 0) + 1
            continue
        m = _RE_MON_Y.match(s)
        if m and _month_token(m[1]):
            parts.append(("ymd", _year(m[2]), _month_token(m[1]), 1))
            kinds["mes"] = kinds.get("mes", 0) + 1
            continue
        m = _RE_D_MON_Y.match(s)
        if m and _month_token(m[2]):
            parts.append(("ymd", _year(m[3]), _month_token(m[2]), int(m[1])))
            kinds["dia"] = kinds.get("dia", 0) + 1
            continue
        parts.append(None)
    month_first = second_gt12 and not first_gt12
    ys, ms, ds = [], [], []
    for p in parts:
        if p is None:
            ys.append(np.nan); ms.append(np.nan); ds.append(np.nan)
        elif p[0] == "ymd":
            ys.append(p[1]); ms.append(p[2]); ds.append(p[3])
        else:
            a, b, y = p[1], p[2], p[3]
            d, mth = (b, a) if month_first else (a, b)
            ys.append(y); ms.append(mth); ds.append(d)
    frame = pd.DataFrame({"year": ys, "month": ms, "day": ds})
    valid = frame["year"].between(1900, 2100) & frame["month"].between(1, 12) & frame["day"].between(1, 31)
    frame = frame.where(valid)
    dt = pd.to_datetime(frame, errors="coerce")
    only_month = kinds and set(kinds) == {"mes"}
    return dt.to_numpy(), {
        "order": "mm/dd" if month_first else "dd/mm",
        "granularity": "month" if only_month else "day",
        "formats": sorted(kinds),
    }


# ─────────────────────────── perfil de coluna ───────────────────────────

def _profile_column(name, raw, ctx):
    """Decide tipo/padrão de uma coluna e devolve (perfil, valores tipados)."""
    # Tudo é calculado sobre os valores ÚNICOS (pd.factorize) e mapeado de
    # volta pelos códigos: exports repetem muito (datas, categorias, preços),
    # então 100 mil linhas viram poucos milhares de parses.
    n = len(raw)
    codes, uniq = pd.factorize(pd.Series(raw, dtype=object), use_na_sentinel=True)
    uniq = [str(u) for u in uniq]
    counts = np.bincount(codes[codes >= 0], minlength=len(uniq)) if len(uniq) else np.array([], dtype=int)
    p = int(counts.sum())
    null_count = n - p
    unique_count = len(uniq)
    unique_ratio = unique_count / p if p else 0.0
    present = [raw[i] for i in range(min(n, 400)) if raw[i] is not None]
    ctx = dict(ctx, codes=codes, uniq=uniq, counts=counts)
    lname = name.lower()
    base = {
        "name": name,
        "stats": {
            "uniqueCount": int(unique_count), "uniqueRatio": round(unique_ratio, 2),
            "nullCount": int(null_count), "nullRatio": round(null_count / n, 2) if n else 0.0,
            "sampleValues": present[:3], "min": None, "max": None, "sum": 0, "avg": None, "median": None,
        },
        "hints": {"hasCurrency": False, "hasPercent": False, "scaleRange": None},
        "coerced": 0,
    }
    if not p:
        base.update(baseType="string", pattern="empty", confidence=0.0, schemaType="dimension", additive=False, semantic="empty")
        return base, [None] * n

    # Datas antes de números ("2025" sozinho não é data; "01/2025" é).
    # Triagem barata numa amostra antes do parse completo.
    sample = uniq[:300]
    if sum(1 for v in sample if _looks_like_date(v)) >= 0.5 * len(sample):
        udates, dinfo = _parse_date_series(uniq)
        dates = np.append(udates, np.datetime64("NaT"))[codes]
        date_ok = int(counts[pd.notna(udates)].sum())
    else:
        date_ok = 0
    if date_ok / p >= 0.85:
        conf = min(0.98, date_ok / p + (0.1 if re.search(r"data|date|dia|created|criad|timestamp|hora|m[eê]s|per[ií]odo|compet", lname) else 0))
        typed = pd.Series(dates).dt.strftime("%Y-%m-%d").astype(object).where(pd.notna(dates), None).tolist()
        valid = dates[pd.notna(dates)]
        base.update(baseType="date", pattern="datetime", confidence=round(conf, 2), schemaType="date",
                    additive=False, semantic="date", coerced=p - date_ok, dateInfo=dinfo)
        base["stats"].update(min=pd.Timestamp(valid.min()).strftime("%Y-%m-%d"), max=pd.Timestamp(valid.max()).strftime("%Y-%m-%d"))
        return base, typed

    if sum(1 for v in sample if re.search(r"\d", v)) >= 0.5 * len(sample):
        unums, ninfo = _parse_number_series(uniq, ctx.get("decimal"), name in ctx.get("native_numeric", ()))
        nums = np.append(unums, np.nan)[codes]
        num_ok = int(counts[np.isfinite(unums)].sum())
        if num_ok / p >= 0.85:
            return _profile_numeric(name, raw, uniq, counts, nums, ninfo, base, unique_count, unique_ratio, num_ok, p)

    return _profile_text(name, uniq, counts, base, unique_count, unique_ratio, p, raw)


def _profile_numeric(name, raw, uniq, counts, nums, ninfo, base, unique_count, unique_ratio, num_ok, p):
    lname = name.lower()
    vals = nums[np.isfinite(nums)]
    vmin, vmax = float(vals.min()), float(vals.max())
    total, avg, med = float(vals.sum()), float(vals.mean()), float(np.median(vals))
    ints = bool(np.all(np.equal(np.mod(vals, 1), 0)))
    two_dec = sum(int(c) for s, c in zip(uniq, counts) if _RE_TWO_DEC.search(_NUM_STRIP.sub("", s))) / p
    lead_zero = any(re.fullmatch(r"0\d+", s) for s in uniq)
    lens = {len(s) for s in uniq}
    has_sep = any(("." in s or "," in s) for s in uniq[:200])
    # Largura fixa longa sugere código, mas não em métrica ("Impressões" 120000+)
    # nem quando há separador de milhar ("13.700").
    fixed_width = len(lens) == 1 and next(iter(lens)) >= 6 and not has_sep and not METRIC_NAME.search(lname)
    name_id = bool(ID_NAME.search(lname))
    strong_id = bool(STRONG_ID_NAME.search(lname)) and not QTY_NAME.search(lname)
    money_name = bool(MONEY_NAME.search(lname))
    base["hints"].update(hasCurrency=ninfo["hasCurrency"], hasPercent=ninfo["hasPercent"])
    base["numberInfo"] = {"decimal": ninfo["decimal"], "decimalSource": ninfo["decimalSource"]}
    base["stats"].update(min=_r(vmin, 4), max=_r(vmax, 4), sum=_r(total, 4), avg=_r(avg, 4), median=_r(med, 4))
    # Forma da distribuição (sweetviz): quantis, dispersão e assimetria. Vendas
    # quase sempre têm cauda longa — aí a mediana descreve o "típico" melhor.
    q05, q25, q75, q95 = (float(x) for x in np.quantile(vals, [0.05, 0.25, 0.75, 0.95]))
    std = float(vals.std(ddof=1)) if len(vals) > 1 else 0.0
    base["stats"].update(p05=_r(q05, 4), p25=_r(q25, 4), p75=_r(q75, 4), p95=_r(q95, 4), std=_r(std, 4),
                         cv=_r(std / avg, 3) if avg else None,
                         skew=_r(pd.Series(vals).skew(), 3) if len(vals) > 2 else None,
                         zeroShare=_r(float((vals == 0).mean()), 3))
    base["coerced"] = p - num_ok
    # Coluna 0/1 com nome de flag ("pago", "ativo", "churn") é sim/não, não quantidade.
    if ints and set(np.unique(vals)) <= {0.0, 1.0} and FLAG_NAME.search(lname) and not money_name:
        base.update(baseType="string", pattern="boolean", confidence=0.85, schemaType="dimension",
                    additive=False, semantic="boolean", coerced=0)
        base["stats"].update(min=None, max=None, sum=0, avg=None, median=None)
        return base, [None if not np.isfinite(x) else str(int(x)) for x in nums]

    # Identificadores numéricos (CEP, CPF, código): ficam como TEXTO, sem somar,
    # preservando zeros à esquerda. Exige nome de id, zero à esquerda ou largura
    # fixa longa — inteiros de 4-5 dígitos (valores!) não viram id sozinhos.
    plain_int = ints and not ninfo["hasCurrency"] and not ninfo["hasPercent"] and not money_name
    if plain_int and (PII_NAME.search(lname) or (unique_ratio > 0.95 and (name_id or lead_zero or fixed_width))
                      or (strong_id and vmin >= 0 and unique_count >= 2)):
        pii = bool(PII_NAME.search(lname))
        base.update(baseType="string", pattern="identifier", confidence=round(min(0.98, 0.78 + (0.1 if name_id else 0)), 2),
                    schemaType="dimension", additive=False, semantic="pii" if pii else "identifier", coerced=0)
        if pii:
            base["pii"] = True
        base["stats"].update(min=None, max=None, sum=0, avg=None, median=None)
        return base, list(raw)
    if lead_zero and ints and not money_name:
        base.update(baseType="string", pattern="category_high" if unique_count > 20 else "category_low",
                    confidence=0.66, schemaType="dimension", additive=False, semantic="code", coerced=0)
        base["stats"].update(min=None, max=None, sum=0, avg=None, median=None)
        return base, list(raw)
    # Ano como coluna (2019, 2020…): é uma dimensão ordinal, não uma medida.
    if ints and 1900 <= vmin and vmax <= 2100 and re.search(r"^ano$|year|^ano_|_ano$|exerc[ií]cio|safra", lname):
        base.update(baseType="string", pattern="category_low" if unique_count <= 20 else "category_high",
                    confidence=0.8, schemaType="dimension", additive=False, semantic="year", coerced=0)
        typed = [None if not np.isfinite(x) else str(int(x)) for x in nums]
        return base, typed

    pattern, conf, semantic = "continuous", 0.6, "quantity"
    is_qty = bool(QTY_NAME.search(lname))
    if ints and not is_qty and 3 <= unique_count <= 11 and vmin >= 0 and vmax <= 10 and (vmax - vmin) >= 2:
        pattern, conf, semantic = "scale", 0.72 + (0.1 if re.search(r"nota|escala|rating|score|nps|satisf|aval|estrela", lname) else 0), "scale"
        base["hints"]["scaleRange"] = [_r(vmin), _r(vmax)]
    elif ninfo["hasPercent"]:
        pattern, conf, semantic = "percent", 0.85 + (0.1 if re.search(r"%|pct|perc|taxa|convers|rate", lname) else 0), "percent"
    elif vmin >= 0 and vmax <= 1 and not ints:
        pattern, conf, semantic = "percent", 0.6 + (0.1 if re.search(r"%|pct|perc|taxa|convers|rate|propor|ratio", lname) else 0), "ratio"
    elif vmin >= 0 and vmax <= 100 and re.search(r"%|pct|perc|taxa|convers|rate", lname):
        pattern, conf, semantic = "percent", 0.62, "percent"
    elif ninfo["hasCurrency"]:
        pattern, conf, semantic = "monetary", 0.85 + (0.1 if money_name else 0), "money"
    elif (avg > 100 and two_dec >= 0.4) or (money_name and not QTY_NAME.search(lname)):
        pattern, conf, semantic = "monetary", 0.65 + (0.1 if money_name else 0), "money"
    else:
        conf += 0.1 if re.search(r"qtd|quant|total|count|num|idade|peso|volume|estoque|valor|preç|preco", lname) else 0

    non_add = _non_additive(lname)
    additive = pattern in ("continuous", "monetary") and not non_add
    if non_add and pattern in ("continuous", "monetary"):
        semantic = ("unit_price" if re.search(r"pre[cç]|price|unit", lname)
                    else "age" if re.search(r"(^|[\s_])idade($|[\s_])|^age$|_age", lname) else "rate")
    base.update(baseType="number", pattern=pattern, confidence=round(min(0.98, conf), 2),
                schemaType="measure", additive=bool(additive), semantic=semantic)
    typed = pd.Series(nums).astype(object).where(np.isfinite(nums), None).tolist()
    return base, typed


def _merge_variants(uniq, counts):
    """Agrupa grafias da mesma categoria ("SP", "sp ", "Sp"; "São Paulo" e
    "sao paulo") e escolhe a grafia mais frequente como a oficial (pandas-ai
    faz algo parecido ao padronizar categorias). Devolve {grafia: oficial}."""
    groups = {}
    for u, c in zip(uniq, counts):
        k = _strip_accents(u).casefold().strip()
        groups.setdefault(k, []).append((int(c), u))
    mapping = {}
    for members in groups.values():
        if len(members) > 1:
            # A grafia "mais cuidada" vence (com acento, inicial maiúscula, sem
            # espaço sobrando); depois a mais frequente: "Feijão" > "feijão",
            # "SP" > "sp ", "São Paulo" > "sao paulo".
            canon = max(members, key=lambda cu: (sum(not ch.isascii() for ch in cu[1]) > 0,
                                                 cu[1][:1].isupper(), cu[1] == cu[1].strip(), cu[0],
                                                 sum(ch.isupper() for ch in cu[1]), cu[1]))[1]
            for _, u in members:
                if u != canon:
                    mapping[u] = canon
    return mapping


def _profile_text(name, uniq, counts, base, unique_count, unique_ratio, p, raw):
    lname = name.lower()
    raw = list(raw)
    # Dados pessoais: marcados e mantidos como identificador (nunca vão para
    # insights, gráficos de ranking ou fatos da IA).
    # Basta o nome (CPF/CNPJ com "CONSUMIDOR FINAL" repete muito) ou uma fração
    # pequena de valores com cara de documento/e-mail (coluna "cliente" mista).
    pii_hits = sum(int(c) for u, c in zip(uniq, counts) if PII_VALUE.fullmatch(u.strip()))
    if PII_NAME.search(lname) or pii_hits / p >= 0.1:
        base.update(baseType="string", pattern="identifier", confidence=0.9, schemaType="dimension",
                    additive=False, semantic="pii", pii=True)
        return base, raw
    code_like_all = all(re.fullmatch(r"[A-Za-z]{0,5}[-_]?\d{2,}", s) for s in uniq)
    if not code_like_all and not ID_NAME.search(lname):
        mapping = _merge_variants(uniq, counts)
        if mapping:
            merged = {}
            for u, c in zip(uniq, counts):
                k = mapping.get(u, u)
                merged[k] = merged.get(k, 0) + int(c)
            uniq, counts = list(merged), np.array(list(merged.values()))
            unique_count = len(uniq)
            unique_ratio = unique_count / p
            raw = [mapping.get(v, v) if v is not None else None for v in raw]
            base["mergedVariants"] = len(mapping)
            base["stats"].update(uniqueCount=unique_count, uniqueRatio=round(unique_ratio, 2))
    lowered = {_strip_accents(u).casefold().strip() for u in uniq}
    avg_len = sum(len(s) * int(c) for s, c in zip(uniq, counts)) / p
    multi = max(sum(int(c) for s, c in zip(uniq, counts) if re.search(re.escape(d) + r"\s*\S", s)) / p for d in (",", ";", "|"))
    code_like = all(re.fullmatch(r"[A-Za-z]{0,5}[-_]?\d{2,}", s) for s in uniq)
    name_id = bool(ID_NAME.search(lname))
    if len(lowered) == 2 and lowered <= BOOL_TOKENS:
        pattern, conf, sem = "boolean", 0.85 + (0.1 if re.search(r"flag|ativo|inativo|status|aprov|pago|^is_|resp", lname) else 0), "boolean"
    elif unique_ratio > 0.95 and (name_id or code_like) and p >= 5:
        pattern, conf, sem = "identifier", 0.78 + (0.1 if name_id else 0), "identifier"
    elif multi >= 0.3 and avg_len < 80:
        pattern, conf, sem = "multi_value", 0.68, "multi"
    elif unique_ratio > 0.8 and avg_len > 50:
        pattern, conf, sem = "freetext", 0.72, "text"
    elif unique_count <= 20:
        pattern, conf, sem = "category_low", 0.78 - (0.06 if unique_count > 12 else 0), "category"
    elif unique_count <= MAX_UNIQUE_CATEGORY:
        pattern, conf, sem = "category_high", 0.66, "category"
    else:
        pattern, conf, sem = ("identifier", 0.6, "identifier") if unique_ratio > 0.95 else ("freetext", 0.55, "text")
    base.update(baseType="string", pattern=pattern, confidence=round(min(0.98, conf), 2),
                schemaType="dimension", additive=False, semantic=sem)
    return base, raw


# ─────────────────────────── semântica entre colunas ───────────────────────────

def _detect_products(df, measures):
    """Acha relações total = a × b (ex.: receita = quantidade × preço). Marca o
    total como aditivo e o fator "preço" como não aditivo (preço unitário)."""
    rel = []
    cols = measures[:12]
    for i, a in enumerate(cols):
        for b in cols[i + 1:]:
            prod = df[a] * df[b]
            for c in cols:
                if c in (a, b):
                    continue
                mask = prod.notna() & df[c].notna() & (df[c].abs() > 0)
                if mask.sum() < max(5, 0.5 * len(df)):
                    continue
                err = ((prod[mask] - df[c][mask]).abs() / df[c][mask].abs())
                if (err < 0.011).mean() >= 0.9:
                    rel.append((c, a, b))
    # Com quantidade quase sempre 1, "preço = qtd × total" também fecha. O total
    # de verdade é o maior: descarta a relação cujo "total" é fator de outra
    # relação com um total maior.
    mean = {c: float(df[c].abs().mean()) for c in cols}
    keep = []
    for c, a, b in rel:
        if any(c in (a2, b2) and c2 in (a, b) and mean[c2] > mean[c] for c2, a2, b2 in rel):
            continue
        keep.append((c, a, b))
    return keep


def _score_value_name(name):
    n = _strip_accents(name.lower())
    if QTY_NAME.search(n) or ORDER_NAME.search(n):
        return -1
    best = 0
    for t in VALUE_TERMS:
        if n.startswith(t):
            best = max(best, 3)
        elif t in n:
            best = max(best, 2)
    if best:
        if re.search(r"total|bruto|liquid|faturad|geral", n):
            best += 2
        if re.search(r"custo|cost|despesa|cogs|cmv", n):
            best -= 2
    return best


def _choose_value(profiles, relations):
    """Coluna "valor" principal (alimenta os KPIs de vendas). Só medidas
    aditivas; preço unitário, idade e taxas nunca são o total."""
    totals = {c for c, _, _ in relations}
    cands = [pr for pr in profiles if pr.get("schemaType") == "measure" and pr.get("additive")
             and not SALARY_NAME.search(pr["name"])]
    best, best_score = None, 0
    for pr in cands:
        name_sc = _score_value_name(pr["name"])
        if name_sc < 0:
            continue
        sc = name_sc + (3 if pr["name"] in totals else 0) + (1 if pr["pattern"] == "monetary" else 0)
        # Sem nome de valor nem relação total = a × b, só vale a única coluna com
        # símbolo de moeda (ex.: "pagamento" em R$). Senão a base fica sem
        # "valor" e cai no painel de descoberta, que não assume vendas.
        if name_sc < 2 and pr["name"] not in totals:
            monetary_cur = [c for c in cands if c["hints"].get("hasCurrency")]
            if not (pr["hints"].get("hasCurrency") and len(monetary_cur) == 1):
                continue
        if sc > best_score:
            best, best_score = pr["name"], sc
    return best


def _role_columns(profiles, value):
    by = {pr["name"]: pr for pr in profiles}
    cats = [pr for pr in profiles if pr["pattern"] in ("category_low", "category_high")]

    def pick(rx):
        for pr in cats:
            if rx.search(pr["name"]):
                return pr["name"]
        return None

    date = next((pr["name"] for pr in profiles if pr["pattern"] == "datetime"), None)
    order = next((pr["name"] for pr in profiles if ORDER_NAME.search(pr["name"].lower())), None)
    return {
        "date": date, "value": value, "order": order,
        "product": pick(PRODUCT_NAME), "region": pick(REGION_NAME), "channel": pick(CHANNEL_NAME),
        "_by": by,
    }


# ─────────────────────────── qualidade ───────────────────────────

_TOTAL_PREFIX = re.compile(r"^\s*(sub\s*-?\s*total|total)\b", re.I)
_TOTAL_GROUP_WORD = re.compile(r"\d|semana|m[eê]s|dia|per[ií]odo|geral|parcial|acumulad|trimestre|ano\b", re.I)


def _drop_total_rows_raw(raw_df):
    """Tira linhas de TOTAL/SUBTOTAL e o rodapé ("Emitido por…") ANTES de tipar
    as colunas. Se ficassem, o KPI principal sai em dobro, a coluna de data pode
    deixar de ser data e a linha removida ainda contaria como célula vazia.
    O rótulo pode estar em qualquer coluna (inclusive na de data). Um produto
    chamado "Total Flex" ou um cliente "Soma Distribuidora" não é total: o
    rótulo tem que ser só "total" ou vir numa linha incompleta, sem outro texto."""
    n = len(raw_df)
    if n < 3:
        return raw_df.reset_index(drop=True), 0, 0
    filled = raw_df.notna().sum(axis=1)
    typical = int(filled.median())
    footer = 0
    keep_idx = list(raw_df.index)
    while keep_idx and typical >= 3 and len(keep_idx) > 2:
        cells = [c for c in raw_df.loc[keep_idx[-1]] if c is not None]
        if len(cells) == 1 and not _looks_like_value(cells[0]) and not _TOTAL_PREFIX.match(cells[0]):
            keep_idx.pop()
            footer += 1
        else:
            break
    df = raw_df.loc[keep_idx]
    label_cells = {}
    for c in df.columns:
        col = df[c]
        codes, uniq = pd.factorize(col, use_na_sentinel=True)
        hits = [i for i, u in enumerate(uniq) if len(str(u)) <= 40 and TOTAL_LABEL.match(str(u))]
        if not hits:
            continue
        counts = np.bincount(codes[codes >= 0], minlength=len(uniq))
        for i in hits:
            for r in df.index[codes == i]:
                label_cells.setdefault(r, []).append((c, str(uniq[i]), int(counts[i])))
    drop = []
    for r, labels in label_cells.items():
        row = df.loc[r]
        for c, label, count in labels:
            others = [v for k, v in row.items() if k != c and v is not None]
            if any(not _looks_like_value(v) for v in others):
                continue   # tem outro texto na linha (nome, produto): é dado
            strict = TOTAL_WHOLE.match(label) and count <= max(3, 0.3 * len(df))
            prefix = (_TOTAL_PREFIX.match(label) and
                      (filled[r] < typical or _TOTAL_GROUP_WORD.search(label[5:])) and count <= max(3, 0.3 * len(df)))
            if strict or prefix:
                drop.append(r)
                break
    df = df.drop(index=drop)
    return df.reset_index(drop=True), len(drop), footer


def _unlabeled_total_row(df, profiles):
    """Última linha sem nenhuma dimensão preenchida cujo valor bate com a soma
    das outras: é um total sem rótulo. Devolve a posição dela ou None."""
    dims = [pr["name"] for pr in profiles if pr["schemaType"] in ("dimension", "date")]
    meas = [pr["name"] for pr in profiles if pr["schemaType"] == "measure"]
    if not dims or not meas or len(df) < 3:
        return None
    last = df.index[-1]
    if not df.loc[last, dims].isna().all():
        return None
    rest = df.drop(index=last)
    for m in meas:
        tot = rest[m].sum(skipna=True)
        v = df.loc[last, m]
        if pd.notna(v) and tot and abs(v - tot) / abs(tot) < 0.005:
            return int(len(df) - 1)
    return None


def _outliers(series):
    s = series.dropna()
    if len(s) < 20:
        return None
    q1, q3 = s.quantile(0.25), s.quantile(0.75)
    iqr = q3 - q1
    if iqr <= 0:
        return None
    hi, lo = q3 + 3 * iqr, q1 - 3 * iqr
    up, down = series > hi, series < lo
    return {"count": int((up | down).sum()), "up": int(up.sum()), "down": int(down.sum()),
            "high": _r(hi), "low": _r(lo), "mask": up | down}


# ─────────────────────────── insights (sem IA) ───────────────────────────

def _period_split(df, date, value):
    """Divide a base em metade antiga x metade recente pelo calendário."""
    d = df[[date, value]].dropna()
    if len(d) < 8:
        return None
    lo, hi = d[date].min(), d[date].max()
    span = (hi - lo).days
    if span < 14:
        return None
    mid = lo + (hi - lo) / 2
    return mid, span


def _monthly(df, date, value, how="sum"):
    d = df[[date, value]].dropna()
    if d.empty:
        return pd.Series(dtype="float64")
    g = d.groupby(d[date].dt.to_period("M"))[value]
    return g.sum() if how == "sum" else g.mean()


def _full_months(df, date, mon):
    """Tira o 1º/último mês quando cobrem menos de 80% dos dias: export que para
    no dia 5 faria um mês estável parecer uma queda de 30%."""
    if len(mon) < 4:
        return mon
    d = df[date].dropna()
    first, last = d.min(), d.max()
    keep = mon
    p0, p1 = mon.index[0], mon.index[-1]
    if (p0.days_in_month - first.day + 1) / p0.days_in_month < 0.8:
        keep = keep.iloc[1:]
    if last.day / p1.days_in_month < 0.8 and len(keep) > 3:
        keep = keep.iloc[:-1]
    return keep if len(keep) >= 3 else mon


def _month_label(period, with_year):
    return MESES[period.month - 1] + (f"/{str(period.year)[2:]}" if with_year else "")


def _topk_other(g, k=8):
    """Top-(k-1) + "Outros": barras e rosca somam o total de verdade, em vez de
    descartar a cauda em silêncio (sweetviz faz o mesmo nos value_counts)."""
    if len(g) <= k:
        items = list(g.items())
    else:
        items = list(g.iloc[: k - 1].items()) + [("Outros", float(g.iloc[k - 1:].sum()))]
    return [{"l": _short(i, 14), "v": _r(v)} for i, v in items]


def _eta2_adj(df, dim, measure):
    """Razão de correlação η² ajustada: quanto da variação de `measure` (por
    linha) a dimensão explica, de 0 a 1. Fórmula clássica (ANOVA de um fator);
    o ajuste por graus de liberdade evita premiar dimensões com muitos grupos."""
    d = df[[dim, measure]].dropna()
    n = len(d)
    if n < 10:
        return None
    codes, uniq = pd.factorize(d[dim])
    k = len(uniq)
    if k < 2 or k > MAX_UNIQUE_CATEGORY or n - k < 2:
        return None
    y = d[measure].to_numpy(dtype="float64")
    n_k = np.bincount(codes)
    m_k = np.bincount(codes, weights=y) / n_k
    g = y.mean()
    sst = float(((y - g) ** 2).sum())
    if sst <= 0:
        return None
    eta2 = float((n_k * (m_k - g) ** 2).sum()) / sst
    return max(0.0, 1 - (1 - eta2) * (n - 1) / (n - k))


def _theils_u(x, y):
    """Coeficiente de incerteza U(x|y): quanto saber `y` determina `x` (0 a 1).
    1 = cada valor de y aponta para um único x (cidade → estado)."""
    d = pd.DataFrame({"x": x, "y": y}).dropna()
    if len(d) < 10:
        return None
    cx, kx = pd.factorize(d["x"])
    cy, ky = pd.factorize(d["y"])
    nx, ny = len(kx), len(ky)
    if nx < 2 or nx > 200 or ny > 200:
        return None
    joint = np.bincount(cx * ny + cy, minlength=nx * ny).reshape(nx, ny).astype("float64")
    pxy = joint / joint.sum()
    px, py = pxy.sum(axis=1), pxy.sum(axis=0)
    hx = float(-(px[px > 0] * np.log(px[px > 0])).sum())
    if hx <= 0:
        return None
    nz = pxy > 0
    py_full = np.broadcast_to(py, (nx, ny))
    hx_y = float(-(pxy[nz] * np.log(pxy[nz] / py_full[nz])).sum())
    return (hx - hx_y) / hx


def _dedupe_dims(df, cats):
    """Remove dimensões redundantes antes dos insights: apelidos (código ↔ nome)
    e hierarquias (cidade → estado). Sem isso, "Cidade", "Estado" e "Região"
    contavam a mesma história três vezes."""
    chosen, relations = [], []
    for pr in cats:
        redundant = False
        for c in chosen[:6]:
            u_c = _theils_u(df[c["name"]], df[pr["name"]])   # pr determina c?
            u_p = _theils_u(df[pr["name"]], df[c["name"]])   # c determina pr?
            if u_c is None or u_p is None:
                continue
            if u_c >= 0.98 and u_p >= 0.98:
                relations.append({"type": "alias", "a": c["name"], "b": pr["name"]})
                redundant = True
            elif u_c >= 0.98:
                relations.append({"type": "hierarchy", "parent": c["name"], "child": pr["name"]})
                redundant = True
            elif u_p >= 0.98:
                relations.append({"type": "hierarchy", "parent": pr["name"], "child": c["name"]})
                redundant = True
            if redundant:
                break
        if not redundant:
            chosen.append(pr)
    return chosen, relations


def _insights(df, profiles, roles, quality):
    out = []
    by = roles["_by"]
    value, date = roles["value"], roles["date"]
    money = bool(value and by[value]["pattern"] == "monetary")
    fmtv = (lambda x: _fmt_compact(x, money=money))
    cats = [pr for pr in profiles if pr["pattern"] == "category_low" or
            (pr["pattern"] == "category_high" and pr["stats"]["uniqueCount"] <= MAX_UNIQUE_CATEGORY)]
    cats.sort(key=lambda pr: (0 if pr["name"] in (roles["product"], roles["region"], roles["channel"]) else 1,
                              -pr["confidence"]))
    cats, dim_rel = _dedupe_dims(df, cats)
    quality["dimensionRelations"] = dim_rel
    highlights = {}
    facts = []
    # Métrica "quanto maior, pior" (custo, devolução): alta vira risco, queda vira boa notícia.
    inverse = bool(value and INVERSE_NAME.search(_strip_accents(value)))
    good, bad = ("#0a8a4a", "#c9234a") if not inverse else ("#c9234a", "#0a8a4a")

    total = float(df[value].sum()) if value else None
    # Livro-caixa (receita +, despesa −): participação e "maior alta" de grupos
    # negativos não fazem sentido, então essas contas usam só grupos positivos.
    mixed_sign = False
    if value:
        pos_sum = float(df[value].clip(lower=0).sum())
        neg_sum = float(-df[value].clip(upper=0).sum())
        mixed_sign = neg_sum > 0.05 * max(pos_sum, 1e-9)
    if value:
        facts.append(f"Total de {value}: {fmtv(total)} em {_fmt_num(len(df))} linhas.")

    # 1) Concentração e líder por dimensão (soma do valor ou contagem).
    for pr in cats[:3]:
        dim = pr["name"]
        if value:
            g = df.groupby(dim, dropna=True)[value].sum().sort_values(ascending=False)
            if mixed_sign:
                g = g[g > 0]
            base_total = g.sum()
        else:
            g = df[dim].value_counts(dropna=True)
            base_total = g.sum()
        if len(g) < 2 or not base_total or base_total < 0:
            continue
        top, top_v = g.index[0], float(g.iloc[0])
        share = top_v / base_total * 100
        k = max(1, math.ceil(len(g) * 0.2))
        top_share = float(g.iloc[:k].sum() / base_total * 100)
        unit = fmtv(top_v) if value else _fmt_num(top_v) + " registros"
        chart = {"type": "bar", "title": (f"{value} por {dim}" if value else f"Registros por {dim}"),
                 "dim": dim, "agg": "sum" if value else "count", "sort": "value_desc", "data": _topk_other(g)}
        out.append({"cat": "comparison", "t": f'"{_short(top, 30)}" lidera em {dim}', "tag": dim,
                    "d": f"Responde por {_fmt_pct(share, 1)} do {('valor positivo' if mixed_sign else 'valor total') if value else 'total de registros'} ({unit}), "
                         f"à frente de \"{_short(g.index[1], 30)}\" ({_fmt_pct(float(g.iloc[1]) / base_total * 100, 1)}).",
                    "ev": unit, "conf": 95, "chart": chart})
        facts.append(f"Líder em {dim}: {top} com {_fmt_pct(share, 1)} do {'valor positivo' if mixed_sign else 'total'}.")
        if "concentracao" not in highlights and len(g) >= 5:
            highlights["concentracao"] = {"l": "Concentração", "v": _fmt_pct(top_share), "s": f"Top {k} de {len(g)} · {_short(dim, 18)}", "d": "flat"}
            if top_share >= 60:
                out.append({"cat": "risk", "risk": True, "t": f"Dependência alta em poucos itens de {dim}", "tag": "Concentração",
                            "d": f"{k} de {len(g)} itens ({_fmt_pct(k / len(g) * 100)}) concentram {_fmt_pct(top_share)} do resultado. "
                                 "Uma queda em qualquer um deles pesa no total.", "ev": f"{_fmt_pct(top_share)} no top {k}", "conf": 88})
                out.append({"cat": "action", "t": f"Proteger e diversificar {dim}", "tag": "Ação",
                            "d": f"Acompanhe de perto \"{_short(top, 30)}\" e desenvolva os itens seguintes do ranking para reduzir a dependência.",
                            "ev": f"top {k} = {_fmt_pct(top_share)}", "conf": 80, "chart": chart})

    # 2) Tendência no tempo + maior alta/queda por dimensão (metade recente x antiga).
    if date and value:
        mon_all = _monthly(df, date, value)
        mon = _full_months(df, date, mon_all)
        partial = len(mon) < len(mon_all)
        if len(mon) >= 3:
            with_year = len(mon_all) > 12 or mon_all.index[0].year != mon_all.index[-1].year
            y = mon.to_numpy(dtype=float)
            x = np.arange(len(y))
            slope = float(np.polyfit(x, y, 1)[0]) if len(y) >= 3 else 0.0
            rel = slope / (abs(y.mean()) or 1) * 100
            best_m, worst_m = mon.idxmax(), mon.idxmin()
            chart = {"type": "line", "title": f"Evolução mensal de {value}", "dim": date, "agg": "sum",
                     "sort": "natural", "data": [{"l": _month_label(p, with_year), "v": _r(v)} for p, v in mon_all.items()][-200:]}
            direction = "alta" if rel > 2 else ("queda" if rel < -2 else "estabilidade")
            out.append({"cat": "trend", "t": f"Tendência de {direction} em {value}", "tag": "Tendência",
                        "d": f"Ao longo de {len(mon)} meses{' completos' if partial else ''}, {value} varia em média {_fmt_pct(rel, 1)} ao mês (regressão linear). "
                             f"Melhor mês: {_month_label(best_m, True)} ({fmtv(float(mon.max()))}); pior: {_month_label(worst_m, True)} ({fmtv(float(mon.min()))}).",
                        "ev": f"{'+' if rel > 0 else ''}{_fmt_pct(rel, 1)}/mês", "conf": 85 if len(mon) >= 6 else 70, "chart": chart})
            facts.append(f"Tendência mensal de {value}: {direction} ({_fmt_pct(rel, 1)} ao mês); melhor mês {_month_label(best_m, True)}, pior {_month_label(worst_m, True)}.")
            if (rel < -2 and not inverse) or (rel > 2 and inverse):
                out.append({"cat": "risk", "risk": True, "t": f"{value} em {'alta' if inverse else 'queda'}", "tag": "Tendência",
                            "d": f"A linha de tendência {'sobe' if inverse else 'cai'} cerca de {_fmt_pct(abs(rel), 1)} por mês. Vale investigar o que mudou nos meses mais recentes.",
                            "ev": f"{_fmt_pct(rel, 1)}/mês", "conf": 80, "chart": chart})
        split = _period_split(df, date, value)
        if split:
            mid, span = split
            older, recent = df[df[date] < mid], df[df[date] >= mid]
            prev_s, cur_s = float(older[value].sum()), float(recent[value].sum())
            if prev_s:
                delta = (cur_s - prev_s) / abs(prev_s) * 100
                facts.append(f"Metade recente do período vs anterior: {_fmt_pct(delta, 1)} em {value}.")
            for pr in cats[:3]:
                dim = pr["name"]
                a = older.groupby(dim)[value].sum()
                b = recent.groupby(dim)[value].sum()
                if mixed_sign:
                    # Só grupos que somam positivo nas duas metades (receitas).
                    ok_k = a.index.union(b.index)
                    ok_k = [k for k in ok_k if a.get(k, 0) >= 0 and b.get(k, 0) >= 0]
                    a, b = a.reindex([k for k in ok_k if k in a.index]), b.reindex([k for k in ok_k if k in b.index])
                diff = b.subtract(a, fill_value=0).sort_values()
                if len(diff) < 2:
                    continue
                up_k, up_v = diff.index[-1], float(diff.iloc[-1])
                dn_k, dn_v = diff.index[0], float(diff.iloc[0])
                if up_v > 0 and "alta" not in highlights:
                    highlights["alta"] = {"l": "Maior alta", "v": "+" + fmtv(up_v), "s": f"{_short(up_k, 16)} · {_short(dim, 12)}", "d": "up", "c": good}
                    base_a = float(a.get(up_k, 0))
                    rise = {"cat": "trend", "t": f'"{_short(up_k, 30)}" é a maior alta em {dim}', "tag": dim,
                            "d": f"Na metade mais recente do período, somou {fmtv(up_v)} a mais que na anterior"
                                 + (f" ({'+' if base_a else ''}{_fmt_pct(up_v / base_a * 100, 0)})." if base_a > 0 else "."),
                            "ev": "+" + fmtv(up_v), "conf": 82}
                    if inverse:
                        rise.update(cat="risk", risk=True)
                    out.append(rise)
                    up_chart = {"type": "bar", "title": f"{value} por {dim} (metade recente)", "dim": dim, "agg": "sum",
                                "sort": "value_desc", "data": _topk_other(b.sort_values(ascending=False))}
                    if inverse:
                        out.append({"cat": "action", "t": f'Conter o aumento de "{_short(up_k, 30)}"', "tag": "Atenção",
                                    "d": f"É o item de {dim} em que {value} mais subiu. Vale revisar contratos, volumes e causas com quem é responsável por ele.",
                                    "ev": "+" + fmtv(up_v), "conf": 75, "chart": up_chart})
                    else:
                        out.append({"cat": "action", "t": f'Aproveitar o crescimento de "{_short(up_k, 30)}"', "tag": "Crescimento",
                                    "d": f"É o item de {dim} que mais cresceu. Reforçar estoque, verba ou atenção nele tende a render mais no curto prazo.",
                                    "ev": "+" + fmtv(up_v), "conf": 75, "chart": up_chart})
                    facts.append(f"Maior alta em {dim}: {up_k} (+{fmtv(up_v)}).")
                if dn_v < 0 and "queda" not in highlights:
                    base_a = float(a.get(dn_k, 0))
                    pct = (dn_v / base_a * 100) if base_a > 0 else None
                    highlights["queda"] = {"l": "Maior queda", "v": "−" + fmtv(abs(dn_v)), "s": f"{_short(dn_k, 16)} · {_short(dim, 12)}", "d": "down", "c": bad}
                    fall = {"cat": "risk", "risk": True, "t": f'"{_short(dn_k, 30)}" é a maior queda em {dim}', "tag": dim,
                            "d": f"Na metade mais recente do período, somou {fmtv(abs(dn_v))} a menos que na anterior"
                                 + (f" ({_fmt_pct(pct, 0)})." if pct is not None else "."),
                            "ev": "−" + fmtv(abs(dn_v)), "conf": 82}
                    if inverse:
                        fall.update(cat="trend", risk=False)
                    out.append(fall)
                    if not inverse:
                        out.append({"cat": "action", "t": f'Investigar a queda de "{_short(dn_k, 30)}"', "tag": "Atenção",
                                    "d": f"Compare preço, disponibilidade e canais de \"{_short(dn_k, 30)}\" entre os dois períodos para achar a causa.",
                                    "ev": "−" + fmtv(abs(dn_v)), "conf": 72})
                    facts.append(f"Maior queda em {dim}: {dn_k} (-{fmtv(abs(dn_v))}).")
                # Mudança de mix: participação no total, metade antiga x recente.
                idx = a.index.union(b.index)
                sa = a.reindex(idx, fill_value=0)
                sb = b.reindex(idx, fill_value=0)
                if sa.sum() > 0 and sb.sum() > 0 and len(idx) >= 2:
                    sha, shb = sa / sa.sum() * 100, sb / sb.sum() * 100
                    pp = (shb - sha)
                    kmax = max(idx, key=lambda i: (round(abs(float(pp[i])), 6), float(pp[i]) > 0))
                    if abs(pp[kmax]) >= 5 and not any(o.get("tag") == "Mix" for o in out):
                        out.append({"cat": "trend", "t": f'Participação de "{_short(kmax, 26)}" {"subiu" if pp[kmax] > 0 else "caiu"}', "tag": "Mix",
                                    "d": f"Em {dim}, \"{_short(kmax, 26)}\" foi de {_fmt_pct(float(sha[kmax]), 1)} para {_fmt_pct(float(shb[kmax]), 1)} do total "
                                         f"entre a metade antiga e a recente do período.",
                                    "ev": f"{'+' if pp[kmax] > 0 else ''}{_fmt_num(float(pp[kmax]), 1)} p.p.", "conf": 80})
                        facts.append(f"Mix em {dim}: {kmax} foi de {_fmt_pct(float(sha[kmax]), 1)} para {_fmt_pct(float(shb[kmax]), 1)} do total.")
                    new_items = [str(i) for i in idx if sa[i] == 0 and shb[i] >= 2]
                    gone_items = [str(i) for i in idx if sb[i] == 0 and sha[i] >= 2]
                    if new_items and not any(o.get("tag") == "Novidade" for o in out):
                        out.append({"cat": "trend", "t": f"Novo(s) em {dim}: " + ", ".join(_short(x, 20) for x in new_items[:3]), "tag": "Novidade",
                                    "d": "Só aparecem na metade mais recente do período e já somam pelo menos 2% do total.", "ev": f"{len(new_items)} item(ns)", "conf": 78})
                    if gone_items and not any(o.get("tag") == "Sumiu" for o in out):
                        out.append({"cat": "risk", "risk": True, "t": f"Sumiram de {dim}: " + ", ".join(_short(x, 20) for x in gone_items[:3]), "tag": "Sumiu",
                                    "d": "Tinham pelo menos 2% do total na metade antiga do período e não aparecem na recente.", "ev": f"{len(gone_items)} item(ns)", "conf": 78})
        # Dia da semana (só com granularidade diária e ≥ 4 semanas).
        by_date = by[date]
        if by_date.get("dateInfo", {}).get("granularity") == "day":
            d = df[[date, value]].dropna()
            if len(d) and (d[date].max() - d[date].min()).days >= 28:
                wd = d.groupby(d[date].dt.dayofweek)[value].sum().reindex(range(7), fill_value=0)
                mean = wd.mean()
                if mean:
                    best = int(wd.idxmax())
                    lift = (float(wd.max()) - mean) / mean * 100
                    if lift >= 15:
                        out.append({"cat": "outlier", "t": f"{DIAS_SEMANA[best].capitalize()} concentra o movimento", "tag": "Sazonalidade",
                                    "d": f"O total de {value} às {DIAS_SEMANA[best]}s fica {_fmt_pct(lift)} acima da média dos dias da semana.",
                                    "ev": f"+{_fmt_pct(lift)} vs média", "conf": 78,
                                    "chart": {"type": "bar", "title": f"{value} por dia da semana", "dim": date, "agg": "sum", "sort": "natural",
                                              "data": [{"l": DIAS_SEMANA[i][:3].capitalize(), "v": _r(v)} for i, v in wd.items()]}})
                        out.append({"cat": "action", "t": f"Concentrar ações às {DIAS_SEMANA[best]}s", "tag": "Calendário",
                                    "d": f"Campanhas, escalas e reposição alinhadas ao dia de maior movimento aproveitam melhor a demanda.",
                                    "ev": f"+{_fmt_pct(lift)}", "conf": 70})
                        facts.append(f"Dia da semana mais forte: {DIAS_SEMANA[best]} (+{_fmt_pct(lift)} vs média).")

    # 3) Medidas não aditivas: média por categoria (ex.: salário médio por departamento).
    for pr in profiles:
        if pr.get("schemaType") != "measure" or pr["pattern"] in ("percent",):
            continue
        if pr["name"] == value:
            continue
        if not cats or len([o for o in out if o.get("tag") == "Média"]) >= 2:
            break
        # Dimensão que MAIS explica a medida (η² ajustado), não a primeira da lista.
        scored = [(e, c["name"]) for c in cats[:8] for e in [_eta2_adj(df, c["name"], pr["name"])] if e is not None]
        if not scored:
            continue
        eta, dim = max(scored)
        if eta < 0.05:
            continue
        g = df.groupby(dim)[pr["name"]].mean().dropna().sort_values(ascending=False)
        if len(g) < 2:
            continue
        overall = float(df[pr["name"]].mean())
        if not overall:
            continue
        hi_k, hi_v = g.index[0], float(g.iloc[0])
        lo_k, lo_v = g.index[-1], float(g.iloc[-1])
        gap = (hi_v - lo_v) / abs(overall) * 100
        if gap < 10:
            continue
        m = pr["pattern"] == "monetary" or pr.get("semantic") == "money"
        out.append({"cat": "comparison", "t": f"{pr['name']} médio varia por {dim}", "tag": "Média",
                    "d": f"\"{_short(hi_k, 24)}\" tem a maior média ({_fmt_compact(hi_v, m)}) e \"{_short(lo_k, 24)}\" a menor ({_fmt_compact(lo_v, m)}); "
                         f"a média geral é {_fmt_compact(overall, m)}. {dim} explica {_fmt_pct(eta * 100)} da variação de {pr['name']}.",
                    "ev": f"{_fmt_pct(gap)} de diferença", "conf": 84,
                    "chart": {"type": "bar", "title": f"Média de {pr['name']} por {dim}", "dim": dim, "agg": "avg", "sort": "value_desc",
                              "data": [{"l": _short(i, 14), "v": _r(v)} for i, v in g.iloc[:8].items()]}})
        facts.append(f"Média de {pr['name']} por {dim}: maior {hi_k} ({_fmt_compact(hi_v, m)}), menor {lo_k} ({_fmt_compact(lo_v, m)}).")

    # 4) Booleanos e escalas (pesquisas, cadastros).
    for pr in profiles:
        if pr["pattern"] == "boolean":
            col = df[pr["name"]].dropna().astype(str).str.lower()
            if len(col):
                pos = col.isin(POS_TOKENS).mean() * 100
                out.append({"cat": "comparison", "t": f"{_fmt_pct(pos)} positivo em {pr['name']}", "tag": "Sim/Não",
                            "d": f"Proporção de respostas positivas em {pr['name']} ({_fmt_num(len(col))} respostas).", "ev": _fmt_pct(pos), "conf": 90})
                facts.append(f"{pr['name']}: {_fmt_pct(pos)} positivo.")
        elif pr["pattern"] == "scale":
            s = df[pr["name"]].dropna()
            if len(s):
                lo, hi = pr["hints"]["scaleRange"]
                txt = f"Média {_fmt_num(float(s.mean()), 1)} numa escala de {_fmt_num(lo)} a {_fmt_num(hi)}."
                if hi == 10 and lo in (0, 1):
                    prom, det = (s >= 9).mean() * 100, (s <= 6).mean() * 100
                    txt += f" Promotores (9-10): {_fmt_pct(prom)}; detratores (0-6): {_fmt_pct(det)}; NPS {_fmt_num(prom - det)}."
                out.append({"cat": "trend", "t": f"Média de {pr['name']}: {_fmt_num(float(s.mean()), 1)}", "tag": "Escala",
                            "d": txt, "ev": f"{_fmt_num(float(s.mean()), 1)} / {_fmt_num(hi)}", "conf": 85})
                facts.append(f"{pr['name']}: {txt}")

    # 5) Correlação entre medidas (exclui relações exatas tipo total = qtd × preço).
    meas = [pr["name"] for pr in profiles if pr.get("schemaType") == "measure"][:10]
    related = {frozenset((c, a)) for c, a, _ in quality["_relations"]} | {frozenset((c, b)) for c, _, b in quality["_relations"]}
    if len(meas) >= 2 and len(df) >= 20:
        corr = df[meas].corr(numeric_only=True, min_periods=20)
        seen = 0
        for i, a in enumerate(meas):
            for b in meas[i + 1:]:
                r = corr.loc[a, b]
                common = df[[a, b]].dropna()
                if len(common) >= 5 and np.array_equal(common[a].to_numpy(), common[b].to_numpy()):
                    out.append({"cat": "risk", "risk": True, "t": f"{a} e {b} são idênticas", "tag": "Qualidade",
                                "d": "As duas colunas têm exatamente os mesmos valores. Se for cópia, some uma delas para não contar duas vezes.",
                                "ev": f"{_fmt_num(len(common))} linhas iguais", "conf": 92})
                    continue
                if pd.notna(r) and abs(r) >= 0.7 and frozenset((a, b)) not in related and seen < 2:
                    seen += 1
                    out.append({"cat": "comparison", "t": f"{a} e {b} andam juntos" if r > 0 else f"{a} sobe quando {b} cai",
                                "tag": "Correlação", "d": f"Correlação de {_fmt_num(float(r), 2)} entre as duas colunas (Pearson). Correlação não prova causa.",
                                "ev": f"r = {_fmt_num(float(r), 2)}", "conf": 76})

    # 6) Forma da distribuição do valor e o que mais explica a variação dele.
    if value:
        st = by[value]["stats"]
        n_val = int(df[value].notna().sum())
        if n_val >= 30 and (st.get("skew") or 0) > 1 and st.get("median") and st["avg"] / st["median"] > 1.3:
            out.append({"cat": "outlier", "t": f"Poucos valores altos puxam a média de {value}", "tag": "Distribuição",
                        "d": f"A média por linha é {fmtv(st['avg'])}, mas a mediana é {fmtv(st['median'])}: metade das linhas fica abaixo disso. "
                             "Para falar do valor \"típico\", a mediana representa melhor.",
                        "ev": f"média {_fmt_num(st['avg'] / st['median'], 1)}× a mediana", "conf": 80})
            facts.append(f"{value}: média por linha {fmtv(st['avg'])}, mediana {fmtv(st['median'])} (distribuição assimétrica).")
        drivers = [(e, c["name"]) for c in cats[:8] for e in [_eta2_adj(df, c["name"], value)] if e is not None]
        if drivers:
            e, dname = max(drivers)
            if e >= 0.1:
                facts.append(f"{dname} explica {_fmt_pct(e * 100)} da variação de {value} por linha.")

    # 7) Outliers no valor.
    if value:
        o = _outliers(df[value])
        if o and o["count"]:
            where = " e ".join(x for x in (f"{o['up']} acima de {fmtv(o['high'])}" if o["up"] else "",
                                            f"{o['down']} abaixo de {fmtv(o['low'])}" if o["down"] else "") if x)
            out.append({"cat": "outlier", "t": f"{o['count']} valor(es) fora da curva em {value}", "tag": "Outlier",
                        "d": f"{where[0].upper() + where[1:]} (3× o intervalo interquartil). Confira se são lançamentos reais ou erro de digitação antes de decidir com base no total.",
                        "ev": f"{o['count']} de {_fmt_num(len(df))} linhas", "conf": 80})
            facts.append(f"Outliers em {value}: {where}.")
        neg = int((df[value] < 0).sum())
        if neg:
            out.append({"cat": "risk", "risk": True, "t": f"{neg} valor(es) negativo(s) em {value}", "tag": "Qualidade",
                        "d": "Podem ser devoluções ou estornos. Eles reduzem o total; confira se devem entrar na soma.",
                        "ev": f"{neg} linhas", "conf": 78})

    # 8) Qualidade dos dados.
    for pr in profiles:
        nr = pr["stats"]["nullRatio"]
        if nr >= 0.1 and pr["pattern"] != "empty":
            out.append({"cat": "risk", "risk": True, "t": f"Dados faltando em {pr['name']}", "tag": "Qualidade",
                        "d": f"{_fmt_pct(nr * 100)} das linhas estão sem valor nesta coluna; médias e rankings dela podem ficar enviesados.",
                        "ev": f"{_fmt_num(pr['stats']['nullCount'])} vazias", "conf": 85})
            out.append({"cat": "action", "t": f"Completar {pr['name']} na origem", "tag": "Qualidade",
                        "d": f"Preencher as {_fmt_num(pr['stats']['nullCount'])} células vazias de {pr['name']} deixa as próximas análises mais confiáveis.",
                        "ev": f"{_fmt_pct(nr * 100)} vazio", "conf": 70})
            break
    for pr in profiles:
        if pr.get("coerced"):
            out.append({"cat": "risk", "risk": True, "t": f"Valores ilegíveis em {pr['name']}", "tag": "Qualidade",
                        "d": f"{_fmt_num(pr['coerced'])} célula(s) não puderam ser lidas como {'data' if pr['pattern'] == 'datetime' else 'número'} e ficaram de fora dos cálculos.",
                        "ev": f"{_fmt_num(pr['coerced'])} células", "conf": 85})
    if quality["duplicateRows"]:
        out.append({"cat": "risk", "risk": True, "t": f"{_fmt_num(quality['duplicateRows'])} linha(s) repetida(s)", "tag": "Qualidade",
                    "d": "Linhas idênticas em todas as colunas. Se forem lançamentos duplicados, inflam os totais. Elas foram mantidas.",
                    "ev": f"{_fmt_num(quality['duplicateRows'])} linhas", "conf": 75})
    if quality["totalRowsRemoved"]:
        out.append({"cat": "risk", "t": "Linha de total removida", "tag": "Qualidade", "risk": False,
                    "d": f"{quality['totalRowsRemoved']} linha(s) de TOTAL/SUBTOTAL do arquivo foram ignoradas para não somar duas vezes.",
                    "ev": f"{quality['totalRowsRemoved']} linha(s)", "conf": 90})

    coverage = (1 - df.isna().to_numpy().mean()) * 100 if df.size else 0
    highlights.setdefault("cobertura", {"l": "Cobertura", "v": _fmt_pct(coverage), "s": "Células preenchidas", "d": "flat", "c": "#7a5cff"})
    order = ["alta", "queda", "concentracao", "cobertura"]
    hl = [highlights[k] for k in order if k in highlights]
    if len(hl) < 4:
        hl.append({"l": "Registros", "v": _fmt_num(len(df)), "s": f"{len(profiles)} colunas", "d": "flat", "c": "var(--brand)"})
    return out, hl[:4], facts


def _redact(text):
    """Defesa extra (LGPD): mesmo que uma coluna escape da detecção de dado
    pessoal, e-mail/CPF/CNPJ/telefone nunca saem num texto do motor, que vira
    fato para a IA."""
    return PII_SEARCH.sub("[dado pessoal]", text) if isinstance(text, str) else text


def _redact_output(insights, highlights, facts):
    for it in insights:
        for k in ("t", "d", "ev"):
            it[k] = _redact(it.get(k))
        ch = it.get("chart")
        if ch:
            ch["title"] = _redact(ch.get("title"))
            for pt in ch.get("data", []):
                pt["l"] = _redact(pt.get("l"))
    for h in highlights:
        h["s"] = _redact(h.get("s"))
    return insights, highlights, [_redact(f) for f in facts]


def _summary(df, profiles, roles, insights):
    value, date = roles["value"], roles["date"]
    parts = [f"A base tem {_fmt_num(len(df))} linhas e {len(profiles)} colunas"]
    if date:
        d = df[date].dropna()
        if len(d):
            parts[0] += f", de {d.min().strftime('%d/%m/%Y')} a {d.max().strftime('%d/%m/%Y')}"
    parts[0] += "."
    if value:
        money = roles["_by"][value]["pattern"] == "monetary"
        parts.append(f"O total de {value} é {_fmt_compact(float(df[value].sum()), money)}.")
    for it in insights:
        if it["cat"] in ("comparison", "trend") and len(parts) < 4:
            parts.append(it["t"].rstrip(".") + ".")
    risks = [it for it in insights if it.get("risk")]
    if risks:
        parts.append("Ponto de atenção: " + risks[0]["t"][0].lower() + risks[0]["t"][1:].rstrip(".") + ".")
    return " ".join(parts)


# ─────────────────────────── orquestração ───────────────────────────

def _profile_frame(raw_df, ctx):
    """Perfila cada coluna e monta o DataFrame tipado para a análise."""
    profiles, typed = [], {}
    for c in raw_df.columns:
        pr, vals = _profile_column(c, raw_df[c].tolist(), ctx)
        profiles.append(pr)
        typed[c] = vals
    df = pd.DataFrame({
        pr["name"]: (pd.to_datetime(pd.Series(typed[pr["name"]], dtype=object), errors="coerce") if pr["schemaType"] == "date"
                     else pd.to_numeric(pd.Series(typed[pr["name"]], dtype=object), errors="coerce") if pr["schemaType"] == "measure"
                     else pd.Series(typed[pr["name"]], dtype=object))
        for pr in profiles
    })
    return profiles, df


def analyze(payload):
    kind = payload.get("kind", "matrix")
    native_numeric = set()
    if kind == "json":
        matrix, native_numeric = _matrix_from_json(payload.get("text", ""))
    else:
        matrix = payload.get("matrix") or []
    matrix = _clean_matrix(matrix)
    if len(matrix) < 2:
        raise ValueError("não encontrei cabeçalho e linhas de dados no arquivo.")
    rows_in = len(matrix) - 1

    h = _detect_header(matrix) if kind != "json" else 0
    raw_header = matrix[h]
    body = matrix[h + 1:]
    width = max(len(raw_header), max((len(r) for r in body), default=0))
    raw_header = list(raw_header) + [None] * (width - len(raw_header))
    body = [list(r) + [None] * (width - len(r)) for r in body]
    header = _clean_header(raw_header)
    # Cabeçalho repetido no meio (relatórios colados um embaixo do outro).
    lowered_header = [x.lower() if x else x for x in raw_header]
    repeated = [r for r in body if [c.lower() if c else c for c in r] == lowered_header]
    if repeated:
        body = [r for r in body if [c.lower() if c else c for c in r] != lowered_header]

    raw_df = pd.DataFrame(body, columns=header, dtype=object)
    empty_cols = [c for c in raw_df.columns if raw_df[c].isna().all() and c.startswith("coluna_")]
    raw_df = raw_df.drop(columns=empty_cols)
    raw_df = raw_df.dropna(how="all").reset_index(drop=True)
    if raw_df.empty or not len(raw_df.columns):
        raise ValueError("o arquivo não tem linhas de dados depois do cabeçalho.")

    # Totais e rodapé saem antes de tipar (senão contaminam tipos e estatísticas).
    raw_df, total_rows, footer_rows = _drop_total_rows_raw(raw_df)
    if raw_df.empty:
        raise ValueError("o arquivo não tem linhas de dados depois do cabeçalho.")

    dataset_decimal = _dataset_decimal(raw_df, native_numeric)
    ctx = {"decimal": dataset_decimal, "native_numeric": native_numeric}
    profiles, df = _profile_frame(raw_df, ctx)
    pos = _unlabeled_total_row(df, profiles)
    if pos is not None:
        raw_df = raw_df.drop(index=raw_df.index[pos]).reset_index(drop=True)
        profiles, df = _profile_frame(raw_df, ctx)
        total_rows += 1
    measures = [pr["name"] for pr in profiles if pr["schemaType"] == "measure"]
    relations = _detect_products(df, measures) if len(df) >= 5 else []
    totals = {c for c, _, _ in relations}
    for c, a, b in relations:
        for f in (a, b):
            pf = next(p for p in profiles if p["name"] == f)
            if f not in totals and not QTY_NAME.search(f.lower()):
                pf["additive"] = False
                pf["semantic"] = "unit_price"
        pc = next(p for p in profiles if p["name"] == c)
        pc["additive"] = True
        pc["semantic"] = "total"

    value = _choose_value(profiles, relations)
    roles = _role_columns(profiles, value)
    has_sales_dim = any(SALES_DIM.search(pr["name"]) for pr in profiles if pr["schemaType"] == "dimension")
    sales_shape = bool(value and roles["date"] and (SALES_VALUE.search(value) or has_sales_dim))

    dup = int(df.astype(str).duplicated().sum()) if len(df) else 0
    quality = {
        "rowsIn": rows_in, "rowsOut": int(len(df)), "headerRow": h + 1,
        "titleRowsSkipped": h, "repeatedHeaderRows": len(repeated),
        "emptyColumnsDropped": len(empty_cols), "totalRowsRemoved": total_rows, "footerRowsRemoved": footer_rows,
        "duplicateRows": dup, "renamedHeaders": [x for x, y in zip(header, raw_header) if (y or "") != x],
        "coercedCells": {pr["name"]: pr["coerced"] for pr in profiles if pr.get("coerced")},
        "mergedVariants": {pr["name"]: pr["mergedVariants"] for pr in profiles if pr.get("mergedVariants")},
        "piiColumns": [pr["name"] for pr in profiles if pr.get("pii")],
        "_relations": relations,
    }
    insights, highlights, facts = _redact_output(*_insights(df, profiles, roles, quality))
    summary = _redact(_summary(df, profiles, roles, insights))
    quality.pop("_relations")
    quality["relations"] = [{"total": c, "a": a, "b": b} for c, a, b in relations]

    # Saída: colunas tipadas (datas ISO) e schema/perfis no formato do front.
    columns = {}
    for pr in profiles:
        s = df[pr["name"]]
        if pr["schemaType"] == "date":
            col = s.dt.strftime("%Y-%m-%d")
        elif pr["schemaType"] == "measure":
            s = s.where(np.isfinite(s.to_numpy(dtype="float64", na_value=np.nan)))
            col = s
        else:
            col = s.astype(object)
        columns[pr["name"]] = col.astype(object).where(col.notna(), None).tolist()
    schema = []
    for pr in profiles:
        vals = [v for v in columns[pr["name"]] if v is not None]
        schema.append({
            "name": pr["name"], "type": pr["schemaType"],
            "examples": [str(x) for x in pr["stats"]["sampleValues"]],
            "uniqCount": pr["stats"]["uniqueCount"], "nullCount": int(len(df) - len(vals)),
            "isValue": pr["name"] == value, "engine": "pandas",
        })
    for pr in profiles:
        pr.pop("schemaType", None)
    return {
        "ok": True, "engine": "pandas", "engineVersion": ENGINE_VERSION, "pandasVersion": pd.__version__,
        "header": [pr["name"] for pr in profiles], "rows": int(len(df)),
        "schema": schema, "profiles": profiles, "columns": columns,
        "roles": {k: v for k, v in roles.items() if not k.startswith("_")},
        "salesShape": sales_shape, "quality": quality,
        "insights": insights, "highlights": highlights, "summary": summary, "facts": facts[:30],
    }


def _json_default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return _finite(o)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    if isinstance(o, (pd.Timestamp,)):
        return o.strftime("%Y-%m-%d")
    if isinstance(o, (set, frozenset)):
        return list(o)
    return str(o)


def _sanitize(o):
    if isinstance(o, float):
        return o if math.isfinite(o) else None
    if isinstance(o, dict):
        return {k: _sanitize(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_sanitize(v) for v in o]
    return o


def run(payload_json):
    """Ponto de entrada do worker: JSON in, JSON out. Nunca lança — o front
    cai para o motor JavaScript se "ok" vier falso."""
    try:
        result = analyze(json.loads(payload_json))
    except ValueError as e:
        return json.dumps({"ok": False, "error": str(e), "kind": "input"}, ensure_ascii=False)
    except Exception as e:  # noqa: BLE001 — qualquer falha interna vira fallback, não tela branca
        return json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}", "kind": "internal"}, ensure_ascii=False)
    cols = result.pop("columns", None)
    result = _sanitize(result)
    result["columns"] = cols  # já sai sem NaN/inf (vetorizado em analyze)
    return json.dumps(result, ensure_ascii=False, default=_json_default, allow_nan=False)
