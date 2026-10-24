
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const bodyparser = require("body-parser");
const cors = require("cors");

const app = express();
const userRoute = require("./routes/user");
const adminRoute = require("./routes/admin");
const errorHandler = require("./authMiddleware/errorHandlerMiddleware");
const logger = require("./config/logger");

const port = process.env.port || 4000;

app.use(cors());

const noCache = (req, res, next) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
};

app.use(noCache);

mongoose
  .connect(process.env.db_url)
  .then(() => {
    logger.info('Database connected successfully');
  })
  .catch((error) => {
    logger.error('Error during database connection', {
      error: error.message,
      stack: error.stack
    });
  });


app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: false }));

app.use(
  session({
    name: "sid1",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.set("view engine", "ejs");
app.set("views", "views");


app.use("/", userRoute);
app.use("/admin", adminRoute);

app.use(errorHandler.notFound);
app.use(errorHandler.errorHandler1);

app.listen(port, () => {
  logger.info(`Server is running on port ${port}`)
});
