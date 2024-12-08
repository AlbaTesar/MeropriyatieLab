document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const logoutButton = document.getElementById('logoutButton');
  const deleteAccountButton = document.getElementById('deleteAccountButton');
  const applicationSection = document.getElementById('applicationSection');
  const applicationForm = document.getElementById('applicationForm');
  const eventSelect = document.getElementById('eventSelect');
  const applicantNameInput = document.getElementById('applicantName');
  const eventDescriptions = document.getElementById('eventDescriptions');

  // Функция для изменения видимости элементов
  function setElementVisibility(element, isVisible) {
    if (element) {
      element.style.display = isVisible ? 'block' : 'none';
    }
  }

  // Установка состояния аутентификации
  function setAuthState(isAuthenticated) {
    setElementVisibility(loginForm, !isAuthenticated);
    setElementVisibility(registerForm, !isAuthenticated);
    setElementVisibility(logoutButton, isAuthenticated);
    setElementVisibility(deleteAccountButton, isAuthenticated);
    setElementVisibility(applicationSection, isAuthenticated);
    setElementVisibility(eventDescriptions, isAuthenticated);

    if (isAuthenticated) {
      loadEvents();
      loadEventDescriptions();
    } else if (applicantNameInput) {
      applicantNameInput.value = '';
    }
  }

  // Логика входа
  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    try {
      const response = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        setAuthState(true);
      } else {
        alert('Ошибка: не удалось войти.');
      }
    } catch (error) {
      alert('Ошибка при входе: ' + error.message);
    }
  });

  // Логика регистрации
  registerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const newUsername = document.getElementById('newUsername').value;
    const newPassword = document.getElementById('newPassword').value;
    const newEmail = document.getElementById('newEmail').value;
    try {
      const response = await fetch('http://localhost:3000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, email: newEmail }),
      });
      const message = await response.text();
      alert(message);
    } catch (error) {
      alert('Ошибка при регистрации: ' + error.message);
    }
  });

  // Логика выхода
  logoutButton?.addEventListener('click', () => {
    localStorage.removeItem('token');
    setAuthState(false);
  });

  // Логика удаления аккаунта
  deleteAccountButton?.addEventListener('click', async () => {
    const confirmDelete = confirm('Вы уверены, что хотите удалить аккаунт? Это действие необратимо.');
    if (confirmDelete) {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Токен не найден. Попробуйте войти заново.');
        return;
      }

      try {
        const response = await fetch('http://localhost:3000/deleteAccount', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          alert('Аккаунт успешно удалён.');
          localStorage.removeItem('token');
          setAuthState(false);
          window.location.reload();
        } else {
          const message = await response.text();
          alert(`Не удалось удалить аккаунт: ${message}`);
        }
      } catch (error) {
        alert('Ошибка при удалении аккаунта: ' + error.message);
      }
    }
  });

  // Логика сброса пароля
  document.getElementById('forgotPasswordButton')?.addEventListener('click', () => {
    const email = prompt('Введите вашу почту для сброса пароля:');
    if (email) {
      fetch('http://localhost:3000/forgotPassword', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })
        .then((response) => {
          if (response.ok) {
            alert('Письмо для сброса пароля отправлено на вашу почту.');
          } else {
            throw new Error('Не удалось отправить письмо.');
          }
        })
        .catch((error) => {
          alert('Ошибка при сбросе пароля.');
        });
    }
  });

  // Загрузка мероприятий
  async function loadEvents() {
    try {
      const response = await fetch('http://localhost:3000/events', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const events = await response.json();
      eventSelect.innerHTML = '<option value="">Выберите мероприятие</option>';
      events.forEach((event) => {
        const option = document.createElement('option');
        option.value = event.id;
        option.textContent = `${event.name} (${event.date})`;
        eventSelect.appendChild(option);
      });
    } catch (error) {
      alert('Ошибка при загрузке мероприятий: ' + error.message);
    }
  }

  // Загрузка и отображение мероприятий в таблице
  async function loadEventDescriptions() {
    try {
      const response = await fetch('http://localhost:3000/events', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки мероприятий');
      }

      const events = await response.json();
      const eventTableBody = document.getElementById('eventTable').querySelector('tbody');
      eventTableBody.innerHTML = ''; // Очистить таблицу перед заполнением

      events.forEach((event) => {
        const row = document.createElement('tr');

        const nameCell = document.createElement('td');
        nameCell.textContent = event.name;
        row.appendChild(nameCell);

        const descriptionCell = document.createElement('td');
        descriptionCell.textContent = event.description;
        row.appendChild(descriptionCell);

        const dateCell = document.createElement('td');
        dateCell.textContent = event.date;
        row.appendChild(dateCell);

        eventTableBody.appendChild(row);
      });
    } catch (error) {
      alert('Ошибка при загрузке описаний мероприятий.');
    }
  }

  // Подача заявки
  applicationForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = applicantNameInput?.value.trim();
    const eventId = eventSelect.value;
    const token = localStorage.getItem('token');
    if (!eventId || !name) {
      alert('Заполните все поля');
      return;
    }
    try {
      const response = await fetch('http://localhost:3000/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, eventId }),
      });
      const message = await response.text();
      alert(message);
    } catch (error) {
      alert('Ошибка при подаче заявки: ' + error.message);
    }
  });

  // Проверка состояния авторизации при загрузке
  const token = localStorage.getItem('token');
  setAuthState(!!token);
});
