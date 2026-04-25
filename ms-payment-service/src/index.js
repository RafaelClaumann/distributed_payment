require("dotenv").config();

const express = require("express");
const app = express();

const routes = require("./routes/routes.js");
const { startDlqJob } = require("./jobs/dlq_job.js");

app.use(express.json({ limit: "1mb" }));
app.use("/", routes);

app.listen(process.env.SERVER_PORT, () => {
  console.log(`Example app listening on port ${process.env.SERVER_PORT}`);
  startDlqJob();
});
