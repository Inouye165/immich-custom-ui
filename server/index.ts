import { createApp } from './app';
import { getPort } from './config';

const port = getPort();
const app = createApp();

app.listen(port, () => {
  console.log(`Immich proxy server listening on http://localhost:${port}`);
});
