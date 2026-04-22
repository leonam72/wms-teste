// NavRail.js - Menu Lateral Esquerdo
export const NavRail = {
    items: [
        { id: 'overview', label: 'KPI' },
        { id: 'receiving', label: 'IN' },
        { id: 'picking', label: 'OUT' },
        { id: 'map', label: 'MAPA' },
        { id: 'products', label: 'PROD' },
        { id: 'audit', label: 'AUDIT' },
        { id: 'config', label: 'CONFIG' }
    ],

    render() {
        const rail = document.getElementById('nav-rail');
        if (!rail) return;

        rail.innerHTML = this.items.map(item => `
            <div class="nav-btn" id="nav-${item.id}" data-id="${item.id}">
                <div class="nav-label-large">${item.label}</div>
            </div>
        `).join('');

        // Vinculação de eventos limpa
        this.items.forEach(item => {
            const btn = document.getElementById(`nav-${item.id}`);
            if (btn) {
                btn.onclick = () => {
                    window.location.hash = item.id;
                };
            }
        });
    },

    setActive(pageId) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`nav-${pageId}`);
        if (activeBtn) activeBtn.classList.add('active');
    }
};
