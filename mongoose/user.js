const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  userName: String,
  email: String,
  password: String,
  memberSince: { type: Date, default: Date.now },
  profilePic: {
    filename: {
      type: String,
    },
    img: { data: Buffer, contentType: String },
  },
});

module.exports = new mongoose.model("User", UserSchema);
