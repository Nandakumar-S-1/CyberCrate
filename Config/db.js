const mongoose = require("mongoose");
const env = require("dotenv").config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("database connected");
  } catch (error) {
    console.log("Error occurred while connecting to database ", error.message);
  }
};

module.exports = connectDB;
