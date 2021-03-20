const mongoose = require("mongoose");

const MemberSchema = new mongoose.Schema({
  userName: String,
});

module.exports = new mongoose.model("Member", MemberSchema);
