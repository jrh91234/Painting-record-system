/* Wide cards scroll sideways.
   Many cards clip their content (overflow: hidden, for rounded corners) and
   some tables are not inside a .table-responsive wrapper, so a table wider
   than the screen was simply cut off. Whenever a page changes, find tables
   that are wider than the nearest ancestor that clips them and let that
   ancestor scroll horizontally instead (class is-x-scroll, styled in
   graphite.css). */
(function () {
    let scheduled = false;

    function clipsX(el) {
        const value = getComputedStyle(el).overflowX;
        return value === 'hidden' || value === 'clip';
    }

    function scrollsX(el) {
        const value = getComputedStyle(el).overflowX;
        return value === 'auto' || value === 'scroll';
    }

    function fix() {
        scheduled = false;
        document.querySelectorAll('.tab-page table, .modal-box table').forEach(table => {
            if (!table.offsetParent) return;
            for (let el = table.parentElement; el && el !== document.body; el = el.parentElement) {
                if (scrollsX(el)) return;
                if (clipsX(el)) {
                    if (table.offsetWidth > el.clientWidth + 2) el.classList.add('is-x-scroll');
                    return;
                }
            }
        });
    }

    function schedule() {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(fix);
    }

    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('resize', schedule);
    schedule();
}());
