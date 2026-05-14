require('dotenv').config();
const express = require('express');
const session = require('express-session');
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

// セッションの設定
app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1日
}));

app.use(express.json());

// 認証チェック用ミドルウェア
const checkAuth = (req, res, next) => {
    if (req.session.isLoggedIn) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// ログイン処理
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        req.session.isLoggedIn = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// ログアウト処理
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// ルートアクセス制御
app.get('/', (req, res) => {
    if (req.session.isLoggedIn) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        res.sendFile(path.join(__dirname, 'login.html'));
    }
});

// 投票の登録 (保護)
app.post('/vote', checkAuth, (req, res) => {
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

// 集計結果の取得 (保護)
app.get('/votes', checkAuth, (req, res) => {
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

// 投票のリセット (保護)
app.delete('/votes', checkAuth, (req, res) => {
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
