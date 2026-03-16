import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();
const server = createServer(app);

server.listen(env.port, () => {
  console.log(`ktagmanagement-backend listening on port ${env.port}`);
});
