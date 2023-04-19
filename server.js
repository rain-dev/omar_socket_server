const express = require('express');
const app = express();
const path = require('path');
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = 6666;

server.listen(port, () => {
	console.log('Server listening at port %d', port);
});
// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

let numUsers = 0;
let userObjs = [];


io.on('connection', (socket) => {
	let addedUser = false;

  socket.on('chat-with-user-b', function(IdOfUserB){
    var roomID = IdOfUserB + '_' + socket.id; // create a unique room id
    socket.join(roomID); // make user A join room
    io.sockets[IdOfUserB].join(roomID); // make user B join  room
    io.sockets.in(roomID).emit('chat-with-me', roomID);  // send join event to both.
 });

	// when the client emits 'new message', this listens and executes
	socket.on('new message', (data) => {
		// we tell the client to execute 'new message'
		socket.broadcast.emit('new message', {
			username: socket.username,
			message: data
		});
	});

	// when the client emits 'add user', this listens and executes
	socket.on('add user', (username) => {
		if (addedUser) return;

		// we store the username in the socket session for this client
		userObjs.push({
			username: username,
			usernum: numUsers
		});
		socket.broadcast.emit('view_list', userObjs);
		socket.username = username;
		++numUsers;
		addedUser = true;
		socket.emit('login', {
			numUsers: numUsers
		});
		// echo globally (all clients) that a person has connected
		socket.broadcast.emit('user joined', {
			username: socket.username,
			numUsers: numUsers
		});
	});

	// when the client emits 'typing', we broadcast it to others
	socket.on('view_list', () => {
		socket.broadcast.emit('view_list', userObjs);
	});

	// when the client emits 'typing', we broadcast it to others
	socket.on('typing', () => {
		socket.broadcast.emit('typing', {
			username: socket.username
		});
	});

	// when the client emits 'stop typing', we broadcast it to others
	socket.on('stop typing', () => {
		socket.broadcast.emit('stop typing', {
			username: socket.username
		});
	});

	// when the user disconnects.. perform this
	socket.on('disconnect', () => {
		if (addedUser) {
			--numUsers;

			// echo globally that this client has left
			socket.broadcast.emit('user left', {
				username: socket.username,
				numUsers: numUsers
			});
		}
	});


	socket.on('uploadFileStart', function (data) { //data contains the variables that we passed through in the html file
			var fileName = data['Name'];
			var fileSize = data['Size'];
			var Place = 0;

			var uploadFilePath = 'Temp/' + fileName;

			console.log('uploadFileStart # Uploading file: %s to %s. Complete file size: %d', fileName, uploadFilePath, fileSize);

			Files[fileName] = {  //Create a new Entry in The Files Variable
					FileSize    : fileSize,
					Data        : "",
					Downloaded  : 0
			}        

			fs.open(uploadFilePath, "a", 0755, function(err, fd){
					if(err) {
							console.log(err);
					}
					else {
							console.log('uploadFileStart # Requesting Place: %d Percent %d', Place, 0);

							Files[fileName]['Handler'] = fd; //We store the file handler so we can write to it later
							socket.emit('uploadFileMoreDataReq', { 'Place' : Place, 'Percent' : 0 });

							// Send webclient upload progress..
					}
			});
	});

	socket.on('uploadFileChuncks', function (data){
			var Name = data['Name'];
			var base64Data = data['Data'];
			var playload = new Buffer(base64Data, 'base64').toString('binary');

			console.log('uploadFileChuncks # Got name: %s, received chunk size %d.', Name, playload.length);

			Files[Name]['Downloaded'] += playload.length;
			Files[Name]['Data'] += playload;        
			
			if(Files[Name]['Downloaded'] == Files[Name]['FileSize']) //If File is Fully Uploaded
			{

					console.log('uploadFileChuncks # File %s receive completed', Name);

					fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, Writen){
						 // close the file
						 fs.close(Files[Name]['Handler'], function() {
								console.log('file closed');
						 });

							// Notify android client we are done.
							socket.emit('uploadFileCompleteRes', { 'IsSuccess' : true });

							// Send the Webclient the path to download this file.
							
					});
			}
			else if(Files[Name]['Data'].length > 10485760){ //If the Data Buffer reaches 10MB
					console.log('uploadFileChuncks # Updating file %s with received data', Name);

					fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, Writen){
							Files[Name]['Data'] = ""; //Reset The Buffer
							var Place = Files[Name]['Downloaded'];
							var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;

							socket.emit('uploadFileMoreDataReq', { 'Place' : Place, 'Percent' :  Percent});

							// Send webclient upload progress..

					});
			}
			else
			{
					var Place = Files[Name]['Downloaded'];
					var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
					console.log('uploadFileChuncks # Requesting Place: %d, Percent %s', Place, Percent);

					socket.emit('uploadFileMoreDataReq', { 'Place' : Place, 'Percent' :  Percent});
					// Send webclient upload progress..
			}
	});
});