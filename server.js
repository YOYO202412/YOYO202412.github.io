// server.js - 后端服务器代码
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// 中间件设置
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.')); // 服务静态文件（HTML、CSS、JS）

// 数据文件路径
const USERS_FILE = 'users.json';
const CONTRACTS_FILE = 'contracts.json';

// 初始化数据文件
function initDataFiles() {
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify({}));
    }
    if (!fs.existsSync(CONTRACTS_FILE)) {
        fs.writeFileSync(CONTRACTS_FILE, JSON.stringify([]));
    }
}

// 读取用户数据
function readUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

// 保存用户数据
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 读取合同数据
function readContracts() {
    try {
        const data = fs.readFileSync(CONTRACTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

// 保存合同数据
function saveContracts(contracts) {
    fs.writeFileSync(CONTRACTS_FILE, JSON.stringify(contracts, null, 2));
}

// API路由

// 用户注册
app.post('/api/register', (req, res) => {
    const { username, password, realName, phone, idCard, inviteCode } = req.body;
    
    // 验证邀请码
    if (inviteCode !== 'cnyoyo') {
        return res.json({ success: false, message: '邀请码不正确' });
    }
    
    const users = readUsers();
    
    if (users[username]) {
        return res.json({ success: false, message: '用户名已存在' });
    }
    
    // 创建新用户
    users[username] = {
        password: password,
        nickname: username,
        realName: realName,
        phone: phone,
        idCard: idCard,
        examRecords: [],
        examCalendar: {},
        banned: false,
        createTime: new Date().toISOString()
    };
    
    saveUsers(users);
    
    res.json({ 
        success: true, 
        message: '注册成功',
        user: {
            username: username,
            nickname: username,
            realName: realName,
            phone: phone,
            idCard: idCard
        }
    });
});

// 用户登录
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // 管理员账号检查
    if (username === 'mdmin' && password === 'mdmin123') {
        return res.json({
            success: true,
            token: 'admin_token',
            user: {
                username: 'mdmin',
                nickname: '管理员',
                isAdmin: true
            }
        });
    }
    
    const users = readUsers();
    const user = users[username];
    
    if (!user) {
        return res.json({ success: false, message: '用户不存在' });
    }
    
    if (user.banned) {
        return res.json({ success: false, message: '账号已被封禁' });
    }
    
    if (user.password !== password) {
        return res.json({ success: false, message: '密码错误' });
    }
    
    res.json({
        success: true,
        token: username + '_token', // 简单的token
        user: {
            username: username,
            nickname: user.nickname,
            realName: user.realName,
            phone: user.phone,
            idCard: user.idCard,
            examRecords: user.examRecords || [],
            examCalendar: user.examCalendar || {},
            isAdmin: false
        }
    });
});

// 保存考试记录
app.post('/api/save-exam', (req, res) => {
    const { username, examRecord } = req.body;
    
    const users = readUsers();
    const user = users[username];
    
    if (!user) {
        return res.json({ success: false, message: '用户不存在' });
    }
    
    // 添加到考试记录
    if (!user.examRecords) user.examRecords = [];
    user.examRecords.push(examRecord);
    
    // 更新考试日历
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    if (!user.examCalendar) user.examCalendar = {};
    user.examCalendar[dateStr] = true;
    
    saveUsers(users);
    
    res.json({ success: true, message: '考试记录保存成功' });
});

// 保存合同
app.post('/api/save-contract', (req, res) => {
    const contractData = req.body;
    
    const contracts = readContracts();
    contracts.push(contractData);
    
    saveContracts(contracts);
    
    res.json({ success: true, message: '合同保存成功' });
});

// 获取用户合同列表
app.get('/api/user-contracts/:username', (req, res) => {
    const { username } = req.params;
    const contracts = readContracts();
    
    const userContracts = contracts.filter(contract => contract.nickname === username);
    
    res.json({ success: true, contracts: userContracts });
});

// 管理员获取所有用户
app.get('/api/admin/users', (req, res) => {
    const users = readUsers();
    
    // 移除密码字段
    const userList = Object.keys(users).map(username => {
        const user = { ...users[username] };
        delete user.password;
        return { username, ...user };
    });
    
    res.json({ success: true, users: userList });
});

// 管理员获取所有合同
app.get('/api/admin/contracts', (req, res) => {
    const contracts = readContracts();
    res.json({ success: true, contracts: contracts });
});

// 管理员操作用户
app.post('/api/admin/user-action', (req, res) => {
    const { action, username, data } = req.body;
    const users = readUsers();
    
    if (!users[username]) {
        return res.json({ success: false, message: '用户不存在' });
    }
    
    switch (action) {
        case 'ban':
            users[username].banned = true;
            break;
        case 'unban':
            users[username].banned = false;
            break;
        case 'delete':
            delete users[username];
            break;
        case 'update':
            Object.assign(users[username], data);
            break;
    }
    
    saveUsers(users);
    res.json({ success: true, message: '操作成功' });
});

// 提供前端页面
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '001.html'));
});

// 启动服务器
app.listen(PORT, () => {
    initDataFiles();
    console.log(`🚀 服务器启动成功！`);
    console.log(`📱 网站地址: http://localhost:${PORT}`);
    console.log(`💾 数据将保存在: ${USERS_FILE} 和 ${CONTRACTS_FILE}`);
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    console.error('服务器错误:', error);
});
