const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = 3000;

// データベースの初期化
const db = new sqlite3.Database('votes.db');

// テーブルの作成
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            option_name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 投票の登録
app.post('/vote', (req, res) => {
    const { option } = req.body;
    
    if (!option) {
        return res.status(400).json({ error: 'Option is required' });
    }

    const stmt = db.prepare('INSERT INTO votes (option_name) VALUES (?)');
    stmt.run(option, function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true });
    });
    stmt.finalize();
});

// 集計結果の取得
app.get('/votes', (req, res) => {
    db.all(`
        SELECT option_name as "option", COUNT(*) as count 
        FROM votes 
        GROUP BY option_name
    `, [], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// 投票のリセット
app.delete('/votes', (req, res) => {
    db.run('DELETE FROM votes', (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true });
    });
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
