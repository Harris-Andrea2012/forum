const mongoose = require("mongoose");
const Member = require("./member").schema;
const Comment = require("./comment").schema;

const ForumSchema = new mongoose.Schema({
  host: Member,
  book: {
    title: String,
    author: String,
    searchCats: [String],
    imgLink: String,
  },
  members: [Member],
  discourse: [Comment],
});

module.exports = new mongoose.model("Forum", ForumSchema);
