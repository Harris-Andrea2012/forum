require("dotenv").config();
const express = require("express");
const app = express();
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const mongoose = require("mongoose");
const DB_PSWD = process.env.DB_CONN_PSWD;
const DB_NAME = process.env.DB;
const conn = `mongodb+srv://ForumAdmin:${DB_PSWD}@forum.nwbtz.mongodb.net/${DB_NAME}?retryWrites=true&w=majority`;
const SECRET = process.env.SECRET;
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const User = require("./mongoose/user");
const Forum = require("./mongoose/forum");
const BookClub = require("./mongoose/bookClub");
const Member = require("./mongoose/member");
const Comment = require("./mongoose/comment");
const Reply = require("./mongoose/reply");
const comment = require("./mongoose/comment");

/**MULTER */
const imageStorage = multer.diskStorage({
  destination: "./build/uploads",
  filename: (req, file, cb) => {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const imageUpload = multer({ storage: imageStorage });

/**MONGO */
mongoose
  .connect(conn, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("DB connected.."))
  .catch((err) => console.log(err));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    store: MongoStore.create({ mongoUrl: conn }),
    secret: SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
    unset: "destroy",
  })
);

app.use(cors());

app.post("/auth", async (req, res) => {
  const loginInfo = req.body;

  const query = User.where({ email: loginInfo.email });
  let retMsg;
  let status;

  const user = await query.findOne();

  if (loginInfo.userName) {
    const password = await bcrypt.hash(loginInfo.password, 10).then((hash) => {
      return hash;
    });

    if (!user) {
      const newUser = new User({
        userName: loginInfo.userName,
        email: loginInfo.email,
        password: password,
      });
      const createdUser = await newUser.save();

      retMsg = {
        id: createdUser._id.toString(),
        userName: createdUser.userName,
        email: createdUser.email,
        memberDate: createdUser.memberSince,
      };
      status = 201;
      req.session.user = retMsg;
    } else {
      status = 400;
      retMsg = "User already exists with that email. Please log in.";
    }
  } else {
    if (!user) {
      status = 404;
      retMsg = "User not found. Please create an account.";
    } else {
      const match = await bcrypt.compare(loginInfo.password, user.password);
      if (match) {
        if (user.profilePic === null) {
          console.log("no property");
          retMsg = {
            id: user._id.toString(),
            userName: user.userName,
            email: user.email,
            memberDate: user.memberSince,
          };
        } else {
          const filePath = path.join(
            __dirname + "/build/uploads/" + user.profilePic.filename
          );

          try {
            const buffer = Buffer.from(user.profilePic.img.data, "base64");

            fs.writeFileSync(filePath, buffer);
          } catch (e) {
            console.log(e);
          }

          retMsg = {
            id: user._id.toString(),
            userName: user.userName,
            email: user.email,
            memberDate: user.memberSince,
            img: user.profilePic.filename,
          };
        }

        status = 200;
        req.session.user = retMsg;
      } else {
        retMsg = "Incorrect password. Try again.";
        status = 400;
      }
    }
  }

  res.status(status).send({ message: retMsg });
});

app.post("/delAcct", async (req, res) => {
  let status;
  let message;
  const { email, password } = req.body;

  const found = await User.findOne({ email: email });
  if (found) {
    const match = await bcrypt.compare(password, found.password);
    if (match) {
      await User.deleteOne(
        { email: email, password: found.password },
        (err) => {
          if (err) {
            console.log(err);
            status = 400;
            message = "Account deletion failed.";
          }
          req.session.destroy();
          console.log("DELETED SUCCESSFULLY");
          status = 200;
          message = "Account deletion successfully.";
        }
      );
    } else {
      status = 404;
      message = "Deletion failed. Wrong credentials.";
    }
  } else {
    status = 404;
    message = "Deletion failed. User not found";
  }
  res.status(status).send({ message: message });
});

app.get("/logout/removeFiles", (req, res) => {
  const filePath = path.join(
    __dirname + "/build/uploads/" + req.session.user.img
  );
  fs.stat(filePath, (err, stat) => {
    if (err == null) {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.log("THERE WAS AN ERROR", error.message);
      }
      res.redirect("/logout/endSession");
    } else if (err.code === "ENOENT") {
      res.redirect("/logout/endSession");
    } else {
      console.log("SOME OTHER ERROR: ", err);
    }
  });
});

app.get("/logout/endSession", async (req, res) => {
  let status;
  let message;

  req.session.destroy((err) => {
    if (err) {
      console.log("LOGOUT ERROR");
      status = 400;
      message = "Error. Could not logout.";
    } else {
      console.log("USER LOGGED OUT.");
      status = 200;
      message = "User logged out successfully.";
    }

    res.status(status).send({ message: message });
  });
});

app.get("/confirmAuth", async (req, res) => {
  let status;
  let message;
  if (req.session.user) {
    status = 200;
    message = req.session.user;
    
  } else {
    status = 404;
    message = "Session expired.";
  }
  res.status(status).send({ message: message });
});
app.post("/updateProfile", async (req, res) => {
  let status;
  let message;
  const query = req.body.queryEmail;
  const changes = req.body.update;

  const found = await User.where({ email: query }).findOne();

  if (!found) {
    status = 404;
    message = "User not found! No changes made.";
  } else {
    for (const [key, value] of Object.entries(changes)) {
      if (key === "password") {
        let newPassword = await bcrypt.hash(value, 10).then((hash) => {
          return hash;
        });
        found[`${key}`] = newPassword;
      } else {
        found[`${key}`] = value;
      }
    }

    const updated = await found.save();
    let updatedSession;
    if (updated.profilePic !== null) {
      updatedSession = {
        id: updated._id.toString(),
        userName: updated.userName,
        email: updated.email,
        memberDate: updated.memberSince,
        img: updated.profilePic.filename,
      };
    } else {
      updatedSession = {
        id: updated._id.toString(),
        userName: updated.userName,
        email: updated.email,
        memberDate: updated.memberSince,
      };
    }

    req.session.user = updatedSession;

    status = 200;
    message = updatedSession;
  }
  res.status(status).send({ message: message });
});

app.post(
  "/updateProfileImage",
  imageUpload.single("img"),
  async (req, res, next) => {
    let status;
    let message;
    let filePath;

    const found = await User.where({ email: req.body.email }).findOne();
    if (!found) {
      status = 404;
      message = "Incorrect credentials. Please try again.";

      filePath = path.join(__dirname + "/build/uploads/" + req.file.filename);

      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.log("THERE WAS AN ERROR", error.message);
      }
    } else {
      if (found.profilePic !== null) {
        filePath = path.join(
          __dirname + "/build/uploads/" + req.session.user.img
        );
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.log("THERE WAS AN ERROR", error.message);
        }
      }
      filePath = path.join(__dirname + "/build/uploads/" + req.file.filename);

      found.profilePic = {
        filename: req.file.filename,
        img: {
          data: fs.readFileSync(filePath),
          contentType: req.file.mimetype,
        },
      };
      const updated = await found.save();
      const updatedUser = {
        id: updated._id.toString(),
        userName: updated.userName,
        email: updated.email,
        memberDate: updated.memberSince,
        img: updated.profilePic.filename,
      };
      status = 200;
      req.session.user = updatedUser;

      message = updatedUser;
    }

    res.status(status).send({ message: message });
  }
);

app.post("/createForum", async (req, res) => {
  let status;
  let message;
  let book = req.body;

  const found = await User.where({ email: req.session.user.email }).findOne();
  if (!found) {
    status = 400;
    message = "User not found";
  } else {
    const host = new Member({
      userName: found.userName,
      _id: found._id,
    });
    const forum = new Forum({
      host: host,
      book: {
        title: book.title,
        author: book.author,
        searchCats: book.searchCategories,
        imgLink: book.img,
      },
      members: [host],
    });

    const existingClub = await BookClub.where({ host: found._id }).findOne();
    let created;

    if (existingClub) {
      existingClub.forums.push(forum);
      created = await existingClub.save();
    } else {
      const newClub = new BookClub({
        host: found._id,
        forums: [forum],
      });

      created = await newClub.save();
    }
    status = 201;
    message = {
      bookClubRef: created._id,
      forum: created.forums[created.forums.length - 1],
    };
    console.log("NEW FORUM CREATED AND ADDED TO BOOK CLUB");
  }

  res.status(status).send({ message: message });
});

app.post("/getForum", async (req, res) => {
  let message, status;

  const bookClub = await BookClub.findById(
    mongoose.Types.ObjectId(req.body.bookClubRef)
  );

  if (!bookClub) {
    message = "Book Club not found.";
    status = 404;
  } else {
    const forum = await bookClub.forums.id(
      mongoose.Types.ObjectId(req.body.forum._id)
    );
    message = {
      bookClubRef: bookClub._id,
      forum: forum,
    };
    status = 200;
  }
  res.status(status).send({ message: message });
});

app.post("/getForumsByQuery", async (req, res) => {
  let message, status;
  let results = [];

  const bookClubs = await BookClub.find();
  if (!bookClubs) {
    message = "No book clubs found";
    status = 404;
  } else {
    for (let i = 0; i < bookClubs.length; i++) {
      for (let j = 0; j < bookClubs[i].forums.length; j++) {
        if (
          bookClubs[i].forums[j].book.title
            .toUpperCase()
            .includes(req.body.query.toUpperCase())
        ) {
          results.push({
            bookClubRef: bookClubs[i]._id,
            forum: bookClubs[i].forums[j],
          });
        }
      }
    }
    status = 200;
    message = { results: results };
  }
  res.status(status).send({ message: message });
});

app.get("/popHeader", async (req, res) => {
  let status, message;

  const bc = await BookClub.findOne();

  if (!bc) {
    status = 404;
    message = "NO BOOK CLUBS YET";
  } else {
    const forum = bc.forums[0];
    status = 200;
    message = {
      forum: forum,
      bookClubRef: bc._id,
    };
  }
  res.status(status).send({ message: message });
});

app.post("/getForumByCategory", async (req, res) => {
  let status, message;
  status = 200;
  message;
  let forums = [];

  const bookClubs = await BookClub.find();
  if (!bookClubs) {
    status = 404;
    message = "No forums found with this category";
  } else {
    for (let i = 0; i < bookClubs.length; i++) {
      for (let j = 0; j < bookClubs[i].forums.length; j++) {
        if (
          bookClubs[i].forums[j].book.searchCats.includes(req.body.category)
        ) {
          forums.push({
            forum: bookClubs[i].forums[j],
            bookClubRef: bookClubs[i]._id,
          });
        }
      }
    }
  }

  res.status(status).send({ message: forums });
});

app.post("/delForum", async (req, res) => {
  let message, status;
  const currentUser = req.session.user;

  const bookClub = await BookClub.findById(
    mongoose.Types.ObjectId(req.body.bookClubRef)
  );

  if (!bookClub) {
    message = "Book Club not found.";
    status = 404;
  } else {
    bookClub.forums.id(mongoose.Types.ObjectId(req.body.forum._id)).remove();
    const updatedClub = await bookClub.save();
    const memberForums = await BookClub.where({
      "forums.members._id": mongoose.Types.ObjectId(currentUser.id),
    });

    message = {
      bookClub: updatedClub,
      memberships: memberForums,
    };
    status = 200;
  }
  res.status(status).send({ message: message });
});
app.post("/addToDiscourse", async (req, res) => {
  let status;
  let message;

  const bc = await BookClub.findById(
    mongoose.Types.ObjectId(req.body.bookClubRef)
  );
  if (!bc) {
    status = 404;
    message = "Forum not found";
  } else {
    const forum = await bc.forums.id(
      mongoose.Types.ObjectId(req.body.forum._id)
    );
    let author, newComment;

    if (req.body.member.id == forum.host._id) {
      author = forum.host;
    } else {
      author = new Member({
        userName: req.body.member.userName,
        _id: mongoose.Types.ObjectId(req.body.member.id),
      });

      forum.members.push(author);
    }

    if (!req.body.replyTo) {
      newComment = new Comment({
        author: author,
        text: req.body.comment,
      });

      forum.discourse.push(newComment);
    } else {
      const comment = await forum.discourse.id(
        mongoose.Types.ObjectId(req.body.replyTo._id)
      );

      const newReply = new Reply({
        author: author,
        text: req.body.comment,
      });

      comment.replies.push(newReply);
    }

    await bc.save();

    status = 201;
    message = {
      bookClub: bc._id,
      forum: forum,
    };
  }

  res.status(status).send({ message: message });
});

app.get("/getProfile", async (req, res) => {
  let status, message
  let userBookClub = [];
  let memberForums = [];

  const currentUser = req.session.user;
   


  userBookClub = await BookClub.where({
    host: mongoose.Types.ObjectId(currentUser.id),
  });

  memberForums = await BookClub.where({
    "forums.members._id": mongoose.Types.ObjectId(currentUser.id),
  });
  let foundForums = [];

  if (memberForums.length > 0) {
    for (let i = 0; i < memberForums.length; i++) {
      for (let j = 0; j < memberForums[i].forums.length; j++) {
        foundForums.push(memberForums[i].forums[j]);
      }
    }
  }

  status = 200;
  message = {
    userBookClub: userBookClub,
    memberForums: foundForums,
  };

  res.status(status).send({ message: message });
});

app.use(express.static(path.join(__dirname, "build")));
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, console.log(`Server started @ port ${PORT}...`));
