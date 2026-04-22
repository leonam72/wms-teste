// AuditPage.js
import { API } from '../services/api.js';

export const AuditPage = {
    async render() {
        const workspace = document.getElementById('page-content');
        workspace.innerHTML = `<div class="loading">CARREGANDO LOGS DE AUDITORIA...</div>`;

        try {
            const logs = await API.audit.list();
            this.drawUI(workspace, logs);
        } catch (err) {
            workspace.innerHTML = `<div class="error">ERRO: ${err.message.toUpperCase()}</div>`;
        }
    },

    drawUI(container, logs) {
        container.innerHTML = `
            <div class="page-header">
                <h1 class="page-title">RASTREADIBILIDADE OPERACIONAL</h1>
                <p class="page-subtitle">LOG DE EVENTOS CRÍTICOS DO SISTEMA (SSoT)</p>
            </div>

            <div class="audit-log-container">
                ${this.renderLogs(logs)}
            </div>
        `;
    },

    renderLogs(logs) {
        if (!logs.length) return '<div class="no-data">NENHUM EVENTO REGISTRADO</div>';

        return logs.map(log => {
            const date = new Date(log.created_at).toLocaleString('pt-BR');
            const operator = log.operator ? log.operator.username.toUpperCase() : 'SISTEMA';
            
            return `
                <div class="audit-entry">
                    <div class="audit-meta">
                        <span class="audit-time">${date}</span>
                        <span class="audit-operator">[@${operator}]</span>
                    </div>
                    <div class="audit-content">
                        <span class="audit-tag tag-${log.action_tag.replace(/[\[\]]/g, '').toLowerCase()}">${log.action_tag}</span>
                        <span class="audit-desc">${log.description}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
};
