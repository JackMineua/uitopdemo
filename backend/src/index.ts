import express, { Request, Response } from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const db = new Database(path.join(__dirname, 'database.sqlite'));

db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        category_id TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        FOREIGN KEY (category_id) REFERENCES categories(id)
    );
`);

const categoriesCheck = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
if (categoriesCheck.count === 0) {
    const insert = db.prepare("INSERT INTO categories (id, name) VALUES (?, ?)");
    insert.run('work', 'Work');
    insert.run('personal', 'Personal');
    insert.run('shopping', 'Shopping');
    insert.run('health', 'Health');
}

app.get('/categories', (req: Request, res: Response) => {
    try {
        const categories = db.prepare('SELECT * FROM categories').all();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/todos', (req: Request, res: Response) => {
    const { category } = req.query;
    try {
        let todos: any[];
        if (category && category !== 'all') {
            todos = db.prepare('SELECT * FROM todos WHERE category_id = ?').all(category);
        } else {
            todos = db.prepare('SELECT * FROM todos').all();
        }
        const formattedTodos = todos.map((todo: any) => ({
            ...todo,
            completed: !!todo.completed
        }));
        res.json(formattedTodos);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/todos', (req: Request, res: Response) => {
    const { text, categoryId } = req.body;
    if (!text || !categoryId) return res.status(400).json({ error: 'Text and categoryId are required' });

    try {
        const countResult = db.prepare('SELECT COUNT(*) as count FROM todos WHERE category_id = ? AND completed = 0').get(categoryId) as { count: number };

        if (countResult.count >= 5) {
            return res.status(400).json({ error: 'Maximum of 5 active tasks allowed per category' });
        }

        const id = Date.now().toString();
        db.prepare('INSERT INTO todos (id, text, category_id, completed) VALUES (?, ?, ?, 0)').run(id, text, categoryId);

        res.status(201).json({ id, text, category_id: categoryId, completed: false });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.patch('/todos/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { completed } = req.body;
    try {
        const completedValue = completed ? 1 : 0;
        const result = db.prepare('UPDATE todos SET completed = ? WHERE id = ?').run(completedValue, id);
        if (result.changes === 0) return res.status(404).json({ error: 'Todo not found' });
        res.json({ id, completed });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.delete('/todos/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const result = db.prepare('DELETE FROM todos WHERE id = ?').run(id);
        if (result.changes === 0) return res.status(404).json({ error: 'Todo not found' });
        res.json({ message: 'Todo deleted successfully', id });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});