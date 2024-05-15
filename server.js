const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads with increased limits
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

let users = {};

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('join', (username) => {
        users[username] = socket.id;
        socket.username = username;
        console.log(`${username} joined the chat`);
        io.emit('updateUserList', Object.keys(users));
    });

    socket.on('private message', ({ recipient, message, fileUrl }) => {
        if (users[recipient]) {
            io.to(users[recipient]).emit('private message', {
                sender: socket.username,
                message,
                fileUrl
            });
            // Emit read receipt
            socket.emit('read', recipient);
        }
    });

    socket.on('typing', ({ recipient, typing }) => {
        if (users[recipient]) {
            io.to(users[recipient]).emit('typing', { sender: socket.username, typing });
        }
    });

    socket.on('read', (recipient) => {
        if (users[recipient]) {
            io.to(users[recipient]).emit('read', socket.username);
        }
    });

    socket.on('disconnect', () => {
        console.log(`${socket.username} disconnected`);
        delete users[socket.username];
        io.emit('updateUserList', Object.keys(users));
    });
});

// Endpoint for file upload
app.post('/upload', upload.single('file'), (req, res) => {
    res.json({ fileUrl: `/uploads/${req.file.filename}` });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
