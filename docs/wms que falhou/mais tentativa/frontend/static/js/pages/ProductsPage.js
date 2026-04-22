// ProductsPage.js
import { API } from '../services/api.js';

export const ProductsPage = {
    async render() {
        const workspace = document.getElementById('page-content');
        workspace.innerHTML = `<div class="loading">CARREGANDO PRODUTOS...</div>`;

        try {
            const products = await API.products.list();
            this.drawUI(workspace, products);
        } catch (err) {
            workspace.innerHTML = `<div class="error">ERRO: ${err.message.toUpperCase()}</div>`;
        }
    },

    drawUI(container, products) {
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">CADASTRO NACIONAL DE PRODUTOS</h1>
                <p class="page-subtitle">CONTROLE DE SKUs E CATEGORIAS</p>
            </div>

            <div class="action-bar-top">
                <input type="text" id="product-search" class="input-search-large" placeholder="FILTRAR POR NOME OU CÓDIGO...">
                <button class="btn-medium" id="add-product-btn">NOVO PRODUTO</button>
            </div>

            <table class="wms-table">
                <thead>
                    <tr>
                        <th>CÓDIGO</th>
                        <th>NOME DO PRODUTO</th>
                        <th>SKU</th>
                        <th>CATEGORIA</th>
                    </tr>
                </thead>
                <tbody id="product-table-body">
                    ${this.renderRows(products)}
                </tbody>
            </table>
        `;

        this.initEvents(products);
    },

    renderRows(products) {
        if (!products.length) return '<tr><td colspan="4" style="text-align:center; padding: 40px;">NENHUM PRODUTO CADASTRADO</td></tr>';
        
        return products.map(p => `
            <tr class="clickable-row">
                <td style="font-family: 'IBM Plex Mono'; font-weight: 700; color: var(--accent)">${p.code}</td>
                <td style="font-weight: 500;">${p.name.toUpperCase()}</td>
                <td style="font-family: 'IBM Plex Mono'; color: var(--text3)">${p.sku || '-'}</td>
                <td style="font-size: 11px; color: var(--text2)">${p.category || 'GERAL'}</td>
            </tr>
        `).join('');
    },

    initEvents(products) {
        const searchInput = document.getElementById('product-search');
        searchInput.oninput = (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = products.filter(p => 
                p.name.toLowerCase().includes(term) || 
                p.code.toLowerCase().includes(term)
            );
            document.getElementById('product-table-body').innerHTML = this.renderRows(filtered);
        };

        document.getElementById('add-product-btn').onclick = () => {
            alert("O formulário de criação será implementado na Fase 4.");
        };
    }
};
