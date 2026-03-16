import 'node:process';
import { createServer as createHttpServer } from 'node:http';
import { Socket, createServer as createTcpServer } from 'node:net';
import dgram from 'node:dgram';

const tcpPort = Number(process.env.TCP_PORT ?? 5055);
const udpPort = Number(process.env.UDP_PORT ?? 5055);
const httpPort = Number(process.env.HTTP_PORT ?? 8081);
const bindHost = process.env.BIND_HOST ?? '0.0.0.0';
const logRawPackets = process.env.LOG_RAW_PACKETS === 'true';

const serializePacket = (buffer: Buffer) => {
  const ascii = buffer.toString('utf8').replace(/[^\x20-\x7E]/g, '.');
  return {
    size: buffer.length,
    hex: buffer.toString('hex'),
    ascii
  };
};

const logPacket = (protocol: 'tcp' | 'udp', remote: string, payload: Buffer) => {
  const packet = serializePacket(payload);
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    protocol,
    remote,
    size: packet.size,
    ascii: packet.ascii,
    ...(logRawPackets ? { hex: packet.hex } : {})
  }));
};

const tcpServer = createTcpServer((socket: Socket) => {
  const remote = `${socket.remoteAddress}:${socket.remotePort}`;

  socket.on('data', (chunk) => {
     const payload = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
     logPacket('tcp', remote, payload);
    socket.write('OK\n');
  });

  socket.on('error', (error) => {
    console.error(`TCP socket error from ${remote}:`, error);
  });
});

const udpServer = dgram.createSocket('udp4');
udpServer.on('message', (msg, rinfo) => {
  logPacket('udp', `${rinfo.address}:${rinfo.port}`, msg);
  udpServer.send(Buffer.from('OK'), rinfo.port, rinfo.address);
});

udpServer.on('error', (error) => {
  console.error('UDP server error:', error);
});

const httpServer = createHttpServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    ok: true,
    service: 'traccar-gateway',
    tcpPort,
    udpPort,
    timestamp: new Date().toISOString()
  }));
});

tcpServer.listen(tcpPort, bindHost, () => {
  console.log(`TCP listener started on ${bindHost}:${tcpPort}`);
});

udpServer.bind(udpPort, bindHost, () => {
  console.log(`UDP listener started on ${bindHost}:${udpPort}`);
});

httpServer.listen(httpPort, bindHost, () => {
  console.log(`HTTP health endpoint started on ${bindHost}:${httpPort}`);
});
