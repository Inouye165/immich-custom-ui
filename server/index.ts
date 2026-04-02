import { createApp } from './app';
import { getPort } from './config';

const port = getPort();
const app = createApp();

app.listen(port, () => {
  console.log(`Photo archive proxy listening on http://localhost:${port}`);
});
