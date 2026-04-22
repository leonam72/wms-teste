from __future__ import annotations

import csv
import json
import argparse
import random
import re
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from lxml import etree


BASE_DIR = Path(__file__).resolve().parent
TEMPLATE_PATH = BASE_DIR / "exemplo_nfe.xml"
PRODUCTS_CSV_PATH = BASE_DIR / "WMS_Alocacao__CADASTRO_PRODUTOS.csv"
OUTPUT_DIR = BASE_DIR / "nfe_xml"
SEED = 20250321
Q = Decimal("0.01")


@dataclass
class Product:
    code: str
    name: str
    ncm: str
    cfop: str
    unit: str = "UN"


@dataclass
class Customer:
    name: str
    cpf: str


def money(value: Decimal) -> str:
    return str(value.quantize(Q, rounding=ROUND_HALF_UP))


def qty4(value: int) -> str:
    return f"{Decimal(value).quantize(Decimal('0.0001'))}"


def text_or_empty(value: object) -> str:
    return "" if value is None else str(value).strip()


def only_digits(value: str) -> str:
    return re.sub(r"\D+", "", value or "")


def load_products() -> list[Product]:
    with PRODUCTS_CSV_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
      reader = csv.DictReader(handle)
      field_map = {field.lower(): field for field in (reader.fieldnames or [])}
      desc_key = next((field_map[key] for key in field_map if "descr" in key), None)
      if not desc_key:
          raise RuntimeError("Nao foi encontrada coluna de descricao no CSV de produtos.")
      products: list[Product] = []
      for index, row in enumerate(reader, start=1):
          name = text_or_empty(row.get(desc_key))
          if not name:
              continue
          products.append(Product(
              code=f"{index:06d}",
              name=name,
              ncm="22030000",
              cfop="5102",
          ))
      if not products:
          raise RuntimeError("Nenhum produto valido encontrado no CSV.")
      return products


def calc_mod11_dv(key43: str) -> str:
    weights = [2, 3, 4, 5, 6, 7, 8, 9]
    total = 0
    weight_index = 0
    for digit in reversed(key43):
        total += int(digit) * weights[weight_index]
        weight_index = (weight_index + 1) % len(weights)
    mod = total % 11
    dv = 11 - mod
    return "0" if dv >= 10 else str(dv)


def random_cpf(rng: random.Random) -> str:
    nums = [rng.randint(0, 9) for _ in range(9)]
    for factor in (10, 11):
        total = sum(n * (factor - idx) for idx, n in enumerate(nums))
        digit = 11 - (total % 11)
        nums.append(0 if digit >= 10 else digit)
    return "".join(str(n) for n in nums)


def make_customer_pool(rng: random.Random, size: int = 28) -> list[Customer]:
    prefixes = ["CLIENTE", "COMERCIAL", "MAGAZINE", "ATELIE", "BOUTIQUE", "GRUPO", "CASA", "LOJA"]
    suffixes = ["ALFA", "PRIMAVERA", "CENTRAL", "MODELO", "NORTE", "SUL", "LITORAL", "BRASIL", "TOP", "IDEAL"]
    pool: list[Customer] = []
    for idx in range(1, size + 1):
        left = rng.choice(prefixes)
        right = rng.choice(suffixes)
        name = f"{left} TESTE {right} {idx}"
        pool.append(Customer(name=name, cpf=random_cpf(rng)))
    return pool


def choose_customer(customer_pool: list[Customer], rng: random.Random) -> Customer:
    # viés forte para clientes recorrentes
    weights = [max(2, len(customer_pool) - idx) for idx in range(len(customer_pool))]
    return rng.choices(customer_pool, weights=weights, k=1)[0]


def issue_datetime_for_note(index: int, rng: random.Random) -> datetime:
    # cria janelas com cluster para parecer operação real ao longo do ano
    month = min(12, 1 + ((index - 1) // 20))
    day = rng.randint(1, 26)
    hour = rng.choice([8, 9, 10, 11, 13, 14, 15, 16, 17, 18])
    minute = rng.randint(0, 59)
    return datetime(2025, month, day, hour, minute, 0) + timedelta(minutes=rng.randint(0, 25))


def choose_note_products(products: list[Product], rng: random.Random) -> list[Product]:
    item_count = rng.choices([1, 2, 3, 4, 5, 6], weights=[18, 22, 20, 16, 14, 10], k=1)[0]
    hot_band = max(20, len(products) // 12)
    warm_band = max(60, len(products) // 5)
    chosen: list[Product] = []
    seen: set[str] = set()
    for _ in range(item_count):
        roll = rng.random()
        if roll < 0.55:
            source = products[:hot_band]
        elif roll < 0.85:
            source = products[:warm_band]
        else:
            source = products
        candidate = rng.choice(source)
        while candidate.code in seen:
            candidate = rng.choice(source)
        seen.add(candidate.code)
        chosen.append(candidate)
    return chosen


def sample_quantity(rng: random.Random) -> int:
    return rng.choices(
        [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 20, 24, 30, 36, 40],
        weights=[6, 8, 10, 12, 12, 10, 10, 10, 8, 8, 6, 6, 4, 3, 2, 1],
        k=1,
    )[0]


def sample_unit_price(rng: random.Random) -> Decimal:
    bucket = rng.random()
    if bucket < 0.55:
        value = rng.uniform(9, 49)
    elif bucket < 0.85:
        value = rng.uniform(50, 139)
    else:
        value = rng.uniform(140, 300)
    return Decimal(str(value)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def ensure_child(parent: etree._Element, tag: str, ns: str, after_tag: str | None = None) -> etree._Element:
    node = parent.find(f"{{{ns}}}{tag}")
    if node is not None:
        return node
    node = etree.Element(f"{{{ns}}}{tag}")
    if after_tag:
        siblings = list(parent)
        for idx, child in enumerate(siblings):
            if etree.QName(child).localname == after_tag:
                parent.insert(idx + 1, node)
                return node
    parent.append(node)
    return node


def required(parent: etree._Element, path: str, nsmap: dict[str, str]) -> etree._Element:
    node = parent.find(path, namespaces=nsmap)
    if node is None:
        raise RuntimeError(f"Tag obrigatoria ausente no template: {path}")
    return node


def build_viewer_html() -> str:
    return """<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visualizador NF-e</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; background: #f0f2f5; color: #1a2030; }
    .shell { display: grid; grid-template-columns: minmax(420px, 0.95fr) minmax(0, 1.35fr); gap: 16px; padding: 16px; height: 100vh; box-sizing: border-box; }
    .panel { background: #fff; border: 1px solid #d0d6e0; display: flex; flex-direction: column; min-height: 0; }
    .panel-head { padding: 14px 16px; border-bottom: 1px solid #d0d6e0; display: flex; flex-direction: column; gap: 10px; }
    .panel-title { font-size: 20px; font-weight: 700; color: #0066cc; }
    .sub { font-size: 12px; color: #5a6478; }
    input { min-height: 38px; border: 1px solid #d0d6e0; padding: 8px 10px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px; border-bottom: 1px solid #e3e7ef; text-align: left; vertical-align: top; }
    th { position: sticky; top: 0; background: #f7f9fc; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #5a6478; }
    tbody tr:hover { background: #f7fbff; }
    .table-wrap, .detail-body, .xml-box { overflow: auto; min-height: 0; }
    .btn { border: 1px solid #d0d6e0; background: #fff; color: #1a2030; padding: 7px 10px; cursor: pointer; font-size: 12px; }
    .btn.primary { background: #0066cc; border-color: #0066cc; color: #fff; }
    .detail-body { padding: 16px; display: grid; gap: 16px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
    .kpi { border: 1px solid #d0d6e0; background: #f7f9fc; padding: 12px; }
    .kpi-label { font-size: 10px; text-transform: uppercase; color: #5a6478; font-weight: 700; letter-spacing: .08em; }
    .kpi-value { margin-top: 6px; font-size: 18px; font-weight: 700; }
    .section { border: 1px solid #d0d6e0; }
    .section-head { padding: 10px 12px; background: #f7f9fc; border-bottom: 1px solid #d0d6e0; font-weight: 700; }
    .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
    .meta-item { padding: 12px; border-right: 1px solid #e3e7ef; border-bottom: 1px solid #e3e7ef; }
    .meta-item span { display: block; font-size: 10px; color: #5a6478; text-transform: uppercase; font-weight: 700; letter-spacing: .08em; margin-bottom: 5px; }
    .xml-box { display: none; padding: 0 16px 16px; }
    .xml-box pre { margin: 0; padding: 12px; background: #0f172a; color: #e2e8f0; overflow: auto; font-size: 12px; line-height: 1.45; }
    .empty { padding: 24px; color: #5a6478; }
    @media (max-width: 1080px) { .shell { grid-template-columns: 1fr; height: auto; } .panel { min-height: 420px; } }
  </style>
</head>
<body>
  <div class="shell">
    <section class="panel">
      <div class="panel-head">
        <div class="panel-title">Notas NF-e 4.00</div>
        <div class="sub">Busca por numero, cliente ou CPF. Arquivos gerados localmente para teste.</div>
        <input id="search" type="text" placeholder="Buscar NF, cliente ou CPF...">
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>NF</th>
              <th>Emissao</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Itens</th>
              <th>Acao</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
    </section>
    <section class="panel">
      <div class="panel-head">
        <div class="panel-title" id="detail-title">Selecione uma nota</div>
        <div class="sub" id="detail-sub">Os detalhes da NF-e aparecerao aqui.</div>
      </div>
      <div class="detail-body" id="detail-body">
        <div class="empty">Nenhuma NF selecionada.</div>
      </div>
      <div class="xml-box" id="xml-box">
        <pre id="xml-raw"></pre>
      </div>
    </section>
  </div>
  <script src="./viewer.js"></script>
</body>
</html>
"""


def build_viewer_js(dataset: list[dict[str, object]]) -> str:
    payload = json.dumps(dataset, ensure_ascii=False)
    return f"""const NFE_DATA = {payload};

function formatCurrency(value) {{
  return new Intl.NumberFormat('pt-BR', {{ style: 'currency', currency: 'BRL' }}).format(Number(value || 0));
}}

function escapeHtml(value) {{
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}}

const rowsEl = document.getElementById('rows');
const searchEl = document.getElementById('search');
const detailTitleEl = document.getElementById('detail-title');
const detailSubEl = document.getElementById('detail-sub');
const detailBodyEl = document.getElementById('detail-body');
const xmlBoxEl = document.getElementById('xml-box');
const xmlRawEl = document.getElementById('xml-raw');

function renderTable() {{
  const term = (searchEl.value || '').trim().toLowerCase();
  const filtered = NFE_DATA.filter(note => !term || [note.number, note.client, note.cpf, note.file].join(' ').toLowerCase().includes(term));
  rowsEl.innerHTML = filtered.length ? filtered.map(note => `
    <tr>
      <td>${{escapeHtml(note.number)}}</td>
      <td>${{escapeHtml(note.issue_date)}}</td>
      <td>${{escapeHtml(note.client)}}</td>
      <td>${{escapeHtml(formatCurrency(note.total))}}</td>
      <td>${{escapeHtml(String(note.item_count))}}</td>
      <td><button class="btn primary" data-file="${{escapeHtml(note.file)}}">Ver</button></td>
    </tr>
  `).join('') : '<tr><td colspan="6" class="empty">Nenhuma nota encontrada.</td></tr>';

  rowsEl.querySelectorAll('button[data-file]').forEach(button => {{
    button.addEventListener('click', () => openNote(button.dataset.file));
  }});
}}

function openNote(file) {{
  const note = NFE_DATA.find(item => item.file === file);
  if (!note) return;
  detailTitleEl.textContent = `NF ${{note.number}} · ${{note.client}}`;
  detailSubEl.textContent = `${{note.issue_date}} · CPF ${{note.cpf}} · arquivo ${{note.file}}`;
  xmlBoxEl.style.display = 'none';
  detailBodyEl.innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Valor total</div><div class="kpi-value">${{escapeHtml(formatCurrency(note.total))}}</div></div>
      <div class="kpi"><div class="kpi-label">Itens</div><div class="kpi-value">${{escapeHtml(String(note.item_count))}}</div></div>
      <div class="kpi"><div class="kpi-label">ICMS</div><div class="kpi-value">${{escapeHtml(formatCurrency(note.icms_total))}}</div></div>
      <div class="kpi"><div class="kpi-label">PIS</div><div class="kpi-value">${{escapeHtml(formatCurrency(note.pis_total))}}</div></div>
      <div class="kpi"><div class="kpi-label">COFINS</div><div class="kpi-value">${{escapeHtml(formatCurrency(note.cofins_total))}}</div></div>
    </div>
    <div class="section">
      <div class="section-head">Resumo</div>
      <div class="meta-grid">
        <div class="meta-item"><span>Arquivo</span>${{escapeHtml(note.file)}}</div>
        <div class="meta-item"><span>Data emissao</span>${{escapeHtml(note.issue_date)}}</div>
        <div class="meta-item"><span>Saida/entrada</span>${{escapeHtml(note.exit_date)}}</div>
        <div class="meta-item"><span>Chave</span>${{escapeHtml(note.key)}}</div>
      </div>
    </div>
    <div class="section">
      <div class="section-head">Produtos</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Produto</th>
              <th>NCM</th>
              <th>CFOP</th>
              <th>Qtd</th>
              <th>Vlr unit.</th>
              <th>Vlr total</th>
              <th>ICMS</th>
              <th>PIS</th>
              <th>COFINS</th>
            </tr>
          </thead>
          <tbody>
            ${{note.items.map(item => `
              <tr>
                <td>${{escapeHtml(item.code)}}</td>
                <td>${{escapeHtml(item.name)}}</td>
                <td>${{escapeHtml(item.ncm)}}</td>
                <td>${{escapeHtml(item.cfop)}}</td>
                <td>${{escapeHtml(String(item.qty))}}</td>
                <td>${{escapeHtml(formatCurrency(item.unit_price))}}</td>
                <td>${{escapeHtml(formatCurrency(item.total))}}</td>
                <td>${{escapeHtml(formatCurrency(item.icms))}}</td>
                <td>${{escapeHtml(formatCurrency(item.pis))}}</td>
                <td>${{escapeHtml(formatCurrency(item.cofins))}}</td>
              </tr>
            `).join('')}}
          </tbody>
        </table>
      </div>
    </div>
    <button class="btn" id="toggle-xml-btn">Ver XML bruto</button>
  `;
  xmlRawEl.textContent = note.raw_xml;
  document.getElementById('toggle-xml-btn').addEventListener('click', () => {{
    const visible = xmlBoxEl.style.display === 'block';
    xmlBoxEl.style.display = visible ? 'none' : 'block';
  }});
}}

searchEl.addEventListener('input', renderTable);
renderTable();
if (NFE_DATA.length) openNote(NFE_DATA[0].file);
"""


def build_dataset(start_number: int = 1, count: int = 200, seed: int = SEED) -> list[dict[str, object]]:
    rng = random.Random(seed)
    products = load_products()
    customer_pool = make_customer_pool(rng)
    parser = etree.XMLParser(remove_blank_text=False, encoding="utf-8")
    template_tree = etree.parse(str(TEMPLATE_PATH), parser)
    root = template_tree.getroot()
    ns = root.nsmap.get(None) or "http://www.portalfiscal.inf.br/nfe"
    nsmap = {"nfe": ns}
    inf_nfe = required(root, ".//nfe:infNFe", nsmap)
    ide = required(inf_nfe, "./nfe:ide", nsmap)
    emit = required(inf_nfe, "./nfe:emit", nsmap)
    dest = required(inf_nfe, "./nfe:dest", nsmap)
    total = required(inf_nfe, "./nfe:total/nfe:ICMSTot", nsmap)
    pag_vpag = required(inf_nfe, "./nfe:pag/nfe:detPag/nfe:vPag", nsmap)
    det_template = required(inf_nfe, "./nfe:det", nsmap)
    emit_cnpj = required(emit, "./nfe:CNPJ", nsmap).text or ""
    cuf = required(ide, "./nfe:cUF", nsmap).text or "35"
    model = required(ide, "./nfe:mod", nsmap).text or "55"
    serie = required(ide, "./nfe:serie", nsmap).text or "1"
    tp_emis = required(ide, "./nfe:tpEmis", nsmap).text or "1"

    dataset: list[dict[str, object]] = []
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for nf_number in range(start_number, start_number + count):
        tree = etree.parse(str(TEMPLATE_PATH), parser)
        root = tree.getroot()
        inf_nfe = required(root, ".//nfe:infNFe", nsmap)
        ide = required(inf_nfe, "./nfe:ide", nsmap)
        dest = required(inf_nfe, "./nfe:dest", nsmap)
        total_node = required(inf_nfe, "./nfe:total/nfe:ICMSTot", nsmap)
        pag_vpag = required(inf_nfe, "./nfe:pag/nfe:detPag/nfe:vPag", nsmap)

        issue_base = issue_datetime_for_note(nf_number, rng)
        exit_base = issue_base + timedelta(minutes=rng.randint(5, 180))
        dh_emi = issue_base.strftime("%Y-%m-%dT%H:%M:%S-03:00")
        dh_sai = exit_base.strftime("%Y-%m-%dT%H:%M:%S-03:00")
        aamm = issue_base.strftime("%y%m")
        c_nf = f"{rng.randint(0, 99999999):08d}"
        nnf_text = str(nf_number)
        customer = choose_customer(customer_pool, rng)
        cpf = customer.cpf
        client_name = customer.name

        required(ide, "./nfe:cNF", nsmap).text = c_nf
        required(ide, "./nfe:nNF", nsmap).text = nnf_text
        required(ide, "./nfe:dhEmi", nsmap).text = dh_emi
        dh_sai_ent = ensure_child(ide, "dhSaiEnt", ns, after_tag="dhEmi")
        dh_sai_ent.text = dh_sai
        dh_sai_ent.tail = "\n      "
        required(dest, "./nfe:CPF", nsmap).text = cpf
        required(dest, "./nfe:xNome", nsmap).text = client_name

        det_nodes = inf_nfe.findall("./nfe:det", namespaces=nsmap)
        for node in det_nodes[1:]:
            inf_nfe.remove(node)
        det_first = inf_nfe.find("./nfe:det", namespaces=nsmap)
        assert det_first is not None

        picked = choose_note_products(products, rng)
        items_payload = []

        total_prod = Decimal("0.00")
        total_icms = Decimal("0.00")
        total_pis = Decimal("0.00")
        total_cofins = Decimal("0.00")

        for index, product in enumerate(picked, start=1):
            det = det_first if index == 1 else deepcopy(det_template)
            if index > 1:
                inf_nfe.insert(inf_nfe.index(det_first) + (index - 1), det)
            det.attrib["nItem"] = str(index)
            prod = required(det, "./nfe:prod", nsmap)
            imposto = required(det, "./nfe:imposto", nsmap)
            icms00 = required(imposto, "./nfe:ICMS/nfe:ICMS00", nsmap)
            pis_aliq = required(imposto, "./nfe:PIS/nfe:PISAliq", nsmap)
            cofins_aliq = required(imposto, "./nfe:COFINS/nfe:COFINSAliq", nsmap)

            quantity = sample_quantity(rng)
            unit_price = sample_unit_price(rng)
            product_total = (Decimal(quantity) * unit_price).quantize(Q, rounding=ROUND_HALF_UP)
            icms_total = (product_total * Decimal("0.18")).quantize(Q, rounding=ROUND_HALF_UP)
            pis_total = (product_total * Decimal("0.0165")).quantize(Q, rounding=ROUND_HALF_UP)
            cofins_total = (product_total * Decimal("0.076")).quantize(Q, rounding=ROUND_HALF_UP)

            required(prod, "./nfe:cProd", nsmap).text = product.code
            required(prod, "./nfe:xProd", nsmap).text = product.name
            required(prod, "./nfe:NCM", nsmap).text = product.ncm
            required(prod, "./nfe:CFOP", nsmap).text = product.cfop
            required(prod, "./nfe:qCom", nsmap).text = qty4(quantity)
            required(prod, "./nfe:vUnCom", nsmap).text = f"{unit_price:.4f}"
            required(prod, "./nfe:vProd", nsmap).text = money(product_total)
            required(prod, "./nfe:qTrib", nsmap).text = qty4(quantity)
            required(prod, "./nfe:vUnTrib", nsmap).text = f"{unit_price:.4f}"

            required(icms00, "./nfe:vBC", nsmap).text = money(product_total)
            required(icms00, "./nfe:vICMS", nsmap).text = money(icms_total)
            required(pis_aliq, "./nfe:vBC", nsmap).text = money(product_total)
            required(pis_aliq, "./nfe:vPIS", nsmap).text = money(pis_total)
            required(cofins_aliq, "./nfe:vBC", nsmap).text = money(product_total)
            required(cofins_aliq, "./nfe:vCOFINS", nsmap).text = money(cofins_total)

            total_prod += product_total
            total_icms += icms_total
            total_pis += pis_total
            total_cofins += cofins_total
            items_payload.append({
                "code": product.code,
                "name": product.name,
                "ncm": product.ncm,
                "cfop": product.cfop,
                "qty": quantity,
                "unit_price": float(unit_price.quantize(Q, rounding=ROUND_HALF_UP)),
                "total": float(product_total),
                "icms": float(icms_total),
                "pis": float(pis_total),
                "cofins": float(cofins_total),
            })

        required(total_node, "./nfe:vBC", nsmap).text = money(total_prod)
        required(total_node, "./nfe:vICMS", nsmap).text = money(total_icms)
        required(total_node, "./nfe:vProd", nsmap).text = money(total_prod)
        required(total_node, "./nfe:vPIS", nsmap).text = money(total_pis)
        required(total_node, "./nfe:vCOFINS", nsmap).text = money(total_cofins)
        required(total_node, "./nfe:vNF", nsmap).text = money(total_prod)
        pag_vpag.text = money(total_prod)

        key43 = f"{cuf}{aamm}{emit_cnpj}{model}{int(serie):03d}{nf_number:09d}{tp_emis}{c_nf}"
        cdv = calc_mod11_dv(key43)
        required(ide, "./nfe:cDV", nsmap).text = cdv
        inf_nfe.attrib["Id"] = f"NFe{key43}{cdv}"

        etree.indent(tree, space="  ")
        xml_bytes = etree.tostring(tree, encoding="UTF-8", xml_declaration=True, pretty_print=True)
        validate_generated_xml(xml_bytes)
        file_name = f"nfe_{nf_number:04d}.xml"
        (OUTPUT_DIR / file_name).write_bytes(xml_bytes)

        dataset.append({
            "file": file_name,
            "number": nf_number,
            "issue_date": issue_base.strftime("%d/%m/%Y %H:%M"),
            "exit_date": exit_base.strftime("%d/%m/%Y %H:%M"),
            "client": client_name,
            "cpf": cpf,
            "total": float(total_prod),
            "item_count": len(items_payload),
            "icms_total": float(total_icms),
            "pis_total": float(total_pis),
            "cofins_total": float(total_cofins),
            "key": f"{key43}{cdv}",
            "items": items_payload,
            "raw_xml": xml_bytes.decode("utf-8"),
        })

    return dataset


def validate_generated_xml(xml_bytes: bytes) -> None:
    doc = etree.fromstring(xml_bytes)
    ns = doc.nsmap.get(None) or "http://www.portalfiscal.inf.br/nfe"
    nsmap = {"nfe": ns}
    inf_nfe = required(doc, ".//nfe:infNFe", nsmap)
    if inf_nfe.attrib.get("versao") != "4.00":
        raise RuntimeError("Versao NF-e invalida.")
    key = inf_nfe.attrib.get("Id", "")
    if not re.fullmatch(r"NFe\d{44}", key):
        raise RuntimeError("Chave NF-e invalida.")
    if key[-1] != calc_mod11_dv(key[3:-1]):
        raise RuntimeError("Digito verificador inconsistente.")
    det_nodes = inf_nfe.findall("./nfe:det", namespaces=nsmap)
    if not det_nodes:
        raise RuntimeError("NF sem itens.")
    total_node = required(inf_nfe, "./nfe:total/nfe:ICMSTot", nsmap)
    sum_prod = Decimal("0.00")
    sum_icms = Decimal("0.00")
    sum_pis = Decimal("0.00")
    sum_cofins = Decimal("0.00")
    for det in det_nodes:
        prod = required(det, "./nfe:prod", nsmap)
        imposto = required(det, "./nfe:imposto", nsmap)
        sum_prod += Decimal(required(prod, "./nfe:vProd", nsmap).text or "0")
        sum_icms += Decimal(required(imposto, "./nfe:ICMS/nfe:ICMS00/nfe:vICMS", nsmap).text or "0")
        sum_pis += Decimal(required(imposto, "./nfe:PIS/nfe:PISAliq/nfe:vPIS", nsmap).text or "0")
        sum_cofins += Decimal(required(imposto, "./nfe:COFINS/nfe:COFINSAliq/nfe:vCOFINS", nsmap).text or "0")
    if money(sum_prod) != required(total_node, "./nfe:vProd", nsmap).text:
        raise RuntimeError("Total de produtos inconsistente.")
    if money(sum_icms) != required(total_node, "./nfe:vICMS", nsmap).text:
        raise RuntimeError("Total ICMS inconsistente.")
    if money(sum_pis) != required(total_node, "./nfe:vPIS", nsmap).text:
        raise RuntimeError("Total PIS inconsistente.")
    if money(sum_cofins) != required(total_node, "./nfe:vCOFINS", nsmap).text:
        raise RuntimeError("Total COFINS inconsistente.")
    if money(sum_prod) != required(total_node, "./nfe:vNF", nsmap).text:
        raise RuntimeError("Valor final da NF inconsistente.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=1)
    parser.add_argument("--count", type=int, default=200)
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--append-viewer", action="store_true")
    args = parser.parse_args()

    dataset = build_dataset(start_number=args.start, count=args.count, seed=args.seed)
    if args.append_viewer and (OUTPUT_DIR / "viewer.js").exists():
        existing_text = (OUTPUT_DIR / "viewer.js").read_text(encoding="utf-8")
        match = re.search(r"const NFE_DATA = (.*?);\n\nfunction formatCurrency", existing_text, flags=re.S)
        if match:
            existing = json.loads(match.group(1))
            by_file = {item["file"]: item for item in existing}
            for item in dataset:
                by_file[item["file"]] = item
            dataset = sorted(by_file.values(), key=lambda item: item["number"])
    (OUTPUT_DIR / "index.html").write_text(build_viewer_html(), encoding="utf-8")
    (OUTPUT_DIR / "viewer.js").write_text(build_viewer_js(dataset), encoding="utf-8")
    print(f"Gerados/atualizados {len(dataset)} XMLs indexados em {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
