import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 3001);

const app = createApp();

app.listen({ port: PORT, host: "127.0.0.1" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
