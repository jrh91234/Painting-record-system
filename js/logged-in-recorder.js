/* "Recorded by" is always the logged-in user.
   Every form (production, REWORK, SCREEN, 5M1E, RTV) has its own recorder
   field, and several of them are rebuilt from the recorder list or reset after
   a save. Instead of patching each form, this watches the page and keeps every
   recorder field set to the current user's name and locked. */
(function () {
    const FIELD_IDS = ['recorderName', 'rwRecorder', 'scRecorder', 'eventRecorderSelect', 'rtvRecorder'];
    let scheduled = false;

    function currentName() {
        const user = window.PaintingAuth && window.PaintingAuth.currentUser;
        if (!user) return '';
        return String(user.displayName || user.employeeId || '').trim();
    }

    function lockSelect(select, name) {
        let option = Array.from(select.options).find(opt => opt.value === name);
        if (!option) {
            option = new Option(name, name);
            select.add(option, select.options[1] || null);
        }
        if (select.value !== name) select.value = name;
        if (!select.disabled) select.disabled = true;
        select.title = 'ผู้บันทึกคือผู้ที่เข้าสู่ระบบ';
    }

    function lockInput(input, name) {
        if (input.value !== name) input.value = name;
        if (!input.readOnly) input.readOnly = true;
        input.title = 'ผู้บันทึกคือผู้ที่เข้าสู่ระบบ';
    }

    function apply() {
        scheduled = false;
        const name = currentName();
        if (!name) return;
        FIELD_IDS.forEach(id => {
            const field = document.getElementById(id);
            if (!field) return;
            if (field.tagName === 'SELECT') lockSelect(field, name);
            else lockInput(field, name);
        });
        // Picking or adding another recorder no longer applies.
        document.querySelectorAll('.btn-add-staff[onclick*="\'recorder\'"]').forEach(btn => {
            if (btn.style.display !== 'none') btn.style.display = 'none';
        });
    }

    function schedule() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(apply);
    }

    // Forms mount late and recorder lists re-render their options.
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    // form.reset() clears values without touching the DOM tree.
    document.addEventListener('reset', () => setTimeout(apply, 0), true);
    document.addEventListener('DOMContentLoaded', schedule);
    // The user can log in, or switch accounts, without a page reload.
    setInterval(apply, 3000);

    window.applyLoggedInRecorder = apply;
}());
