// --- AUTH LOGIC ---

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showLoginBtn = document.getElementById('show-login');
const showRegisterBtn = document.getElementById('show-register');

function showLogin() {
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  showLoginBtn.classList.add('active');
  showRegisterBtn.classList.remove('active');
}

function showRegister() {
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  showRegisterBtn.classList.add('active');
  showLoginBtn.classList.remove('active');
}

// Set initial state (show login by default)
showLogin();

function setAuthState(authenticated, username = '') {
  const authContainer = document.getElementById('auth-section');
  const userInfo = document.getElementById('user-info');

  if (authenticated) {
    authContainer.classList.add('hidden');
    userInfo.classList.remove('hidden');
    document.getElementById('welcome-user').textContent = `Welcome, ${username}`;
  } else {
    authContainer.classList.remove('hidden');
    userInfo.classList.add('hidden');
  }
}

async function registerHandler(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  const msg = document.getElementById('register-msg');
  msg.textContent = '';
  try {
    const res = await authFetch('/api/auth/register', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({username, password})
    });
    const data = await res.json();
    msg.textContent = data.message || (res.ok ? "Registered! Please log in." : "Registration failed");
    if(res.ok) registerForm.reset();
  } catch(err) {
    msg.textContent = "Server error.";
  }
}

async function loginHandler(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const msg = document.getElementById('login-msg');
  msg.textContent = '';
  try {
    const res = await authFetch('/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({username, password})
    });
    const data = await res.json();
    msg.textContent = data.message || '';
    if (res.ok && data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', username);
      setAuthState(true, username);
      loginForm.reset();
      todoApp.loadTodos(); // load todos after login
    }
  } catch(err) {
    msg.textContent = "Server error.";
  }
}

function logoutHandler() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  setAuthState(false);
  todoApp.todoList.innerHTML = ''; // clear todos on logout
}

async function authFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': 'Bearer ' + (token || '')
    }
  });
}

// Add event listeners
registerForm.addEventListener('submit', registerHandler);
loginForm.addEventListener('submit', loginHandler);
document.getElementById('logout-btn').addEventListener('click', logoutHandler);
showLoginBtn.addEventListener('click', showLogin);
showRegisterBtn.addEventListener('click', showRegister);

// On page load, check login state and show appropriate UI
window.addEventListener('DOMContentLoaded', function() {
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  setAuthState(!!token && !!username, username);
  if(token) todoApp.loadTodos();
});


// --- TODO APP ---

class TodoApp {
  constructor() {
    this.todoList = document.getElementById('todoList');
    this.todoTitle = document.getElementById('todoTitle');
    this.todoDescription = document.getElementById('todoDescription');
    this.addBtn = document.getElementById('addBtn');

    this.init();
  }

  init() {
    this.addBtn.addEventListener('click', () => this.addTodo());
    this.todoTitle.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addTodo();
    });

    this.loadTodos();
  }

  async loadTodos() {
    try {
      const response = await authFetch('/api/todos');
      if (response.ok) {
        const todos = await response.json();
        this.renderTodos(todos);
      } else if (response.status === 401) {
        // Unauthorized, clear todos and prompt login
        this.todoList.innerHTML = '<div class="empty-state">Please login to see your todos.</div>';
      }
    } catch (error) {
      console.error('Error loading todos:', error);
    }
  }

  async addTodo() {
    const title = this.todoTitle.value.trim();
    const description = this.todoDescription.value.trim();

    if (!title) {
      alert('Please enter a todo title');
      return;
    }

    try {
      const response = await authFetch('/api/todos', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ title, description })
      });

      if (response.ok) {
        this.todoTitle.value = '';
        this.todoDescription.value = '';
        this.loadTodos();
      }
    } catch (error) {
      console.error('Error adding todo:', error);
    }
  }

  async toggleTodo(id, currentStatus) {
    try {
      const response = await authFetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ completed: !currentStatus })
      });

      if (response.ok) {
        this.loadTodos();
      }
    } catch (error) {
      console.error('Error updating todo:', error);
    }
  }

  async deleteTodo(id) {
    if (confirm('Are you sure you want to delete this todo?')) {
      try {
        const response = await authFetch(`/api/todos/${id}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          this.loadTodos();
        }
      } catch (error) {
        console.error('Error deleting todo:', error);
      }
    }
  }

  renderTodos(todos) {
    if (!todos || todos.length === 0) {
      this.todoList.innerHTML = '<div class="empty-state">No todos yet. Add one above!</div>';
      return;
    }

    this.todoList.innerHTML = todos.map(todo => `
      <div class="todo-item ${todo.completed ? 'completed' : ''}">
        <div class="todo-content">
          <div class="todo-title ${todo.completed ? 'completed' : ''}">${todo.title}</div>
          ${todo.description ? `<div class="todo-description">${todo.description}</div>` : ''}
          <div class="todo-date">Created: ${new Date(todo.createdAt).toLocaleDateString()}</div>
        </div>
        <div class="todo-actions">
          <button class="mark-btn ${todo.completed ? 'completed' : ''}" 
                  onclick="todoApp.toggleTodo('${todo._id}', ${todo.completed})">
            ${todo.completed ? 'Mark Unread' : 'Mark Read'}
          </button>
          <button class="delete-btn" onclick="todoApp.deleteTodo('${todo._id}')">
            Delete
          </button>
        </div>
      </div>
    `).join('');
  }
}

// Initialize the app when the page loads
const todoApp = new TodoApp();
