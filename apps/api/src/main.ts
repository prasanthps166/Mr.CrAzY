import "dotenv/config";

import { config } from "./config.js";
import { createServer } from "./server.js";

const app = createServer();

app.listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`);
});

