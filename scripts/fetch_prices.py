"""Récupère chaque jour les cours des titres listés dans titres.txt (un ISIN ou un symbole par ligne)
et les écrit dans cours.json, que l'appli lit. Aucune donnée personnelle : seulement des cours de marché.
Source : Yahoo Finance (non officielle, sans clé)."""
import json, time, urllib.request, urllib.parse, datetime, sys

UA = {"User-Agent": "Mozilla/5.0 (compatible; mon-patrimoine/1.0)"}
PREF = [".PA", ".DE", ".AS", ".MI", ".F", ".BR", ".MC", ""]  # places européennes d'abord, puis US

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)

def resolve(code):
    """ISIN -> symbole Yahoo coté en EUR ou USD. Un code qui n'est pas un ISIN est pris tel quel."""
    if len(code) != 12 or not code[:2].isalpha():
        return code
    q = get("https://query2.finance.yahoo.com/v1/finance/search?" + urllib.parse.urlencode({"q": code, "quotesCount": 10, "newsCount": 0}))
    syms = [x["symbol"] for x in q.get("quotes", []) if x.get("symbol")]
    for suf in PREF:
        for s in syms:
            if (suf and s.endswith(suf)) or (not suf and "." not in s):
                return s
    return syms[0] if syms else None

def chart(sym):
    j = get(f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?range=1y&interval=1d")
    r = j["chart"]["result"][0]
    meta, ts = r["meta"], r.get("timestamp", [])
    closes = r["indicators"]["quote"][0]["close"]
    hist = [[datetime.date.fromtimestamp(t).isoformat(), round(c, 4)] for t, c in zip(ts, closes) if c is not None]
    return {"symbol": sym, "currency": meta.get("currency"), "price": meta.get("regularMarketPrice"),
            "prev": meta.get("chartPreviousClose") if len(hist) < 2 else hist[-2][1], "closes": hist}

def main():
    codes = [l.split("#")[0].strip() for l in open("titres.txt", encoding="utf-8")]
    codes = [c for c in codes if c]
    out = {"updated": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z", "fx": {}, "titres": {}, "errors": {}}
    try:
        out["fx"]["USDEUR"] = round(1 / chart("EURUSD=X")["price"], 6)
    except Exception as e:
        out["errors"]["USDEUR"] = str(e)
    for c in codes:
        try:
            sym = resolve(c)
            if not sym:
                raise ValueError("symbole introuvable")
            out["titres"][c] = chart(sym)
        except Exception as e:
            out["errors"][c] = str(e)
        time.sleep(1)
    json.dump(out, open("cours.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"{len(out['titres'])} titres OK, {len(out['errors'])} erreurs: {out['errors']}")

if __name__ == "__main__":
    main()
