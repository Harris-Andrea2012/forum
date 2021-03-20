const mongoose = require("mongoose");
const Member = require("./member").schema;
const Reply = require("./reply").schema;

const CommentSchema = new mongoose.Schema({
  author: Member,
  postDate: { type: Date, default: Date.now },
  text: String,
  replies: [Reply],
});

module.exports = new mongoose.model("Comment", CommentSchema);
