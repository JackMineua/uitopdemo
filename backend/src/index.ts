import express, { Request, Response } from 'express';
import cors from 'cors';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let db: any;

(async () => {
    db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    await db.exec(`
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

    const categoriesCheck = await db.get('SELECT COUNT(*) as count FROM categories');
    if (categoriesCheck.count === 0) {
        await db.run("INSERT INTO categories (id, name) VALUES ('work', 'Work'), ('personal', 'Personal'), ('shopping', 'Shopping'), ('health', 'Health')");
    }
})();

app.get('/categories', async (req: Request, res: Response) => {
    try {
        const categories = await db.all('SELECT * FROM categories');
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/todos', async (req: Request, res: Response) => {
    const { category } = req.query;
    try {
        let todos;
        if (category && category !== 'all') {
            todos = await db.all('SELECT * FROM todos WHERE category_id = ?', [category]);
        } else {
            todos = await db.all('SELECT * FROM todos');
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

app.post('/todos', async (req: Request, res: Response) => {
    const { text, categoryId } = req.body;

    if (!text || !categoryId) {
        return res.status(400).json({ error: 'Text and categoryId are required' });
    }

    try {
        const countResult = await db.get(
            'SELECT COUNT(*) as count FROM todos WHERE category_id = ? AND completed = 0', 
            [categoryId]
        );

        if (countResult.count >= 5) {
            return res.status(400).json({ error: 'Maximum of 5 active tasks allowed per category' });
        }

        const id = Date.now().toString();
        await db.run(
            'INSERT INTO todos (id, text, category_id, completed) VALUES (?, ?, ?, 0)',
            [id, text, categoryId]
        );

        const newTodo = { id, text, category_id: categoryId, completed: false };
        res.status(201).json(newTodo);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.patch('/todos/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { completed } = req.body;

    try {
        const todo = await db.get('SELECT * FROM todos WHERE id = ?', [id]);
        if (!todo) {
            return res.status(404).json({ error: 'Todo not found' });
        }

        const completedValue = completed ? 1 : 0;
        await db.run('UPDATE todos SET completed = ? WHERE id = ?', [completedValue, id]);
        
        res.json({ id, completed });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.delete('/todos/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const todo = await db.get('SELECT * FROM todos WHERE id = ?', [id]);
        if (!todo) {
            return res.status(404).json({ error: 'Todo not found' });
        }
        await db.run('DELETE FROM todos WHERE id = ?', [id]);
        res.json({ message: 'Todo deleted successfully', id });
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});