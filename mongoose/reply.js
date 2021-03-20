const mongoose = require("mongoose");
const Member = require("./member").schema;

const ReplySchema = new mongoose.Schema({
  author: Member,
  postDate: { type: Date, default: Date.now },
  text: String,
});

module.exports = new mongoose.model("Reply", ReplySchema);
