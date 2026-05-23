import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import './App.css';

interface Todo {
  id: string;
  text: string;
  category_id: string;
  completed: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface TodoFormData {
  text: string;
  categoryId: string;
}

interface ActionBackup {
  type: 'complete' | 'delete';
  todo: Todo;
  timerId: number;
}

const API_URL = 'http://localhost:5000';

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [backup, setBackup] = useState<ActionBackup | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TodoFormData>();

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [todosRes, catRes] = await axios.all([
          axios.get(`${API_URL}/todos`),
          axios.get(`${API_URL}/categories`)
        ]);
        setTodos(todosRes.data);
        setCategories(catRes.data);
        setGlobalError(null);
      } catch (err: any) {
        setGlobalError('Failed to fetch data from server. Is backend running?');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    return () => {
      if (backup) clearTimeout(backup.timerId);
    };
  }, [backup]);

  const onSubmit = async (data: TodoFormData) => {
    try {
      setGlobalError(null);
      const res = await axios.post(`${API_URL}/todos`, data);
      setTodos((prev) => [...prev, res.data]);
      reset({ text: '', categoryId: data.categoryId }); 
    } catch (err: any) {
      if (err.response && err.response.status === 400) {
        setGlobalError(err.response.data.error);
      } else {
        setGlobalError('An unexpected error occurred while adding task.');
      }
    }
  };

  const handleToggleComplete = (todo: Todo) => {
    if (backup) executeStoredAction();

    const updatedStatus = !todo.completed;
    
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed: updatedStatus } : t));
    setSnackbarMessage(updatedStatus ? `Task marked as completed` : `Task marked as active`);

    const timer = setTimeout(async () => {
      try {
        await axios.patch(`${API_URL}/todos/${todo.id}`, { completed: updatedStatus });
        setSnackbarMessage(null);
        setBackup(null);
      } catch (err) {
        setGlobalError('Failed to update task status on server.');
      }
    }, 5000);

    setBackup({
      type: 'complete',
      todo: todo,
      timerId: timer
    });
  };

  const handleDeleteClick = (todo: Todo) => {
    if (backup) executeStoredAction();

    setTodos(prev => prev.filter(t => t.id !== todo.id));
    setSnackbarMessage(`Task deleted`);

    const timer = setTimeout(async () => {
      try {
        await axios.delete(`${API_URL}/todos/${todo.id}`);
        setSnackbarMessage(null);
        setBackup(null);
      } catch (err) {
        setGlobalError('Failed to delete task from server.');
        setTodos(prev => [...prev, todo]);
      }
    }, 5000);

    setBackup({
      type: 'delete',
      todo,
      timerId: timer
    });
  };

  const handleUndo = () => {
    if (!backup) return;

    clearTimeout(backup.timerId);

    if (backup.type === 'complete') {
      setTodos(prev => prev.map(t => t.id === backup.todo.id ? { ...t, completed: backup.todo.completed } : t));
    } else if (backup.type === 'delete') {
      setTodos(prev => [...prev, backup.todo]);
    }

    setSnackbarMessage(null);
    setBackup(null);
  };

  const executeStoredAction = () => {
    if (!backup) return;
    clearTimeout(backup.timerId);
    if (backup.type === 'complete') {
      axios.patch(`${API_URL}/todos/${backup.todo.id}`, { completed: !backup.todo.completed });
    } else {
      axios.delete(`${API_URL}/todos/${backup.todo.id}`);
    }
    setBackup(null);
  };

  const filteredTodos = todos.filter(todo => 
    selectedCategory === 'all' ? true : todo.category_id === selectedCategory
  );

  return (
    <div className="container">
      <h1>Task Manager</h1>

      {globalError && <div className="error-banner">{globalError}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="todo-form">
        <div className="form-group">
          <label>Task Text</label>
          <input 
            type="text" 
            placeholder="What needs to be done?"
            className="input-field"
            {...register('text', { required: 'Task text is required' })}
          />
          {errors.text && <span className="error-text">{errors.text.message}</span>}
        </div>

        <div className="form-group">
          <label>Category</label>
          <select 
            className="select-field"
            {...register('categoryId', { required: 'Please select a category' })}
          >
            <option value="">-- Choose Category --</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          {errors.categoryId && <span className="error-text">{errors.categoryId.message}</span>}
        </div>

        <button type="submit" className="submit-btn">Add Task</button>
      </form>

      <div className="filter-section">
        <label style={{fontWeight: 'bold'}}>Filter by Category:</label>
        <select 
          className="select-field"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loader">Loading tasks...</div>
      ) : filteredTodos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div>No tasks found. Create one above!</div>
        </div>
      ) : (
        <ul className="todo-list">
          {filteredTodos.map(todo => {
            const isPendingThis = backup?.todo.id === todo.id && backup.type === 'complete';
            return (
              <li key={todo.id} className={`todo-item ${isPendingThis ? 'completed-pending' : ''}`}>
                <div className="todo-left">
                  <input 
                    type="checkbox" 
                    checked={todo.completed}
                    onChange={() => handleToggleComplete(todo)}
                  />
                  <span className={`todo-text ${todo.completed ? 'done' : ''}`}>
                    {todo.text}
                  </span>
                  <span className="category-badge">
                    {categories.find(c => c.id === todo.category_id)?.name || todo.category_id}
                  </span>
                </div>
                <button 
                  onClick={() => handleDeleteClick(todo)}
                  className="delete-btn"
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {snackbarMessage && (
        <div className="snackbar">
          <span>{snackbarMessage}</span>
          <button className="undo-btn" onClick={handleUndo}>Undo</button>
        </div>
      )}
    </div>
  );
}