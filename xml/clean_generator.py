import os
import random
from datetime import datetime, timedelta

path = "/home/leonamramosfoli/wms-teste/docs/xml/samples"
os.makedirs(path, exist_ok=True)
products = ["Arroz Integral 5kg", "Feijão Carioca 1kg", "Açúcar Refinado 1kg", "Óleo de Soja 900ml", "Café Torrado 500g", "Macarrão Espaguete 500g", "Leite Integral 1L", "Detergente 500ml", "Sabão em Pó 1kg", "Papel Higiênico 12un", "Shampoo 400ml", "Sabonete 90g", "Creme Dental 90g", "Desinfetante 1L", "Água Sanitária 2L", "Esponja de Aço 3un", "Biscoito Recheado 140g", "Suco de Uva 1L", "Achocolatado 400g", "Farinha de Trigo 1kg"]
suppliers = ["12345678000101", "23456789000102", "34567890000103", "45678901000104", "56789012000105", "67890123000106", "78901234000107", "89012345000108", "90123456000109", "01234567000100"]

def random_date():
    start = datetime(2025, 1, 1)
    end = datetime(2025, 12, 31)
    return (start + timedelta(seconds=random.randint(0, int((end - start).total_seconds())))).isoformat() + "-03:00"

for i in range(1, 2401):
    cnpj = random.choice(suppliers)
    data = random_date()
    sku = random.choice(products)
    nNF = random.randint(1000, 999999)
    
    xml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
    <NFe>
        <infNFe Id="NFe{random.randint(10**43, 10**44-1)}" versao="4.00">
            <ide>
                <cUF>35</cUF>
                <natOp>VENDA</natOp>
                <mod>55</mod>
                <serie>1</serie>
                <nNF>{nNF}</nNF>
                <dhEmi>{data}</dhEmi>
                <tpNF>1</tpNF>
            </ide>
            <emit>
                <CNPJ>{cnpj}</CNPJ>
                <xNome>FORNECEDOR LTDA</xNome>
            </emit>
            <dest>
                <CNPJ>00000000000191</CNPJ>
                <xNome>WMS CLIENTE</xNome>
            </dest>
            <det nItem="1">
                <prod>
                    <cProd>SKU{random.randint(100,999)}</cProd>
                    <xProd>{sku}</xProd>
                    <NCM>12345678</NCM>
                    <CFOP>5102</CFOP>
                    <uCom>UN</uCom>
                    <qCom>{random.randint(1, 100)}.0000</qCom>
                    <vUnCom>{random.uniform(5.0, 50.0):.4f}</vUnCom>
                    <vProd>{random.uniform(50.0, 5000.0):.2f}</vProd>
                </prod>
            </det>
        </infNFe>
    </NFe>
</nfeProc>"""
    
    with open(os.path.join(path, f"nfe_entrada_{i}.xml"), 'w', encoding='utf-8') as f:
        f.write(xml_content)

print("2400 XMLs gerados com sucesso.")
