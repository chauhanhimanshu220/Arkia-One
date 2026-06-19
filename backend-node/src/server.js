import dotenv from "dotenv";
import { app } from "./app.js";

dotenv.config();

const port = Number(process.env.PORT || 5300);

app.listen(port, () => {
  console.log(`Profit & Loss API running on http://localhost:${port}`);
});
