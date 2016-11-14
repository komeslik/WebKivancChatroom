// Require the packages we will use:
var http = require("http"),
    socketio = require("socket.io")(http),
    url = require("url"),
    path = require("path"),
    mime = require("mime"),
    fs = require("fs");

var users = [];
//var clients = [];
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
        names = users.filter(function(val) {
            return val.user == data;
        });
        if (names.length > 0) {
            socket.emit('userTaken', data);
        } else {
            users.push(data);
            //clients.push(socket);
            socket.emit('userSuccess', data);
            socket.user = data;
            io.sockets.emit('userList', users);
            rooms[0].users.push(data);
            socket.join("0");
            socket.room = 0;
            socket.emit('roomList', rooms);
        }
    });
		socket.on('joinRoom', function(data){
			socket.leave(socket.room);
			socket.join(data.room + "");
			socket.room = data.room;
			rooms[data.room].users.push(data.user);
			io.sockets.emit('roomList', rooms);
		});
    socket.on('newRoom', function(data) {
        rooms.push(data);
        io.sockets.emit('roomList', rooms);
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
