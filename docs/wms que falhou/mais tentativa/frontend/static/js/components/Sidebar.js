// Sidebar.js - Conteúdo Contextual Industrial
export const Sidebar = {
    render(pageId) {
        const content = document.getElementById('sidebar-content');
        
        const header = `
            <div class="sidebar-header">
                <div class="sidebar-title">CONTEXTO: ${pageId.toUpperCase()}</div>
            </div>
        `;

        let body = '';

        switch(pageId) {
            case 'overview':
                body = `
                    <div style="padding: 24px;">
                        <p style="font-size: 12px; color: var(--text2); line-height: 1.6;">
                            Bem-vindo à Central de Comando.<br><br>
                            Este painel consolida os dados de SSoT (Single Source of Truth) do armazém.
                        </p>
                    </div>
                `;
                break;
            case 'receiving':
                body = `
                    <div style="padding: 24px;">
                        <div class="section-title">GUIA RÁPIDO</div>
                        <p style="font-size: 11px; color: var(--text3); margin-bottom: 20px;">
                            1. Arraste o arquivo .XML<br>
                            2. Valide os itens da nota<br>
                            3. Inicie a Conferência Cega
                        </p>
                    </div>
                `;
                break;
            case 'picking':
                body = `
                    <div style="padding: 24px;">
                        <div class="section-title">ORDEM DE PICKING</div>
                        <p style="font-size: 11px; color: var(--text3);">
                            As sugestões de gaveta seguem a regra FEFO.<br><br>
                            Priorize a retirada de itens com validade mais próxima.
                        </p>
                    </div>
                `;
                break;
            case 'map':
                body = `
                    <div style="padding: 24px;">
                        <div class="section-title">LEGENDA DO MAPA</div>
                        <p style="font-size: 11px; color: var(--text3); margin-bottom: 10px;">
                            [S] - Estante (Shelf)<br>
                            [G] - Gaveta (Drawer)
                        </p>
                    </div>
                `;
                break;
            default:
                body = `<div style="padding: 24px; font-size: 11px; color: var(--text3);">Sem metadados adicionais para esta seção.</div>`;
        }

        content.innerHTML = header + body;
    }
};
