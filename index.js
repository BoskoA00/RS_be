const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const path = require("path");
const config = require("./config.js");
const userRoutes = require("./Routes/UserRoutes.js");
const adsRoutes = require("./Routes/AdsRoutes.js");
const questionRoutes = require("./Routes/QuestionsRoutes.js");
const answerRoutes = require("./Routes/AnswerRoutes.js");
const cors = require("cors");

const app = express();

app.use(
  "/ads-pictures",
  express.static(path.join(__dirname, "AdsPicturesFolder"))
);
app.use("/userImages", express.static(path.join(__dirname, "userImages")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use(userRoutes);
app.use(adsRoutes);
app.use(questionRoutes);
app.use(answerRoutes);
mongoose
  .connect(config.MONGO_DB_URL)
  .then(() => {
    console.log("Connected to MongoDB!");
    app.listen(config.PORT, () => {
      console.log(`Listening on port ${config.PORT}...`);
    });
  })
  .catch((error) => {
    console.log(error);
  });
