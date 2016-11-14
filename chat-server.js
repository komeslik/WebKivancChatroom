// Require the packages we will use:
var http = require("http"),
    socketio = require("socket.io")(http),
    url = require("url"),
    path = require("path"),
    mime = require("mime"),
    fs = require("fs");

var users = [];
var clients = [];
var roomid = 0;
var rooms = [{
    name: 'Lobby',
    pass: null,
    users: [],
    admin: null,
    banned: [],
    isMessage: false,
    receiver: null
}];

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp) {
    // This callback runs when a new connection is made to our HTTP server.

    var filename = path.join(__dirname, "", url.parse(req.url).pathname);
    (fs.exists || path.exists)(filename, function(exists) {
        if (exists) {
            fs.readFile(filename, function(err, data) {
                if (err) {
                    // File exists but is not readable (permissions issue?)
                    resp.writeHead(500, {
                        "Content-Type": "text/plain"
                    });
                    resp.write("Internal server error: could not read file");
                    resp.end();
                    return;
                }

                // File exists and is readable
                var mimetype = mime.lookup(filename);
                resp.writeHead(200, {
                    "Content-Type": mimetype
                });
                resp.write(data);
                resp.end();
                return;
            });
        } else {
            // File does not exist
            resp.writeHead(404, {
                "Content-Type": "text/plain"
            });
            resp.write("Requested file not found: " + filename);
            resp.end();
            return;
        }
    });
});
app.listen(3456);

//Do the Socket.IO magic:
var io = socketio.listen(app);
io.sockets.on("connection", function(socket) {
    // This callback runs when a new Socket.IO connection is established.
    console.log("connect");
    socket.on('newUser', function(data) {
        userInfo = {
            user: data,
            userid: users.length
        };
        var names = users.filter(function(val) {
            return val.user == data;
        });
        if (names.length > 0) {
            socket.emit('userTaken', data);
        } else {
            users.push(userInfo);
            socket.user = data;
            socket.userid = userInfo.userid;
            socket.info = userInfo;
            rooms[0].users.push(userInfo);
            socket.join("0");
            socket.room = 0;
            clients.push(socket);
            socket.emit('userSuccess', userInfo);
            io.sockets.emit('roomList', rooms);
        }
    });
    socket.on('joinRoom', function(data) {
        if (rooms[data.room].pass != null && data.passGuess != rooms[data.room].pass) {
            socket.emit('wrongPass');
        } else {
            rooms[roomid].users = rooms[roomid].users.filter(function(val) {
                return val.user != data.user;
            });
            socket.leave(socket.room);
            socket.join(data.room + "");
            roomid = data.room;
            socket.room = data.room;
            var names = rooms[data.room].users.filter(function(val) {
                return val.user == data.user;
            });
            if (names.length == 0) {
                userInfo = {
                    user: data.user,
                    userid: data.userid
                };
                rooms[data.room].users.push(userInfo);
            }
            socket.emit('enterRoom', rooms[data.room].name);
            io.sockets.emit('roomList', rooms);
        }
    });
    socket.on('newRoom', function(data) {
        rooms.push(data);
        io.sockets.emit('roomList', rooms);
    });
    socket.on('kick', function(data) {
        rooms[data.roomid].users = rooms[data.roomid].users.filter(function(val) {
            return val.userid != data.userid;
        });
        clients[data.userid].leave(clients[data.userid].room);``
        clients[data.userid].join("0");
        clients[data.userid].room = 0;
        rooms[0].users.push(clients[data.userid].info);
        clients[data.userid].emit('enterRoom', "Lobby");
        io.sockets.emit('roomList', rooms);
        clients[data.userid].emit('kicked');
    });
    socket.on('message_to_server', function(data) {
        // This callback runs when the server receives a new message from the client.

        console.log("message: " + data["message"]); // log it to the Node.JS output
        io.sockets.emit("message_to_client", {
                poster: socket.user + "",
                message: data["message"]
            }) // broadcast the message to other users
    });
});
