/**
 * Painting Quality Inspection System - PDF Export Module
 * Handles exporting pages, forms, and reports to high-quality PDF files.
 */
(function (window, document) {
    'use strict';

    const PaintingPdfExport = {
        activeTargetTab: null,
        isExporting: false,

        /**
         * Get user-friendly name for any tab ID
         */
        getTabTitle: function (tabId) {
            const titles = {
                'daily-report-tab': 'บันทึกการผลิตและของเสีย (Daily Production Report)',
                'dashboard-tab': 'ภาพรวมระบบแดชบอร์ด (Dashboard Overview)',
                'line-eff-tab': 'ประสิทธิภาพไลน์พ่นสี (%Eff Line Efficiency)',
                'qc7-tools-tab': 'เครื่องมือควบคุมคุณภาพ (QC 7 TOOLS)',
                'qc-history-tab': 'ประวัติการตรวจเช็ก QC (QC Inspection History)',
                'rework-tab': 'บันทึกงานแก้ไข (REWORK Report)',
                'screen-tab': 'บันทึกงานสกรีน (Screen Report)',
                'pre-assy-tab': 'บันทึกงาน Pre-assembly Report',
                'rtv-tab': 'บันทึกงานตีกลับ (RTV Report)',
                'maintenance-plan-tab': 'แผนงานบำรุงรักษา (Maintenance Plan)',
                'parameter-checklist-tab': 'รายการตรวจเช็กพารามิเตอร์ (Parameter Checklist)',
                'equipment-checklist-tab': 'ตรวจเช็กอุปกรณ์ (Equipment Checklist)',
                'event-tab': 'บันทึกเหตุการณ์ (5M1E Event Log)',
                'material-receipt-tab': 'รับวัตถุดิบสีฝุ่น (Material Receipt)',
                'spare-parts-tab': 'คลังอะไหล่ (Spare Parts Inventory)',
                'history-tab': 'ประวัติการตรวจเช็คทั้งหมด (All History Records)',
                'cycle-time-tab': 'บันทึกรอบเวลา (Cycle Time Standards)',
                'settings-tab': 'จัดการผู้ใช้งาน (User Management)'
            };
            return titles[tabId] || 'รายงานระบบตรวจสอบคุณภาพพ่นสี';
        },

        /**
         * Open the PDF Export confirmation modal
         */
        openModal: function (targetTabId) {
            const activeTab = targetTabId 
                ? document.getElementById(targetTabId)
                : (document.querySelector('.tab-page.active') || document.getElementById('daily-report-tab'));
            
            this.activeTargetTab = activeTab ? activeTab.id : 'daily-report-tab';

            const modal = document.getElementById('pdfExportModal');
            if (!modal) return;

            // Populate details in modal
            const tabTitle = this.getTabTitle(this.activeTargetTab);
            const reportNameEl = document.getElementById('pdfReportName');
            if (reportNameEl) reportNameEl.textContent = tabTitle;

            // Extract Shift & Date metadata
            const dateVal = document.getElementById('reportDate')?.value || new Date().toISOString().slice(0, 10);
            const shiftVal = document.querySelector('input[name="shift"]:checked')?.value || 'Day';
            const recorderEl = document.getElementById('recorderName');
            const recorderVal = (recorderEl && recorderEl.options && recorderEl.selectedIndex >= 0)
                ? recorderEl.options[recorderEl.selectedIndex].text
                : (recorderEl?.value || 'ผู้ใช้งาน');

            const dateEl = document.getElementById('pdfReportDate');
            if (dateEl) dateEl.textContent = dateVal;

            const shiftEl = document.getElementById('pdfReportShift');
            if (shiftEl) shiftEl.textContent = shiftVal === 'Day' ? '☀️ Day (กะกลางวัน)' : '🌙 Night (กะกลางคืน)';

            const recorderInfoEl = document.getElementById('pdfReportRecorder');
            if (recorderInfoEl) recorderInfoEl.textContent = recorderVal;

            // Item count estimation
            let count = 0;
            if (this.activeTargetTab === 'daily-report-tab') {
                if (Array.isArray(window.dailyReportRecords) && window.dailyReportRecords.length > 0) {
                    count = window.dailyReportRecords.length;
                } else if (typeof window.getSavedDailyReportRecords === 'function') {
                    count = window.getSavedDailyReportRecords().length;
                }
            } else if (this.activeTargetTab === 'history-tab') {
                count = (window.inspectionRecords || []).length;
            }
            const countEl = document.getElementById('pdfReportCount');
            if (countEl) countEl.textContent = count > 0 ? `${count} รายการ` : 'ข้อมูลปัจจุบัน';

            modal.classList.add('active');
        },

        /**
         * Close the PDF Export modal
         */
        closeModal: function () {
            const modal = document.getElementById('pdfExportModal');
            if (modal) modal.classList.remove('active');
            this.setButtonLoading(false);
        },

        /**
         * Update Download button loading state
         */
        setButtonLoading: function (loading) {
            this.isExporting = loading;
            const btn = document.getElementById('btnPdfDownloadSubmit');
            if (!btn) return;

            if (loading) {
                btn.disabled = true;
                btn.innerHTML = `<span class="pdf-spinner" aria-hidden="true"></span> <span>กำลังสร้างไฟล์ PDF...</span>`;
            } else {
                btn.disabled = false;
                btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg><span>💾 บันทึกเป็น PDF (เลือกโฟลเดอร์ได้ / Save As...)</span>`;
            }
        },

        /**
         * Helper: Escape HTML
         */
        escapeHtml: function (str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        /**
         * Helper: Format Date
         */
        formatDate: function (dateStr) {
            if (!dateStr) return '-';
            const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (m) return `${m[3]}/${m[2]}/${m[1]}`;
            return dateStr;
        },

        /**
         * Build HTML document for Daily Report
         */
        buildDailyReportHtml: function () {
            const dateVal = document.getElementById('reportDate')?.value || new Date().toISOString().slice(0, 10);
            const shiftVal = document.querySelector('input[name="shift"]:checked')?.value || 'Day';
            const recorderEl = document.getElementById('recorderName');
            const recorderVal = (recorderEl && recorderEl.options && recorderEl.selectedIndex >= 0)
                ? recorderEl.options[recorderEl.selectedIndex].text
                : (recorderEl?.value || '-');

            const currentModel = document.getElementById('drModel')?.value || '';
            const currentGroup = document.getElementById('drProductGroup')?.value || '';
            const currentTime = document.getElementById('drTime')?.value || '';
            const currentProdQty = Number(document.getElementById('drProdQty')?.value) || 0;

            const rust = Number(document.getElementById('drRust')?.value) || 0;
            const dent = Number(document.getElementById('drDent')?.value) || 0;
            const colorDrop = Number(document.getElementById('drColorDrop')?.value) || 0;
            const thinPaint = Number(document.getElementById('drThinPaint')?.value) || 0;
            const thickPaint = Number(document.getElementById('drThickPaint')?.value) || 0;
            const waterStain = Number(document.getElementById('drWaterStain')?.value) || 0;
            const oil = Number(document.getElementById('drOil')?.value) || 0;
            const dust = Number(document.getElementById('drDust')?.value) || 0;
            const otherDefect = Number(document.getElementById('drOtherDefect')?.value) || 0;
            const currentDefectTotal = rust + dent + colorDrop + thinPaint + thickPaint + waterStain + oil + dust + otherDefect;

            // Get records: use draft records if present; otherwise use saved backend records
            let records = [];
            if (Array.isArray(window.dailyReportRecords) && window.dailyReportRecords.length > 0) {
                records = window.dailyReportRecords;
            } else if (typeof window.getSavedDailyReportRecords === 'function') {
                const all = window.getSavedDailyReportRecords();
                // Filter records for the selected date if possible, or take recent 25
                const filtered = all.filter(r => {
                    const rDate = String(r.date || r.Date || '');
                    return rDate.startsWith(dateVal);
                });
                records = filtered.length > 0 ? filtered : all.slice(0, 25);
            }

            // Calculate totals
            let totalProdSum = 0;
            let totalDefectSum = 0;
            records.forEach(r => {
                totalProdSum += Number(r.prodQty || r.ProdQty || r.qty || 0) || 0;
                const d = typeof window.getDailyReportDefectTotal === 'function'
                    ? window.getDailyReportDefectTotal(r)
                    : (Number(r.totalDefect || r.TotalDefect || 0) || 0);
                totalDefectSum += d;
            });

            const overallDefectRate = totalProdSum > 0 
                ? ((totalDefectSum / totalProdSum) * 100).toFixed(2) + '%'
                : '0.00%';

            const now = new Date();
            const timestampFormatted = `${now.toLocaleDateString('th-TH')} ${now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;

            // Build rows
            let rowsHtml = '';
            if (records.length === 0) {
                rowsHtml = `<tr><td colspan="9" style="text-align: center; padding: 14px; color: #64748b;">ยังไม่มีรายการบันทึกในระบบ</td></tr>`;
            } else {
                rowsHtml = records.map((r, i) => {
                    const model = r.model || r.Model || '-';
                    const timeSlot = r.timeSlot || r.TimeSlot || '-';
                    const pGroup = typeof window.getDailyReportProductGroup === 'function' ? window.getDailyReportProductGroup(r) : (r.productGroup || r.ProductGroup || '-');
                    const pName = typeof window.getDailyReportPartName === 'function' ? window.getDailyReportPartName(r) : (r.partName || r.PartName || '-');
                    const rShift = r.shift || r.Shift || shiftVal;
                    const qty = Number(r.prodQty || r.ProdQty || r.qty || 0) || 0;
                    const def = typeof window.getDailyReportDefectTotal === 'function' 
                        ? window.getDailyReportDefectTotal(r) 
                        : (Number(r.totalDefect || r.TotalDefect || 0) || 0);
                    const recorder = r.recorder || r.Recorder || recorderVal;
                    const rDate = this.formatDate(r.date || r.Date || dateVal);

                    return `
                        <tr>
                            <td style="text-align: center; font-weight: 700;">${i + 1}</td>
                            <td style="white-space: nowrap;">${this.escapeHtml(rDate)}</td>
                            <td style="font-weight: 700;">${this.escapeHtml(model)}</td>
                            <td style="text-align: center;">${this.escapeHtml(timeSlot)}</td>
                            <td>${this.escapeHtml(pGroup)}</td>
                            <td>${this.escapeHtml(pName)}</td>
                            <td style="text-align: center;">${this.escapeHtml(rShift)}</td>
                            <td style="text-align: right; font-weight: 800; color: #0284c7;">${qty.toLocaleString()}</td>
                            <td style="text-align: right; font-weight: 800; color: ${def > 0 ? '#dc2626' : '#64748b'};">${def.toLocaleString()}</td>
                            <td>${this.escapeHtml(recorder)}</td>
                        </tr>
                    `;
                }).join('');
            }

            // Current form section (if filled)
            let currentEntrySection = '';
            if (currentModel || currentProdQty > 0 || currentDefectTotal > 0) {
                currentEntrySection = `
                    <div class="pdf-sheet-section">
                        <div class="pdf-sheet-section-title">
                            <span>รายการที่กำลังกรอกข้อมูล / Current Entry</span>
                            <span style="color: #0284c7;">สถานะ: กำลังบันทึก</span>
                        </div>
                        <div class="pdf-sheet-grid-3" style="grid-template-columns: repeat(4, 1fr);">
                            <div>
                                <div class="pdf-sheet-grid-item-label">กลุ่มผลิตภัณฑ์</div>
                                <div class="pdf-sheet-grid-item-val">${this.escapeHtml(currentGroup || '-')}</div>
                            </div>
                            <div>
                                <div class="pdf-sheet-grid-item-label">รุ่นชิ้นงาน (Model)</div>
                                <div class="pdf-sheet-grid-item-val">${this.escapeHtml(currentModel || '-')}</div>
                            </div>
                            <div>
                                <div class="pdf-sheet-grid-item-label">ช่วงเวลา</div>
                                <div class="pdf-sheet-grid-item-val">${this.escapeHtml(currentTime || '-')}</div>
                            </div>
                            <div>
                                <div class="pdf-sheet-grid-item-label">ยอดผลิต (ชิ้น)</div>
                                <div class="pdf-sheet-grid-item-val" style="color: #0284c7;">${currentProdQty.toLocaleString()} ชิ้น</div>
                            </div>
                        </div>
                        <div style="padding: 6px 12px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; font-weight: 700; color: #334155;">
                            จำแนกของเสีย (Defect Breakdown):
                        </div>
                        <div class="pdf-defect-grid">
                            <div class="pdf-defect-box"><div class="pdf-defect-name">สนิม</div><div class="pdf-defect-qty ${rust === 0 ? 'zero' : ''}">${rust}</div></div>
                            <div class="pdf-defect-box"><div class="pdf-defect-name">บุบ/เสียรูป</div><div class="pdf-defect-qty ${dent === 0 ? 'zero' : ''}">${dent}</div></div>
                            <div class="pdf-defect-box"><div class="pdf-defect-name">เม็ดสี</div><div class="pdf-defect-qty ${colorDrop === 0 ? 'zero' : ''}">${colorDrop}</div></div>
                            <div class="pdf-defect-box"><div class="pdf-defect-name">สีบาง</div><div class="pdf-defect-qty ${thinPaint === 0 ? 'zero' : ''}">${thinPaint}</div></div>
                            <div class="pdf-defect-box"><div class="pdf-defect-name">สีหนา/ปูด</div><div class="pdf-defect-qty ${thickPaint === 0 ? 'zero' : ''}">${thickPaint}</div></div>
                            <div class="pdf-defect-box"><div class="pdf-defect-name">คราบน้ำ/จาระบี</div><div class="pdf-defect-qty ${waterStain === 0 ? 'zero' : ''}">${waterStain}</div></div>
                            <div class="pdf-defect-box"><div class="pdf-defect-name">คราบน้ำมัน</div><div class="pdf-defect-qty ${oil === 0 ? 'zero' : ''}">${oil}</div></div>
                            <div class="pdf-defect-box"><div class="pdf-defect-name">เศษฝุ่น</div><div class="pdf-defect-qty ${dust === 0 ? 'zero' : ''}">${dust}</div></div>
                            <div class="pdf-defect-box"><div class="pdf-defect-name">อื่นๆ</div><div class="pdf-defect-qty ${otherDefect === 0 ? 'zero' : ''}">${otherDefect}</div></div>
                            <div class="pdf-defect-box" style="background: #fee2e2; border-color: #fca5a5;"><div class="pdf-defect-name" style="color: #991b1b; font-weight: 700;">รวมของเสีย</div><div class="pdf-defect-qty" style="color: #dc2626;">${currentDefectTotal}</div></div>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="pdf-sheet">
                    <!-- Header -->
                    <div class="pdf-sheet-header">
                        <div class="pdf-sheet-brand-group">
                            <div class="pdf-sheet-logo">🎨</div>
                            <div class="pdf-sheet-titles">
                                <h1>PAINTING QUALITY INSPECTION SYSTEM</h1>
                                <h2>ใบรายงานการบันทึกการผลิตและของเสียประจำวัน (Daily Production & Quality Report)</h2>
                                <p>โรงพ่นสี Powder Coating Production & Quality Control</p>
                            </div>
                        </div>
                        <div class="pdf-sheet-meta-box">
                            <div>วันที่พิมพ์: <b>${timestampFormatted}</b></div>
                            <div>เอกสารเลขที่: <b>PR-${dateVal.replace(/-/g, '')}-${shiftVal}</b></div>
                            <div>สถานะ: <b>สมบูรณ์</b></div>
                        </div>
                    </div>

                    <!-- Section 1: ข้อมูลกะทำงาน -->
                    <div class="pdf-sheet-section">
                        <div class="pdf-sheet-section-title">
                            <span>ส่วนที่ 1: ข้อมูลกะทำงาน (Shift Information)</span>
                        </div>
                        <div class="pdf-sheet-grid-3">
                            <div>
                                <div class="pdf-sheet-grid-item-label">วันที่ผลิต (Date)</div>
                                <div class="pdf-sheet-grid-item-val">📅 ${this.formatDate(dateVal)}</div>
                            </div>
                            <div>
                                <div class="pdf-sheet-grid-item-label">กะทำงาน (Shift)</div>
                                <div class="pdf-sheet-grid-item-val">${shiftVal === 'Day' ? '☀️ กะกลางวัน (Day)' : '🌙 กะกลางคืน (Night)'}</div>
                            </div>
                            <div>
                                <div class="pdf-sheet-grid-item-label">ผู้บันทึกข้อมูล (Recorder)</div>
                                <div class="pdf-sheet-grid-item-val">👤 ${this.escapeHtml(recorderVal)}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Current Entry (if any) -->
                    ${currentEntrySection}

                    <!-- Section 2: ตารางรายการที่บันทึก -->
                    <div class="pdf-sheet-section">
                        <div class="pdf-sheet-section-title">
                            <span>ส่วนที่ 2: รายการบันทึกการผลิตทั้งหมดประจำวัน/กะ (Production Records)</span>
                            <span style="font-weight: 700; color: #0284c7;">รวม ${records.length} รายการ</span>
                        </div>
                        <table class="pdf-sheet-table">
                            <thead>
                                <tr>
                                    <th style="width: 32px;">#</th>
                                    <th>วันที่</th>
                                    <th>รุ่นงาน (Model)</th>
                                    <th>เวลา</th>
                                    <th>ProductGroup</th>
                                    <th>PartName</th>
                                    <th>กะ</th>
                                    <th style="text-align: right;">ยอดผลิต</th>
                                    <th style="text-align: right;">ยอดเสีย</th>
                                    <th>ผู้บันทึก</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHtml}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="7" style="text-align: right; padding-right: 12px;">ยอดรวมทั้งสิ้น (Total Summary):</td>
                                    <td style="text-align: right; color: #0284c7; font-size: 12px;">${totalProdSum.toLocaleString()}</td>
                                    <td style="text-align: right; color: #dc2626; font-size: 12px;">${totalDefectSum.toLocaleString()}</td>
                                    <td style="font-size: 10px; color: #64748b;">% Defect: <b>${overallDefectRate}</b></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <!-- Sign-off Block -->
                    <div class="pdf-sign-box">
                        <div class="pdf-sign-card">
                            <div class="pdf-sign-line"></div>
                            <div class="pdf-sign-label">
                                <span>ลงชื่อ: ผู้บันทึกข้อมูล (Operator)</span>
                                <span>วันที่: ......./......./.......</span>
                            </div>
                        </div>
                        <div class="pdf-sign-card">
                            <div class="pdf-sign-line"></div>
                            <div class="pdf-sign-label">
                                <span>ลงชื่อ: หัวหน้างาน / ผู้ตรวจสอบ (QC Supervisor)</span>
                                <span>วันที่: ......./......./.......</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        /**
         * Build HTML for Generic Tab (Dashboard, Line Efficiency, Screen, Rework, etc.)
         */
        buildGenericTabHtml: function (tabId) {
            const tabTitle = this.getTabTitle(tabId);
            const sourceEl = document.getElementById(tabId);
            if (!sourceEl) return '<div>ไม่พบข้อมูลแท็บ</div>';

            const now = new Date();
            const timestampFormatted = `${now.toLocaleDateString('th-TH')} ${now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;

            // Clone the element and convert canvas to image for crisp PDF rendering
            const clone = sourceEl.cloneNode(true);
            clone.style.display = 'block';

            // Replace any canvas in the clone with dataURL images from real canvases
            const realCanvases = sourceEl.querySelectorAll('canvas');
            const cloneCanvases = clone.querySelectorAll('canvas');
            realCanvases.forEach((c, idx) => {
                if (cloneCanvases[idx]) {
                    try {
                        const img = document.createElement('img');
                        img.src = c.toDataURL('image/png');
                        img.style.maxWidth = '100%';
                        img.style.height = 'auto';
                        img.style.display = 'block';
                        cloneCanvases[idx].parentNode.replaceChild(img, cloneCanvases[idx]);
                    } catch (e) {
                        console.warn('Canvas conversion warning:', e);
                    }
                }
            });

            // Strip interactive buttons from clone
            clone.querySelectorAll('button, .btn-primary-custom, .btn-secondary-custom, .btn-pdf-action, input[type="date"]').forEach(el => {
                if (el.tagName === 'INPUT') {
                    const span = document.createElement('span');
                    span.textContent = el.value || '-';
                    span.style.fontWeight = 'bold';
                    el.parentNode.replaceChild(span, el);
                } else if (el.tagName === 'BUTTON') {
                    el.style.display = 'none';
                }
            });

            return `
                <div class="pdf-sheet">
                    <div class="pdf-sheet-header">
                        <div class="pdf-sheet-brand-group">
                            <div class="pdf-sheet-logo">🎨</div>
                            <div class="pdf-sheet-titles">
                                <h1>PAINTING QUALITY INSPECTION SYSTEM</h1>
                                <h2>${this.escapeHtml(tabTitle)}</h2>
                                <p>รายงานข้อมูลระบบการตรวจสอบคุณภาพโรงพ่นสี</p>
                            </div>
                        </div>
                        <div class="pdf-sheet-meta-box">
                            <div>วันที่พิมพ์: <b>${timestampFormatted}</b></div>
                            <div>สถานะ: <b>สมบูรณ์</b></div>
                        </div>
                    </div>
                    <div class="pdf-sheet-body-content" style="background:#ffffff; color:#0f172a;">
                        ${clone.innerHTML}
                    </div>
                </div>
            `;
        },

        /**
         * Main PDF Generation & Export function
         */
        exportPdf: function (mode) {
            const tabId = this.activeTargetTab || 'daily-report-tab';

            if (mode === 'print') {
                this.closeModal();
                // Trigger native browser print dialog
                setTimeout(() => {
                    window.print();
                }, 300);
                return;
            }

            // Direct Download Mode via html2pdf
            this.setButtonLoading(true);

            // Container for rendering
            let container = document.getElementById('pdfHiddenContainer');
            if (!container) {
                container = document.createElement('div');
                container.id = 'pdfHiddenContainer';
                document.body.appendChild(container);
            }

            let reportHtml = '';
            if (tabId === 'daily-report-tab') {
                reportHtml = this.buildDailyReportHtml();
            } else {
                reportHtml = this.buildGenericTabHtml(tabId);
            }

            container.innerHTML = reportHtml;

            const dateStr = document.getElementById('reportDate')?.value || new Date().toISOString().slice(0, 10);
            const shiftStr = document.querySelector('input[name="shift"]:checked')?.value || 'Day';
            const cleanTabName = tabId.replace('-tab', '');
            const filename = `Painting_${cleanTabName}_${dateStr}_${shiftStr}.pdf`;

            // Check if html2pdf is available
            if (typeof window.html2pdf !== 'function') {
                console.warn('html2pdf not found, using window.print()');
                this.setButtonLoading(false);
                this.closeModal();
                window.print();
                return;
            }

            const opt = {
                margin: [8, 8, 8, 8],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    letterRendering: true,
                    scrollY: 0,
                    scrollX: 0
                },
                jsPDF: {
                    unit: 'mm',
                    format: 'a4',
                    orientation: 'portrait'
                },
                pagebreak: {
                    mode: ['avoid-all', 'css', 'legacy']
                }
            };

            const sheetElement = container.querySelector('.pdf-sheet') || container;

            // Generate blob
            window.html2pdf()
                .set(opt)
                .from(sheetElement)
                .outputPdf('blob')
                .then(async (pdfBlob) => {
                    // 1. If mode === 'saveAs' and showSaveFilePicker exists, let user choose save location
                    if (mode === 'saveAs' && window.showSaveFilePicker) {
                        try {
                            const handle = await window.showSaveFilePicker({
                                suggestedName: filename,
                                types: [{
                                    description: 'PDF Document (*.pdf)',
                                    accept: { 'application/pdf': ['.pdf'] }
                                }]
                            });
                            const writable = await handle.createWritable();
                            await writable.write(pdfBlob);
                            await writable.close();

                            this.setButtonLoading(false);
                            this.closeModal();
                            if (typeof window.showToast === 'function') {
                                window.showToast('✅ บันทึกไฟล์ PDF ไปยังโฟลเดอร์ที่เลือกเรียบร้อยแล้ว!', 'success');
                            }
                            container.innerHTML = '';
                            return;
                        } catch (err) {
                            if (err.name === 'AbortError') {
                                // User cancelled the picker dialog
                                this.setButtonLoading(false);
                                return;
                            }
                            // Fall through to auto-download if any unexpected error
                        }
                    }

                    // 2. Direct download into standard Downloads folder
                    const blobUrl = URL.createObjectURL(pdfBlob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

                    this.setButtonLoading(false);
                    this.closeModal();
                    if (typeof window.showToast === 'function') {
                        window.showToast('✅ บันทึกไฟล์ PDF ลงในโฟลเดอร์ Downloads แล้ว!', 'success');
                    }
                    container.innerHTML = '';
                })
                .catch(err => {
                    console.error('PDF export error:', err);
                    this.setButtonLoading(false);
                    if (typeof window.showToast === 'function') {
                        window.showToast('⚠️ ไม่สามารถแปลงเป็น PDF ได้อัตโนมัติ กำลังเปิดหน้าต่างพิมพ์...', 'warning');
                    }
                    setTimeout(() => {
                        this.closeModal();
                        window.print();
                    }, 500);
                });
        },

        /**
         * Direct quick export for Daily Report
         */
        exportDailyReport: function () {
            this.openModal('daily-report-tab');
        }
    };

    // Attach to window object
    window.PaintingPdfExport = PaintingPdfExport;

})(window, document);
