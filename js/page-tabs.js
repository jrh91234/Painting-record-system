/* Browser-style page tabs.
   Every menu goes through switchTab(), so this wraps it: each page the user
   opens gets a tab under the header, clicking a tab re-opens that page through
   the same menu function (so pages refresh exactly as from the sidebar), and
   the open tabs plus each tab's scroll position are remembered per browser. */
(function () {
    const originalSwitchTab = window.switchTab;
    if (typeof originalSwitchTab !== 'function') return;

    const STORAGE_KEY = 'PAINTING_OPEN_TABS';
    const HOME_KEY = 'dashboard-tab';
    const MAX_TABS = 10;
    const DOT_COLORS = ['#ff8c42', '#ffcc4d', '#ff5d8f', '#2ec4b6', '#4d7cfe', '#8e6cff', '#3ddc97', '#36c5f0'];

    const LABELS = {
        'dashboard-tab': 'Dashboard',
        'line-eff-tab': '%Eff ไลน์',
        'qc7-tools-tab': 'QC 7 TOOL',
        'qc-history-tab:pending': 'QC รอตรวจ',
        'qc-history-tab:reviewed': 'QC ตรวจแล้ว',
        'inspection-tab': 'บันทึกงานตรวจ',
        'daily-report-tab': 'บันทึกการผลิต',
        'rework-tab': 'REWORK',
        'screen-tab': 'SCREEN',
        'pre-assy-tab': 'Pre-assy',
        'rtv-tab': 'RTV',
        'maintenance-plan-tab': 'แผนบำรุงรักษา',
        'parameter-checklist-tab:full': 'ตรวจเช็กพารามิเตอร์',
        'parameter-checklist-tab:water': 'วัดค่าน้ำ',
        'equipment-checklist-tab': 'ตรวจเช็กอุปกรณ์',
        'event-tab': 'Event (5M1E)',
        'spare-parts-tab': 'คลังอะไหล่',
        'material-receipt-tab': 'รับ Mat',
        'settings-tab': 'จัดการผู้ใช้งาน',
        'history-tab': 'ประวัติ'
    };

    let tabs = loadTabs();
    let activeKey = null;
    let bar = null;
    let list = null;

    function loadTabs() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (Array.isArray(saved)) {
                return saved.filter(tab => tab && typeof tab.key === 'string' && typeof tab.tabId === 'string');
            }
        } catch (error) {
            // Storage may be blocked or hold old data; start with no tabs.
        }
        return [];
    }

    function saveTabs() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs.map(({ key, tabId, scrollY }) => ({ key, tabId, scrollY }))));
        } catch (error) {
            // Tabs still work for this visit without storage.
        }
    }

    // QC review and the parameter checklist show different content on the same
    // page, so their current mode is part of the tab identity.
    function keyFor(tabId) {
        if (tabId === 'qc-history-tab') {
            return tabId + ':' + (window.qcReviewDataScope === 'reviewed' ? 'reviewed' : 'pending');
        }
        if (tabId === 'parameter-checklist-tab') {
            const mode = typeof parameterChecklistMode !== 'undefined' ? parameterChecklistMode : 'full';
            return tabId + ':' + (mode === 'water' ? 'water' : 'full');
        }
        return tabId;
    }

    function labelFor(tab) {
        if (LABELS[tab.key]) return LABELS[tab.key];
        const section = document.getElementById(tab.tabId);
        const heading = section && section.querySelector('.page-title, h1, h2');
        return (heading && heading.textContent.trim()) || tab.tabId;
    }

    function colorFor(key) {
        let hash = 0;
        for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
        return DOT_COLORS[hash % DOT_COLORS.length];
    }

    function isAllowed(tab) {
        const section = document.getElementById(tab.tabId);
        if (!section) return false;
        const permission = section.dataset.permission;
        if (!permission || !window.PaintingAuth || typeof PaintingAuth.hasPermission !== 'function') return true;
        return PaintingAuth.hasPermission(permission);
    }

    // Re-open a page through the same function its menu item uses.
    function reopen(tab) {
        const [tabId, mode] = tab.key.split(':');
        if (tabId === 'qc-history-tab' && typeof window.openQCReviewView === 'function') {
            window.openQCReviewView(mode || 'pending', null);
        } else if (tabId === 'parameter-checklist-tab' && typeof window.openParameterChecklistMode === 'function') {
            window.openParameterChecklistMode(mode || 'full', null, null);
        } else if (tabId === 'inspection-tab' && typeof window.openInspectionModal === 'function') {
            window.openInspectionModal();
        } else if (tabId === 'rtv-tab' && typeof window.openRTVTab === 'function') {
            window.openRTVTab(null, null);
        } else if (tabId === 'maintenance-plan-tab' && typeof window.openMaintenancePlan === 'function') {
            window.openMaintenancePlan(null, null);
        } else if (tabId === 'material-receipt-tab' && typeof window.openMaterialReceipt === 'function') {
            window.openMaterialReceipt(null, null);
        } else if (tabId === 'line-eff-tab' && typeof window.openLineEfficiency === 'function') {
            window.openLineEfficiency(null, null);
        } else if (tabId === 'qc7-tools-tab' && typeof window.openQC7Tools === 'function') {
            window.openQC7Tools(null, null);
        } else {
            window.switchTab(tabId, null);
        }
    }

    function rememberScroll() {
        const current = tabs.find(tab => tab.key === activeKey);
        if (current) current.scrollY = window.scrollY;
    }

    function activate(tab) {
        if (tab.key === activeKey) return;
        rememberScroll();
        const scrollY = tab.scrollY || 0;
        reopen(tab);
        if (activeKey === tab.key) {
            // switchTab scrolls to the top; put the user back where they were.
            window.setTimeout(() => window.scrollTo({ top: scrollY, behavior: 'auto' }), 60);
        }
    }

    function close(key) {
        if (key === HOME_KEY) return;
        const index = tabs.findIndex(tab => tab.key === key);
        if (index === -1) return;
        tabs.splice(index, 1);
        if (key === activeKey) {
            const next = tabs[index] || tabs[index - 1] || tabs[0];
            activeKey = null;
            if (next) activate(next);
        }
        saveTabs();
        render();
    }

    function track(tabId) {
        const key = keyFor(tabId);
        if (!tabs.some(tab => tab.key === HOME_KEY)) tabs.unshift({ key: HOME_KEY, tabId: HOME_KEY });
        if (!tabs.some(tab => tab.key === key)) {
            tabs.push({ key, tabId });
            while (tabs.length > MAX_TABS) {
                const oldest = tabs.findIndex(tab => tab.key !== HOME_KEY && tab.key !== key);
                if (oldest === -1) break;
                tabs.splice(oldest, 1);
            }
        }
        activeKey = key;
        saveTabs();
        render();
    }

    window.switchTab = function (tabId, element) {
        const result = originalSwitchTab.apply(this, arguments);
        const section = document.getElementById(tabId);
        // switchTab returns early (no page change) when permission is denied.
        if (section && section.classList.contains('active')) {
            if (activeKey && activeKey !== keyFor(tabId)) rememberScroll();
            track(tabId);
        }
        return result;
    };

    function buildBar() {
        const header = document.querySelector('.main-wrapper > .app-header');
        if (!header) return false;
        bar = document.createElement('nav');
        bar.className = 'page-tabs';
        bar.setAttribute('aria-label', 'หน้าที่เปิดอยู่');
        list = document.createElement('div');
        list.className = 'page-tabs-list';
        list.setAttribute('role', 'tablist');
        bar.appendChild(list);
        header.insertAdjacentElement('afterend', bar);

        list.addEventListener('click', event => {
            const closeButton = event.target.closest('.page-tab-close');
            const item = event.target.closest('.page-tab');
            if (!item) return;
            event.preventDefault();
            if (closeButton) {
                close(item.dataset.key);
                return;
            }
            const tab = tabs.find(entry => entry.key === item.dataset.key);
            if (tab) activate(tab);
        });

        // Middle click closes a tab, like in a browser.
        list.addEventListener('auxclick', event => {
            const item = event.target.closest('.page-tab');
            if (item && event.button === 1) {
                event.preventDefault();
                close(item.dataset.key);
            }
        });

        list.addEventListener('keydown', event => {
            const item = event.target.closest('.page-tab-main');
            if (!item) return;
            const buttons = Array.from(list.querySelectorAll('.page-tab-main'));
            const index = buttons.indexOf(item);
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                event.preventDefault();
                const next = buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
                next.focus();
            } else if (event.key === 'Delete') {
                event.preventDefault();
                close(item.parentElement.dataset.key);
            }
        });
        return true;
    }

    function render() {
        if (!list) return;
        const visible = tabs.filter(isAllowed);
        list.textContent = '';
        visible.forEach(tab => {
            const isActive = tab.key === activeKey;
            const item = document.createElement('div');
            item.className = 'page-tab' + (isActive ? ' is-active' : '');
            item.dataset.key = tab.key;
            item.style.setProperty('--tab-dot', colorFor(tab.key));

            const main = document.createElement('button');
            main.type = 'button';
            main.className = 'page-tab-main';
            main.setAttribute('role', 'tab');
            main.setAttribute('aria-selected', isActive ? 'true' : 'false');
            main.tabIndex = isActive ? 0 : -1;
            const dot = document.createElement('span');
            dot.className = 'page-tab-dot';
            dot.setAttribute('aria-hidden', 'true');
            const label = document.createElement('span');
            label.className = 'page-tab-label';
            label.textContent = labelFor(tab);
            main.append(dot, label);
            main.title = label.textContent;
            item.appendChild(main);

            if (tab.key !== HOME_KEY) {
                const closeButton = document.createElement('button');
                closeButton.type = 'button';
                closeButton.className = 'page-tab-close';
                closeButton.setAttribute('aria-label', 'ปิดแท็บ ' + label.textContent);
                closeButton.textContent = '×';
                item.appendChild(closeButton);
            }
            list.appendChild(item);
        });

        const active = list.querySelector('.page-tab.is-active');
        if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function init() {
        if (!buildBar()) return;
        const current = document.querySelector('.tab-page.active');
        track(current && current.id ? current.id : HOME_KEY);
    }

    // Permissions load after login; refresh the bar so restricted tabs hide.
    if (window.PaintingAuth && typeof PaintingAuth.applyPermissions === 'function') {
        const originalApplyPermissions = PaintingAuth.applyPermissions;
        PaintingAuth.applyPermissions = function () {
            const result = originalApplyPermissions.apply(this, arguments);
            render();
            return result;
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
}());
