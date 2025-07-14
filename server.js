const http = require('http');          
const fs = require('fs');              
const path = require('path');          
const WebSocket = require('ws');       

const PORT = 3000;

const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('지정된 경로를 찾을 수 없습니다.');
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    }
  });
});

// 이제 Map의 키를 WebSocket 객체 자체로 설정합니다.
let clients = new Map();

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  // IP는 로그용으로만 씁니다
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  clients.set(ws, { ip, room: null, nick: null });
  console.log(`📡 접속자: ${ip}`);

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);

      // join 메시지 처리: 방, 닉네임 저장
      if (data.type === 'join') {
        let client = clients.get(ws);
        client.room = data.room || 'lobby';
        client.nick = data.nick || ip;
        clients.set(ws, client);

        console.log(`🚪 [${client.room}] ${client.nick} 입장`);

        broadcast({
          type: 'sys',
          room: client.room,
          text: `${client.nick}님이 입장하셨습니다.`
        });

      } else if (data.type === 'text') {
        let client = clients.get(ws);
        if (!client.room || !client.nick) return;

        console.log(`💬 [${client.room}] ${client.nick}: ${data.text}`);

        broadcast({
          type: 'text',
          room: client.room,
          from: client.nick,
          text: data.text
        });

      } else if (data.type === 'file') {
        let client = clients.get(ws);
        if (!client.room || !client.nick) return;

        console.log(`📎 [${client.room}] ${client.nick}: 파일 전송`);

        broadcast({
          type: 'file',
          room: client.room,
          from: client.nick,
          name: data.name,
          data: data.data
        });
      }

    } catch (e) {
      console.error('❌ 메시지 처리 오류:', e.message);
    }
  });

  ws.on('close', () => {
    let client = clients.get(ws);
    if (client) {
      console.log(`❌ 접속 종료: ${client.ip}`);

      if (client.room && client.nick) {
        broadcast({
          type: 'sys',
          room: client.room,
          text: `${client.nick}님이 퇴장하셨습니다.`
        });
      }
    }
    clients.delete(ws);
  });
});

function broadcast(msg) {
  for (let [clientWs, clientInfo] of clients.entries()) {
    if (clientWs.readyState === WebSocket.OPEN && clientInfo.room === msg.room) {
      clientWs.send(JSON.stringify(msg));
    }
  }
}

server.listen(PORT, () => {
  console.log(`✅ HTTP & WS listening @${PORT}`);
});
