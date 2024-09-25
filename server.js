const express = require("express");
const { Server } = require("socket.io");
const { createServer } = require("http");

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// ฟังก์ชันสำหรับสร้างชุดตัวเลขสำหรับเกม 24 ชุด
function generate15Sets24GameNumbers() {
  const numberSets = {};
  for (let i = 1; i <= 15; i++) {
    numberSets[`number${i}`] = generateRandom24GameNumbers();
  }
  return numberSets;
}

function generateRandom24GameNumbers() {
  const numbers = generateNumberSet();
  if (canMake24(numbers)) {
    return numbers;
  }
  return generateRandom24GameNumbers();
}

function generateNumberSet() {
  const numbers = [];
  const countMap = new Map();
  while (numbers.length < 4) {
    const num = Math.floor(Math.random() * 9) + 1; // สุ่มตัวเลข 1-9
    const count = countMap.get(num) || 0;
    if (count < 2) {
      numbers.push(num);
      countMap.set(num, count + 1);
    }
  }
  return numbers;
}

function canMake24(numbers) {
  const operators = ['+', '-', '*', '/'];
  const permutations = getPermutations(numbers);

  for (let perm of permutations) {
    for (let op1 of operators) {
      for (let op2 of operators) {
        for (let op3 of operators) {
          if (eval(`(${perm[0]}${op1}${perm[1]})${op2}${perm[2]}${op3}${perm[3]}`) === 24) return true;
          if (eval(`${perm[0]}${op1}(${perm[1]}${op2}${perm[2]})${op3}${perm[3]}`) === 24) return true;
          if (eval(`${perm[0]}${op1}${perm[1]}${op2}(${perm[2]}${op3}${perm[3]})`) === 24) return true;
          if (eval(`${perm[0]}${op1}(${perm[1]}${op2}${perm[2]}${op3}${perm[3]})`) === 24) return true;
        }
      }
    }
  }
  return false;
}

function getPermutations(arr) {
  if (arr.length <= 1) return [arr];
  let result = [];
  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
    const perms = getPermutations(remaining);
    for (let perm of perms) {
      result.push([current].concat(perm));
    }
  }
  return result;
}

function startCountdown(roomId, duration) {
  let timeLeft = duration;
  const countdown = setInterval(() => {
    timeLeft -= 1;

    if (timeLeft <= 0) {
        clearInterval(countdown);
        io.to(roomId).emit('gameEnded');
    }
    else {
        io.to(roomId).emit('updateTimeLeft', timeLeft);
    }
  }, 1000);
}

// เก็บข้อมูลห้อง
const roomdata = {};

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("createRoom", () => {
    const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    roomdata[sessionId] = {
      NumberSets: generate15Sets24GameNumbers(),
      players: {},
      isPlaying: false,
      timeLimit: 60,
    };
    socket.emit("roomCreated", sessionId);
  });

  socket.on('hostRoom', (data) => {
    const roomId = data.roomId;
    if (roomdata[roomId]) {
      socket.join(roomId);
      socket.emit('updatePlayers', roomdata[roomId].players);
    }
  });


  socket.on("joinRoom", (data) => {
    if (roomdata[data.roomId]) {
      if (roomdata[data.roomId].isPlaying) {
        socket.emit("joinRoomError", "The game has already started.");
        console.log("The game has already started.");
      }
      else{
        socket.join(data.roomId);
        roomdata[data.roomId].players[data.playerName] = {
            score: 0,
            currentSetIndex: 1,
        };
        io.to(data.roomId).emit('updatePlayers', roomdata[data.roomId].players);

        socket.emit('updateCurrentSet', {
            currentNumbers: roomdata[data.roomId].NumberSets[`number1`],
            currentSetIndex: 1 
        });
        console.log(roomdata[data.roomId].players);
      }
    }
  });

  socket.on('joinGame', (data) => {
    const roomId = data.roomId;
    const playerName = data.playerName;
    if (roomdata[roomId] && roomdata[roomId].players[playerName]) {
      socket.join(roomId);
      const playerData = roomdata[roomId].players[playerName];
      socket.emit('updateRoomData', {
        players: roomdata[roomId].players,
        currentNumbers: roomdata[roomId].NumberSets[`number${playerData.currentSetIndex}`],
        currentSetIndex: playerData.currentSetIndex
      });
    }
  });

  socket.on("nextSet", (data) => {
    const { roomId, playerName } = data;
    if (roomdata[roomId] && roomdata[roomId].players[playerName]) {
      const playerData = roomdata[roomId].players[playerName];
      playerData.currentSetIndex++;
      if (playerData.currentSetIndex > 15) {
        playerData.currentSetIndex = 1;
      }
      socket.emit('updateCurrentSet', {
        currentNumbers: roomdata[roomId].NumberSets[`number${playerData.currentSetIndex}`],
        currentSetIndex: playerData.currentSetIndex
      });
    }
    console.log(roomdata[roomId].players);
  });

  socket.on('startGame', (data) => {
    const { roomId } = data;
    if (roomdata[roomId]) {
      roomdata[roomId].isPlaying = true;
      io.to(roomId).emit('gameStarted');

      const timeLimit = roomdata[roomId].timeLimit;
      startCountdown(roomId, timeLimit);
    }
  });


});


// กำหนดให้ Express ฟังที่พอร์ต
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
