import { buildApp } from "./app.js";
import { getSettings } from "../config.js";

const settings = getSettings();
const app = buildApp();

try {
  await app.listen({
    host: settings.apiHost,
    port: settings.apiPort,
  });
  console.log(
    `Chase IntelliWealth API listening on http://${settings.apiHost}:${settings.apiPort}`,
  );
} catch (error) {
  console.error(error);
  process.exit(1);
}
