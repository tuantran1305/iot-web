import { ThingsboardApiClient } from "thingsboard-api-client";
import { config } from "./config";

export const thingsboard = new ThingsboardApiClient(
  `http://${config.tbServer}`
);
