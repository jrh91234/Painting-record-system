// js/auth.js - Painting Quality Inspection Authentication Logic

const PaintingAuth = {
    currentUser: null,
    ready: false,
    users: [],
    permissionRefreshTimer: null,
    permissionOptions: [
        { key: "dashboard.read", label: "ดู Dashboard" },
        { key: "qc7.read", label: "ดู QC 7 TOOL" },
        { key: "qc.read", label: "ดู QC" },
        { key: "inspection.create", label: "บันทึกงานตรวจ" },
        { key: "daily_report.read", label: "ดูรายงานรายวัน" },
        { key: "rework.read", label: "ดู REWORK" },
        { key: "screen.read", label: "ดู Screen" },
        { key: "checklist.read", label: "ดูเช็กลิสก่อนเริ่มงาน" },
        { key: "events.read", label: "ดู Event (5M1E)" },
        { key: "spare_parts.read", label: "ดูคลังอะไหล่" },
        { key: "users.manage", label: "จัดการผู้ใช้งาน" }
    ],

    hasPermission(permission) {
        if (!this.currentUser) return false;
        const role = String(this.currentUser.role || "");
        if (role === "Super Admin" || role === "Admin" || String(this.currentUser.employeeId || "") === "69112") return true;
        return Array.isArray(this.currentUser.permissions) && this.currentUser.permissions.includes(permission);
    },

    applyPermissions() {
        document.querySelectorAll('.nav-link[data-permission], .mobile-nav-item[data-permission], .mobile-checklist-option[data-permission]').forEach(item => {
            if (this.hasPermission(item.dataset.permission)) {
                item.style.removeProperty('display');
            } else {
                // The navigation CSS uses display:flex !important, so a normal
                // inline display:none is ignored. Use an important inline rule
                // to make denied items actually disappear.
                item.style.setProperty('display', 'none', 'important');
            }
        });

        // Hide whole pages as well as their navigation controls. Without this,
        // a user who opened Dashboard before permissions changed could keep
        // seeing its data even after the menu item was removed.
        const pages = Array.from(document.querySelectorAll('.tab-page[data-permission]'));
        pages.forEach(page => {
            const allowed = this.hasPermission(page.dataset.permission);
            if (!allowed) {
                page.classList.remove('active');
                page.style.setProperty('display', 'none', 'important');
            } else {
                page.style.removeProperty('display');
            }
        });

        const activePage = document.querySelector('.tab-page.active');
        if ((!activePage || !this.hasPermission(activePage.dataset.permission)) && typeof switchTab === 'function') {
            const firstAllowedPage = pages.find(page => this.hasPermission(page.dataset.permission));
            if (firstAllowedPage) switchTab(firstAllowedPage.id);
        }

        // Restore a permitted tab requested by a shared URL, once, on the first
        // permission pass after load. Doing it on every 30 s refresh pulled
        // the user back to that page from whatever tab they had moved to.
        if (this.hashTabRestored) return;
        this.hashTabRestored = true;
        const requestedTab = window.location.hash.replace(/^#/, '');
        const requestedPage = pages.find(page => page.id === requestedTab);
        if (requestedPage && this.hasPermission(requestedPage.dataset.permission)
            && !requestedPage.classList.contains('active') && typeof switchTab === 'function') {
            switchTab(requestedTab);
        }
    },

    async refreshCurrentUserPermissions() {
        if (!this.currentUser || typeof getUsersAPI !== 'function') return;
        try {
            const liveUsers = await getUsersAPI();
            const liveUser = Array.isArray(liveUsers)
                ? liveUsers.find(user => String(user.employeeId || '').trim().toLowerCase() === String(this.currentUser.employeeId || '').trim().toLowerCase())
                : null;
            if (!liveUser) return;

            this.currentUser = {
                ...this.currentUser,
                ...liveUser,
                permissions: normalizeUserPermissions(liveUser.permissions, liveUser.role, liveUser.employeeId)
            };
            localStorage.setItem('PAINTING_CURRENT_USER', JSON.stringify(this.currentUser));
            this.updateUserHeaderUI();
        } catch (e) {
            console.warn('Unable to refresh live permissions:', e);
        }
    },

    async hashPassword(password) {
        if (!password) return "";
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(password + "PAINTING_SALT_2026");
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            console.error("Hash error:", e);
            return password;
        }
    },

    async init() {
        this.ready = false;
        const storedUser = localStorage.getItem("PAINTING_CURRENT_USER");
        if (storedUser) {
            let parsedUser = null;
            try {
                parsedUser = JSON.parse(storedUser);
            } catch (e) {
                localStorage.removeItem("PAINTING_CURRENT_USER");
            }

            if (parsedUser && typeof parsedUser === "object") {
                // Restore the local session first. A temporary API or page
                // initialization error must not turn a refresh into a logout.
                this.currentUser = parsedUser;
                this.currentUser.permissions = normalizeUserPermissions(this.currentUser.permissions, this.currentUser.role, this.currentUser.employeeId);

                // Do not leave the full-screen login shell above the app while
                // the live permission refresh is waiting on Google Sheets. The
                // stored session is already enough to unlock the UI; refresh
                // permissions in the background instead of blocking taps on
                // the mobile navigation bar.
                try {
                    this.updateUserHeaderUI();
                    this.hideAuthModal();
                    this.ready = true;
                    if (typeof window.initializePaintingApp === 'function') {
                        window.initializePaintingApp();
                    }
                } catch (e) {
                    console.error("Painting app initialization after session restore failed:", e);
                }

                // Permission synchronization must never block the restored
                // session or the page controls. A later refresh updates the
                // menu visibility through updateUserHeaderUI().
                Promise.resolve(this.refreshCurrentUserPermissions()).catch(e => {
                    console.warn("Unable to refresh permissions during session restore:", e);
                });
                return;
            }
        }

        // Show Auth Shell Modal if not logged in
        this.ready = true;
        this.showAuthModal();
        this.checkFirstTimeBootstrap();
    },

    showAuthModal() {
        const shell = document.getElementById("authShell");
        if (shell) {
            shell.removeAttribute("hidden");
            shell.style.display = "flex";
        }
        document.body.classList.add("auth-loading");
    },

    hideAuthModal() {
        const shell = document.getElementById("authShell");
        if (shell) {
            shell.setAttribute("hidden", "true");
            shell.style.display = "none";
        }
        document.body.classList.remove("auth-loading");
    },

    switchTab(tab) {
        const loginTab = document.getElementById("authTabLogin");
        const registerTab = document.getElementById("authTabRegister");
        const loginForm = document.getElementById("authLoginForm");
        const registerForm = document.getElementById("authRegisterForm");
        const msgEl = document.getElementById("authMessage");

        if (msgEl) {
            msgEl.setAttribute("hidden", "true");
            msgEl.innerText = "";
        }

        if (tab === "register") {
            if (loginTab) loginTab.classList.remove("active");
            if (registerTab) registerTab.classList.add("active");
            if (loginForm) loginForm.style.display = "none";
            if (registerForm) registerForm.style.display = "flex";
        } else {
            if (registerTab) registerTab.classList.remove("active");
            if (loginTab) loginTab.classList.add("active");
            if (registerForm) registerForm.style.display = "none";
            if (loginForm) loginForm.style.display = "flex";
        }
    },

    async checkFirstTimeBootstrap() {
        const noticeEl = document.getElementById("authSetupNotice");
        if (noticeEl) {
            noticeEl.style.display = "none";
            noticeEl.setAttribute("hidden", "true");
        }
        this.switchTab("login");
    },

    async handleLogin(event) {
        if (event) event.preventDefault();
        const empIdInput = document.getElementById("loginEmployeeId");
        const passInput = document.getElementById("loginPassword");
        const submitBtn = document.getElementById("loginSubmitBtn");
        const msgEl = document.getElementById("authMessage");

        const employeeId = empIdInput ? empIdInput.value.trim() : "";
        const password = passInput ? passInput.value.trim() : "";

        if (!employeeId || !password) {
            this.showMessage("กรุณากรอกรหัสพนักงานและรหัสผ่าน", "error");
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = "กำลังเข้าสู่ระบบ...";
        }

        try {
            const passHash = await this.hashPassword(password);
            let res = null;

            if (typeof loginUserAPI === "function") {
                res = await loginUserAPI(employeeId, passHash);
            }

            if (res && res.status === "success" && res.user) {
                this.currentUser = res.user;
                this.currentUser.permissions = normalizeUserPermissions(this.currentUser.permissions, this.currentUser.role, this.currentUser.employeeId);
                localStorage.setItem("PAINTING_CURRENT_USER", JSON.stringify(this.currentUser));
                this.updateUserHeaderUI();
                this.hideAuthModal();
                this.ready = true;
                if (typeof window.initializePaintingApp === 'function') {
                    window.initializePaintingApp();
                }
                if (typeof showToast === "function") {
                    showToast(`ยินดีต้อนรับคุณ ${res.user.displayName || res.user.employeeId}`, "success");
                }
            } else {
                const errText = (res && res.message) ? res.message : "รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง";
                this.showMessage(errText, "error");
            }
        } catch (err) {
            console.error("Login exception:", err);
            this.showMessage("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์", "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "เข้าสู่ระบบ";
            }
        }
    },

    async handleRegister(event) {
        if (event) event.preventDefault();
        const empId = document.getElementById("regEmployeeId")?.value.trim();
        const name = document.getElementById("regDisplayName")?.value.trim();
        const dept = document.getElementById("regDepartment")?.value.trim();
        const pass = document.getElementById("regPassword")?.value.trim();
        const passConfirm = document.getElementById("regPasswordConfirm")?.value.trim();
        const submitBtn = document.getElementById("regSubmitBtn");

        if (!empId || !name || !pass) {
            this.showMessage("กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง", "error");
            return;
        }

        if (pass.length < 6) {
            this.showMessage("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร", "error");
            return;
        }

        if (pass !== passConfirm) {
            this.showMessage("รหัสผ่านยืนยันไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง", "error");
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = "กำลังลงทะเบียน...";
        }

        try {
            const passHash = await this.hashPassword(pass);
            let res = null;

            if (typeof registerUserAPI === "function") {
                res = await registerUserAPI({
                    employeeId: empId,
                    displayName: name,
                    department: dept || "แผนกพ่นสี",
                    passwordHash: passHash
                });
            }

            if (res && res.status === "success") {
                if (res.isSuperAdmin) {
                    this.showMessage("สมัครสมาชิกสำเร็จ! คุณคือ Super Admin คนแรกของระบบ", "success");
                } else {
                    this.showMessage("ลงทะเบียนเรียบร้อย! กรุณารอการอนุมัติสิทธิ์จากผู้ดูแลระบบ", "info");
                }
                setTimeout(() => {
                    this.switchTab("login");
                    const empInput = document.getElementById("loginEmployeeId");
                    if (empInput) empInput.value = empId;
                }, 2000);
            } else {
                const errText = (res && res.message) ? res.message : "ไม่สามารถลงทะเบียนได้ กรุณาลองใหม่อีกครั้ง";
                this.showMessage(errText, "error");
            }
        } catch (err) {
            console.error("Register exception:", err);
            this.showMessage("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์", "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = "ส่งข้อมูลสมัครสมาชิก";
            }
        }
    },

    showMessage(text, type = "error") {
        const msgEl = document.getElementById("authMessage");
        if (!msgEl) return;

        msgEl.className = `auth-message ${type}`;
        msgEl.innerText = text;
        msgEl.removeAttribute("hidden");
    },

    updateUserHeaderUI() {
        const chipName = document.getElementById("userHeaderName");
        const chipRole = document.getElementById("userHeaderRole");
        const chipAvatar = document.getElementById("userHeaderAvatar");
        const settingsTabBtn = document.querySelector('.nav-link[data-permission="users.manage"], .nav-link[onclick*="settings"]');

        if (this.currentUser) {
            if (chipName) chipName.innerText = this.currentUser.displayName || this.currentUser.employeeId;
            const isAdminRole = this.currentUser.role === "Super Admin" || this.currentUser.role === "Admin";
            if (chipRole) chipRole.innerText = isAdminRole ? this.currentUser.role : (this.currentUser.department || "พนักงาน");
            if (chipAvatar) {
                const firstChar = String(this.currentUser.displayName || this.currentUser.employeeId).charAt(0).toUpperCase();
                chipAvatar.innerText = firstChar || "U";
            }

            // Show Settings (User Management) tab to whoever may manage users
            if (settingsTabBtn) {
                if (this.hasPermission("users.manage")) {
                    settingsTabBtn.style.display = "flex";
                } else {
                    settingsTabBtn.style.display = "none";
                }
            }
            this.applyPermissions();
            if (!this.permissionRefreshTimer) {
                this.permissionRefreshTimer = setInterval(() => this.refreshCurrentUserPermissions(), 30000);
            }
        }
    },

    logout() {
        if (confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
            localStorage.removeItem("PAINTING_CURRENT_USER");
            this.currentUser = null;
            window.location.reload();
        }
    },

    async loadUsers() {
        const container = document.getElementById("usersContainer");
        const pendingCountEl = document.getElementById("pendingUserCount");
        const activeCountEl = document.getElementById("activeUserCount");
        const disabledCountEl = document.getElementById("disabledUserCount");

        if (!container) return;

        if (typeof getUsersAPI === "function") {
            let users = await getUsersAPI();
            if (!Array.isArray(users)) users = [];
            this.users = users;

            // 1. Ensure 69112 (Mana Subintan) is ALWAYS present at the top as Super Admin
            const adminUser = {
                employeeId: "69112",
                displayName: "Mana Subintan",
                department: "Engineer (วิศวกร)",
                role: "Super Admin",
                status: "Active",
                lastLogin: new Date().toISOString()
            };

            // Reset any non-69112 user back to Inspector so only 69112 is Super Admin
            users = users.map(u => {
                const is69112 = String(u.employeeId).trim() === "69112";
                return {
                    ...u,
                    role: is69112 ? "Super Admin" : (u.role === "Super Admin" ? "Inspector" : (u.role || "Inspector")),
                    displayName: is69112 ? "Mana Subintan" : u.displayName
                };
            });

            const has69112 = users.some(u => String(u.employeeId).trim() === "69112");
            if (!has69112) {
                users.unshift(adminUser);
            }

            // 2. Sort: Mana Subintan (69112) FIRST, then PENDING users directly below, then Active, then Disabled
            users.sort((a, b) => {
                if (String(a.employeeId).trim() === "69112") return -1;
                if (String(b.employeeId).trim() === "69112") return 1;
                if (a.status === "Pending" && b.status !== "Pending") return -1;
                if (b.status === "Pending" && a.status !== "Pending") return 1;
                return 0;
            });

            let pending = 0, active = 0, disabled = 0;
            users.forEach(u => {
                if (u.status === "Pending") pending++;
                else if (u.status === "Disabled") disabled++;
                else active++;
            });

            if (pendingCountEl) pendingCountEl.innerText = pending;
            if (activeCountEl) activeCountEl.innerText = active;
            if (disabledCountEl) disabledCountEl.innerText = disabled;
            this.showUsersSource();

            container.innerHTML = users.map(u => {
                const isPending = u.status === "Pending";
                const isDisabled = u.status === "Disabled";
                const isSuper = String(u.employeeId).trim() === "69112";

                const isAdmin = !isSuper && u.role === "Admin";
                const roleBadgeClass = isSuper ? "badge-role-super" : (isAdmin ? "badge-role-admin" : "badge-role-inspector");
                const statusBadgeClass = isPending ? "badge-status-pending" : (isDisabled ? "badge-status-disabled" : "badge-status-active");
                const statusText = isPending ? "⏳ รออนุมัติ" : (isDisabled ? "🔴 ระงับใช้งาน" : "🟢 ใช้งานได้");

                return `
                    <div class="user-card" style="${isPending ? 'border: 1px solid #f59e0b; background: rgba(245, 158, 11, 0.08); box-shadow: 0 4px 15px rgba(245, 158, 11, 0.15);' : ''}">
                        <div class="user-card-info">
                            <div class="user-avatar" style="${isPending ? 'background: linear-gradient(135deg, #f59e0b, #d97706);' : ''}">${(u.displayName || u.employeeId || 'U').charAt(0).toUpperCase()}</div>
                            <div class="user-details">
                                <h4 style="display: flex; align-items: center; gap: 0.5rem;">
                                    ${u.displayName || u.employeeId} 
                                    <small style="color:#94a3b8; font-weight: 600;">(รหัส: ${u.employeeId})</small>
                                </h4>
                                <p style="color: #cbd5e1; margin-top: 0.2rem;">ตำแหน่ง: ${u.department || '-'} | ล่าสุด: ${u.createdAt || u.lastLogin || '-'}</p>
                                <div style="display: flex; gap: 0.4rem; margin-top: 0.4rem;">
                                    <span class="${roleBadgeClass}">${u.role || 'Inspector'}</span>
                                    <span class="${statusBadgeClass}">${statusText}</span>
                                </div>
                            </div>
                        </div>
                        <div class="user-card-actions" style="display: flex; gap: 0.5rem; align-items: center;">
                            ${!isSuper ? `<button class="btn-secondary-custom" style="padding: 0.5rem 0.8rem; font-size: 0.8rem;" onclick="PaintingAuth.openEditUserModal('${u.employeeId}')">✏️ แก้ไข</button>` : ''}
                            ${!isSuper && !isAdmin ? `<button class="btn-secondary-custom" style="padding: 0.5rem 0.8rem; font-size: 0.8rem;" onclick="PaintingAuth.openPermissionsModal('${u.employeeId}')">กำหนดสิทธิ์</button>` : ''}
                            ${isPending ? `
                                <button class="btn-primary-custom" style="padding: 0.6rem 1.25rem; font-size: 0.88rem; font-weight: 800; background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; border-radius: 10px; cursor: pointer; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);" onclick="PaintingAuth.approveUser('${u.employeeId}')">✅ อนุมัติ</button>
                                <button class="btn-secondary-custom" style="padding: 0.6rem 1.25rem; font-size: 0.88rem; font-weight: 800; background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; border: none; border-radius: 10px; cursor: pointer; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);" onclick="PaintingAuth.toggleUserStatus('${u.employeeId}', 'Disabled')">❌ ปฏิเสธ</button>
                            ` : (!isSuper ? `
                                ${isDisabled ? `
                                    <button class="btn-primary-custom" style="padding: 0.5rem 1rem; font-size: 0.82rem; background: #10b981; color: #fff; border: none; border-radius: 8px; cursor: pointer;" onclick="PaintingAuth.toggleUserStatus('${u.employeeId}', 'Active')">🟢 เปิดใช้งาน</button>
                                ` : `
                                    <button class="btn-secondary-custom" style="padding: 0.5rem 1rem; font-size: 0.82rem; background: #ef4444; color: #fff; border: none; border-radius: 8px; cursor: pointer;" onclick="PaintingAuth.toggleUserStatus('${u.employeeId}', 'Disabled')">🔴 ปิดใช้งาน</button>
                                `}
                            ` : `<span class="owner-badge">👑 เจ้าของระบบ</span>`)}
                        </div>
                    </div>
                `;
            }).join("");
        }
    },

    // Tell the admin whether the list is the live Users sheet or this
    // browser's cached copy (Apps Script unreachable).
    showUsersSource() {
        const box = document.getElementById("userManagementMessage");
        if (!box) return;
        const source = window.PAINTING_USERS_SOURCE;
        if (source === "cloud") {
            box.textContent = "☁️ ข้อมูลจาก Google Sheet (Users) — ทุกเครื่องเห็นชุดเดียวกัน";
            box.className = "auth-message success";
        } else {
            box.textContent = "⚠️ เชื่อมต่อ Google Sheet ไม่ได้ — กำลังแสดงข้อมูลที่จำไว้ในเครื่องนี้ การแก้ไขจะยังไม่ถูกบันทึก";
            box.className = "auth-message error";
        }
        box.hidden = false;
    },

    reportUserWrite(result, successText) {
        if (typeof showToast !== "function") return;
        if (result && result.status === "success") showToast(successText, "success");
        else showToast((result && result.message) || "บันทึกลง Google Sheet ไม่สำเร็จ", "error");
    },

    openPermissionsModal(employeeId) {
        const user = this.users.find(item => String(item.employeeId).trim() === String(employeeId).trim());
        const modal = document.getElementById("permissionModal");
        const options = document.getElementById("permissionOptions");
        const title = document.getElementById("permissionModalTitle");
        const idInput = document.getElementById("permissionEmployeeId");
        if (!user || !modal || !options) return;

        const selected = normalizeUserPermissions(user.permissions, user.role, user.employeeId);
        if (title) title.textContent = `กำหนดสิทธิ์: ${user.displayName || user.employeeId}`;
        if (idInput) idInput.value = user.employeeId;
        options.innerHTML = this.permissionOptions.map(option => `
            <label class="permission-option">
                <input type="checkbox" value="${option.key}" ${selected.includes(option.key) ? "checked" : ""}>
                <span>${option.label}</span>
            </label>
        `).join("");
        modal.classList.add("active");
    },

    closePermissionsModal() {
        const modal = document.getElementById("permissionModal");
        if (modal) modal.classList.remove("active");
    },

    async savePermissions() {
        const idInput = document.getElementById("permissionEmployeeId");
        const employeeId = idInput ? idInput.value : "";
        const user = this.users.find(item => String(item.employeeId).trim() === String(employeeId).trim());
        if (!user) return;

        const permissions = Array.from(document.querySelectorAll("#permissionOptions input[type=checkbox]:checked"))
            .map(input => input.value);
        const result = await updateUserStatusAPI(employeeId, user.status, user.role, permissions);
        if (result && result.status === "success") {
            this.closePermissionsModal();
            if (typeof showToast === "function") showToast(`บันทึกสิทธิ์ของ ${user.displayName || employeeId} แล้ว`, "success");
            await this.loadUsers();
        } else if (typeof showToast === "function") {
            showToast((result && result.message) || "บันทึกสิทธิ์ไม่สำเร็จ", "error");
        }
    },

    async approveUser(employeeId) {
        if (!confirm(`คุณต้องการอนุมัติการใช้งานให้รหัสพนักงาน ${employeeId} ใช่หรือไม่?`)) return;
        if (typeof updateUserStatusAPI === "function") {
            const result = await updateUserStatusAPI(employeeId, "Active");
            this.reportUserWrite(result, `อนุมัติรหัสพนักงาน ${employeeId} สำเร็จ`);
            this.loadUsers();
        }
    },

    async toggleUserStatus(employeeId, newStatus) {
        const actionName = newStatus === "Active" ? "เปิดใช้งาน" : "ระงับการใช้งาน";
        if (!confirm(`คุณต้องการ${actionName}รหัสพนักงาน ${employeeId} ใช่หรือไม่?`)) return;
        if (typeof updateUserStatusAPI === "function") {
            const result = await updateUserStatusAPI(employeeId, newStatus);
            this.reportUserWrite(result, `เปลี่ยนสถานะรหัสพนักงาน ${employeeId} เป็น ${newStatus} สำเร็จ`);
            this.loadUsers();
        }
    },

    // The add-user modal doubles as the edit form: in edit mode the employee
    // ID is locked and a "reset password" option appears.
    setUserModalMode(mode) {
        this.userModalMode = mode;
        const isEdit = mode === "edit";
        const title = document.getElementById("addUserModalTitle");
        const idInput = document.getElementById("adminAddEmpId");
        const resetRow = document.getElementById("adminResetPwRow");
        const resetBox = document.getElementById("adminResetPw");
        if (title) title.textContent = isEdit ? "✏️ แก้ไขข้อมูลผู้ใช้งาน" : "👤 เพิ่มผู้ใช้งาน / อนุมัติสิทธิ์พนักงาน";
        if (idInput) idInput.readOnly = isEdit;
        if (resetRow) resetRow.hidden = !isEdit;
        if (resetBox) resetBox.checked = false;
    },

    openAddUserModal() {
        const form = document.getElementById("addUserForm");
        if (form) form.reset();
        this.setUserModalMode("add");
        const modal = document.getElementById("addUserModal");
        if (modal) modal.classList.add("active");
    },

    openEditUserModal(employeeId) {
        const user = (this.users || []).find(item => String(item.employeeId).trim() === String(employeeId).trim());
        if (!user) return;
        this.setUserModalMode("edit");
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        };
        setValue("adminAddEmpId", user.employeeId);
        setValue("adminAddName", user.displayName || "");
        // Sheet rows may hold a department that is not one of the preset
        // options; add it so the current value is kept.
        const deptSelect = document.getElementById("adminAddDept");
        const dept = String(user.department || "").trim();
        if (deptSelect && dept && !Array.from(deptSelect.options).some(option => option.value === dept)) {
            deptSelect.add(new Option(dept, dept));
        }
        if (deptSelect && dept) deptSelect.value = dept;
        setValue("adminAddRole", user.role === "Admin" ? "Admin" : "Inspector");
        setValue("adminAddStatus", ["Active", "Pending", "Disabled"].includes(user.status) ? user.status : "Active");
        const modal = document.getElementById("addUserModal");
        if (modal) modal.classList.add("active");
    },

    closeAddUserModal() {
        const modal = document.getElementById("addUserModal");
        if (modal) modal.classList.remove("active");
    },

    async handleAdminAddUser(event) {
        if (event) event.preventDefault();
        const empId = document.getElementById("adminAddEmpId")?.value.trim();
        const name = document.getElementById("adminAddName")?.value.trim();
        const dept = document.getElementById("adminAddDept")?.value.trim();
        const status = document.getElementById("adminAddStatus")?.value || "Active";
        const role = document.getElementById("adminAddRole")?.value === "Admin" ? "Admin" : "Inspector";

        if (!empId || !name) {
            alert("กรุณากรอกรหัสพนักงานและชื่อ-นามสกุลให้ครบถ้วน");
            return;
        }

        const isEdit = this.userModalMode === "edit";
        const resetPassword = isEdit && !!document.getElementById("adminResetPw")?.checked;
        const userData = {
            employeeId: empId,
            displayName: name,
            department: dept,
            role: role,
            status: status,
            // New users start with 123456; an edit keeps the password unless reset.
            passwordHash: (!isEdit || resetPassword) ? await this.hashPassword("123456") : "",
            resetPassword: resetPassword
        };

        // Saving can take a few seconds; show it so the button never looks dead.
        const submitBtn = document.querySelector("#addUserForm button[type=submit]");
        const submitLabel = submitBtn ? submitBtn.innerHTML : "";
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "⏳ กำลังบันทึกลง Google Sheet..."; }
        let result;
        try {
            result = await upsertUserAPI(userData);
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = submitLabel; }
        }
        this.reportUserWrite(result, isEdit
            ? `บันทึกการแก้ไขรหัสพนักงาน ${empId} (${name}) แล้ว${resetPassword ? " · รหัสผ่านใหม่ 123456" : ""}`
            : `เพิ่ม/อนุมัติรหัสพนักงาน ${empId} (${name}) เรียบร้อยแล้ว`);
        if (!result || result.status !== "success") return;

        this.closeAddUserModal();
        this.loadUsers();
    }
};

// Expose the auth service for navigation guards and the app bootstrap layer.
// Top-level const bindings are not properties of window in regular scripts.
window.PaintingAuth = PaintingAuth;

window.addEventListener("storage", (e) => {
    if (e.key === "PAINTING_LOCAL_USERS") {
        PaintingAuth.loadUsers();
    }
});

document.addEventListener("DOMContentLoaded", () => {
    PaintingAuth.init();
});
