const mongoose = require("mongoose");
const Forum = require("./forum").schema;

const BookClubSchema = new mongoose.Schema({
  host: mongoose.SchemaTypes.ObjectId,
  forums: [Forum],
});

module.exports = new mongoose.model("BookClub", BookClubSchema);
