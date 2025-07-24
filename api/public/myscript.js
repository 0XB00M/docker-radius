const apiUrl = 'http://localhost:3002/users';
let allUsers = [];
let filteredUsers = [];
const pageSize = 10;
let currentPage = 1;
let deletingUsers = new Set();

const tbody = document.querySelector('#userTable tbody');
const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
const selectAllCheckbox = document.getElementById('selectAll');
const searchInput = document.getElementById('searchInput');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const totalUsersSpan = document.getElementById('totalUsers');
const selectedCountSpan = document.getElementById('selectedCount');
const bulkDeleteConfirmation = document.getElementById('bulkDeleteConfirmation');
const confirmDeleteCount = document.getElementById('confirmDeleteCount');
const bulkDeleteSpinner = document.getElementById('bulkDeleteSpinner');

async function loadUsers() {
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error('Failed to fetch users');
    allUsers = await res.json();
    totalUsersSpan.textContent = allUsers.length;
    currentPage = 1;
    applyFilterAndPagination();
  } catch (error) {
    showNotification('Error loading users: ' + error.message, 'error');
  }
}

function applyFilterAndPagination() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  filteredUsers = allUsers.filter(u => u.username.toLowerCase().includes(searchTerm));
  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1 && totalPages >= 1) currentPage = 1;

  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages;
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

  renderUsers();
  attachCheckboxListeners();
  attachDeleteListeners();
  updateBulkDeleteBtn();
}

function renderUsers() {
  tbody.innerHTML = '';
  const startIdx = (currentPage - 1) * pageSize;
  const pageUsers = filteredUsers.slice(startIdx, startIdx + pageSize);

  if (pageUsers.length === 0) {
    tbody.innerHTML = `
                    <tr>
                        <td colspan="11" class="empty-state">
                            <i class="fas fa-users"></i>
                            <div>No users found.</div>
                        </td>
                    </tr>
                `;
    return;
  }

  pageUsers.forEach(u => {
    const row = tbody.insertRow();
    const isDeleting = deletingUsers.has(u.username);

    if (isDeleting) {
      row.classList.add('deleting');
    }

    let statusClass = '';
    let statusText = '';
    if (u.status === 'Online') {
      statusClass = 'status-online';
      statusText = 'Online';
    } else if (u.status === 'Terminated') {
      statusClass = 'status-terminated';
      statusText = 'Terminated';
    } else {
      statusClass = 'status-never';
      statusText = 'Never Connected';
    }

    row.innerHTML = `
                    <td>
                        <input type="checkbox" class="selectUser checkbox-custom" data-username="${u.username}" ${isDeleting ? 'disabled' : ''} />
                    </td>
                    <td><strong>${u.username}</strong></td>
                    <td>${u.ip_address || 'N/A'}</td>
                    <td>
                        <span class="status-badge ${statusClass}">
                            <span class="status-dot"></span>
                            ${statusText}
                        </span>
                    </td>
                    <td>${(u.download_mb || 0).toFixed(2)}</td>
                    <td>${(u.upload_mb || 0).toFixed(2)}</td>
                    <td>${u.mac_address || 'N/A'}</td>
                    <td>${u.start_time ? new Date(u.start_time).toLocaleString() : 'N/A'}</td>
                    <td>${u.stop_time ? new Date(u.stop_time).toLocaleString() : 'N/A'}</td>
                    <td>${u.duration || 'N/A'}</td>
                    <td>
                        <button class="btn btn-danger btn-sm btn-delete" data-username="${u.username}" ${isDeleting ? 'disabled' : ''}>
                            ${isDeleting ? '<span class="loading-spinner"></span>' : '<i class="fas fa-trash"></i>'}
                        </button>
                    </td>
                `;
  });
}

function attachDeleteListeners() {
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.onclick = async () => {
      const username = btn.getAttribute('data-username');
      if (deletingUsers.has(username)) return;

      if (confirm(`Are you sure you want to delete user "${username}"?`)) {
        deletingUsers.add(username);
        renderUsers();

        try {
          const res = await fetch(`${apiUrl}/${encodeURIComponent(username)}`, { method: 'DELETE' });
          if (res.ok) {
            allUsers = allUsers.filter(u => u.username !== username);
            filteredUsers = filteredUsers.filter(u => u.username !== username);
            totalUsersSpan.textContent = allUsers.length;
            showNotification(`User "${username}" deleted successfully`, 'success');
            applyFilterAndPagination();
          } else {
            const err = await res.json();
            showNotification('Error: ' + (err.error || 'Failed to delete user'), 'error');
          }
        } catch (error) {
          showNotification('Network error: ' + error.message, 'error');
        } finally {
          deletingUsers.delete(username);
          renderUsers();
        }
      }
    };
  });
}

function attachCheckboxListeners() {
  const checkboxes = document.querySelectorAll('.selectUser');
  checkboxes.forEach(chk => {
    chk.onchange = updateBulkDeleteBtn;
  });

  selectAllCheckbox.onchange = () => {
    const enabledCheckboxes = document.querySelectorAll('.selectUser:not(:disabled)');
    enabledCheckboxes.forEach(chk => (chk.checked = selectAllCheckbox.checked));
    updateBulkDeleteBtn();
  };
}

function updateBulkDeleteBtn() {
  const allCheckboxes = document.querySelectorAll('.selectUser');
  const enabledCheckboxes = document.querySelectorAll('.selectUser:not(:disabled)');
  const selectedCount = document.querySelectorAll('.selectUser:checked').length;

  bulkDeleteBtn.disabled = selectedCount === 0;
  selectedCountSpan.textContent = selectedCount;

  document.getElementById('clearSelectionBtn').disabled = selectedCount === 0;

  const allEnabledChecked = selectedCount === enabledCheckboxes.length && enabledCheckboxes.length > 0;
  selectAllCheckbox.checked = allEnabledChecked;
  selectAllCheckbox.indeterminate = selectedCount > 0 && !allEnabledChecked;
}

bulkDeleteBtn.onclick = () => {
  const selectedCheckboxes = Array.from(document.querySelectorAll('.selectUser:checked'));
  if (selectedCheckboxes.length === 0) return;
  confirmDeleteCount.textContent = selectedCheckboxes.length;
  bulkDeleteConfirmation.style.display = 'block';
};

document.getElementById('confirmBulkDelete').onclick = async () => {
  const selectedCheckboxes = Array.from(document.querySelectorAll('.selectUser:checked'));
  if (selectedCheckboxes.length === 0) return;

  bulkDeleteConfirmation.style.display = 'none';
  bulkDeleteSpinner.style.display = 'inline-block';
  bulkDeleteBtn.disabled = true;

  const usersToDelete = selectedCheckboxes.map(chk => chk.getAttribute('data-username'));
  usersToDelete.forEach(username => deletingUsers.add(username));
  renderUsers();

  try {
    const res = await fetch(`${apiUrl}/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: usersToDelete })
    });

    const result = await res.json();
    if (res.status === 200 || res.status === 207) {
      if (result.successCount > 0) {
        showNotification(`${result.successCount} user(s) deleted successfully`, 'success');
      }
      if (result.failCount > 0) {
        showNotification(`Failed to delete ${result.failCount} user(s)`, 'error');
      }

      allUsers = allUsers.filter(u => !result.successful.some(s => s.username === u.username));
      filteredUsers = filteredUsers.filter(u => !result.successful.some(s => s.username === u.username));
      totalUsersSpan.textContent = allUsers.length;
    } else {
      showNotification('Error: ' + (result.error || 'Failed to perform bulk delete'), 'error');
    }
  } catch (error) {
    showNotification('Network error: ' + error.message, 'error');
  } finally {
    usersToDelete.forEach(username => deletingUsers.delete(username));
    bulkDeleteSpinner.style.display = 'none';
    applyFilterAndPagination();
    selectAllCheckbox.checked = false;
    updateBulkDeleteBtn();
  }
};

document.getElementById('cancelBulkDelete').onclick = () => {
  bulkDeleteConfirmation.style.display = 'none';
};

document.getElementById('selectAllBtn').onclick = () => {
  const enabledCheckboxes = document.querySelectorAll('.selectUser:not(:disabled)');
  enabledCheckboxes.forEach(chk => chk.checked = true);
  selectAllCheckbox.checked = true;
  updateBulkDeleteBtn();
};

document.getElementById('clearSelectionBtn').onclick = () => {
  document.querySelectorAll('.selectUser').forEach(chk => chk.checked = false);
  selectAllCheckbox.checked = false;
  selectAllCheckbox.indeterminate = false;
  updateBulkDeleteBtn();
};

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
                <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
                <div><i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}</div>
            `;
  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

prevPageBtn.onclick = () => {
  if (currentPage > 1) {
    currentPage--;
    applyFilterAndPagination();
  }
};

nextPageBtn.onclick = () => {
  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  if (currentPage < totalPages) {
    currentPage++;
    applyFilterAndPagination();
  }
};

searchInput.oninput = () => {
  currentPage = 1;
  applyFilterAndPagination();
};

document.getElementById('addUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    showNotification('Please enter username and password', 'error');
    return;
  }

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (res.ok) {
      showNotification('User added successfully!', 'success');
      document.getElementById('addUserForm').reset();
      await loadUsers();
    } else {
      const error = await res.json();
      showNotification('Error: ' + (error.error || 'Failed to add user'), 'error');
    }
  } catch (error) {
    showNotification('Network error: ' + error.message, 'error');
  }
});

async function uploadBulkUsers() {
  const fileInput = document.getElementById('fileUpload');
  const file = fileInput.files[0];

  if (!file) {
    showNotification('Please select a file to upload.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const users = XLSX.utils.sheet_to_json(sheet);

    if (users.length === 0) {
      showNotification('No users found in the file.', 'error');
      return;
    }

    const usersToUpload = users.map(row => ({
      username: String(row.username).trim(),
      password: String(row.password || 'default_password')
    }));

    let successCount = 0;
    let failCount = 0;
    let failedUsers = [];

    for (const user of usersToUpload) {
      if (!user.username) {
        failCount++;
        failedUsers.push('(Missing username)');
        continue;
      }

      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user.username, password: user.password })
        });

        if (res.ok) {
          successCount++;
        } else {
          const err = await res.json();
          failCount++;
          failedUsers.push(`${user.username}: ${err.error || res.statusText}`);
        }
      } catch (error) {
        failCount++;
        failedUsers.push(`${user.username}: Network error - ${error.message}`);
      }
    }

    showNotification(`Bulk upload complete! Successful: ${successCount}, Failed: ${failCount}`, successCount > 0 ? 'success' : 'error');

    if (failedUsers.length > 0 && failedUsers.length <= 10) {
      alert('Details of failed uploads:\n' + failedUsers.join('\n'));
    } else if (failedUsers.length > 10) {
      alert(`Details of first 10 failed uploads:\n` + failedUsers.slice(0, 10).join('\n') + `\n...and ${failedUsers.length - 10} more.`);
    }

    fileInput.value = '';
    await loadUsers();
  };

  reader.readAsArrayBuffer(file);
}

document.addEventListener('DOMContentLoaded', loadUsers);
setInterval(loadUsers, 30000);