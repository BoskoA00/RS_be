const User = require("../Models/User.js");
const Answers = require("../Models/Answer.js");
const Ads = require("../Models/Ad.js");
const Question = require("../Models/Question.js");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const config = require("../config.js");
const jwt = require("jsonwebtoken");
const authenticateToken = require("../Middleware/AuthenticationMiddleware.js");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../userImages");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const email = req.body.email;
    const ext = path.extname(file.originalname);
    cb(null, `${email}${ext}`);
  },
});

const upload = multer({ storage });

exports.getAll = async (req, res) => {
  try {
    const users = await User.find({});
    if (users.length === 0) {
      res.status(200).json({ message: "Nema korisnika." });
    }
    res.status(200).json({ users });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Došlo je do greške." });
  }
};
exports.getUserByEmail = async (req, res) => {
  try {
    if (!req.body.email.trim()) {
      return res.status(400).json({ message: "Email je neophodan." });
    }
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ message: "Ne postoji korisnik." });
    }
    const userResponse = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      imagePath: user.imagePath,
    };

    return res.status(200).json({ user: userResponse });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Došlo je do greške." });
  }
};
exports.register = [
  upload.single("image"),
  async (req, res) => {
    try {
      const { firstName, lastName, email, password, role } = req.body;
      const imagePath = req.file ? `userImages/${req.file.filename}` : null;

      if (
        !firstName ||
        !lastName ||
        !email ||
        !password ||
        role === null ||
        role === undefined ||
        !imagePath
      ) {
        return res.status(400).json({ message: "Sva polja su neophodna." });
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "Email je već u upotrebi." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new User({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role,
        imagePath,
      });

      await newUser.save();

      res
        .status(201)
        .json({ message: "Korisnik uspešno registrovan", user: newUser });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "Došlo je do greške tokom registracije." });
    }
  },
];
exports.deleteUserByEmail = [
  authenticateToken,
  async (req, res) => {
    try {
      const requestingUserRole = req.user.role;
      const requestUserId = req.user.id;

      if (!req.body.email.trim()) {
        return res.status(400).json({ message: "Email je neophodan." });
      }
      const user = await User.findOne({ email: req.body.email });
      if (!user) {
        return res.status(404).json({ message: "Korisnik nije pronađen." });
      }
      if (user._id !== requestUserId) {
        if (requestingUserRole !== config.UserRoles.ADMINISTRATOR) {
          return res.status(403).json({
            message: "Nemate dozvolu za ovu akciju.",
          });
        }
      }

      await Answers.deleteMany({ userId: user._id });
      await Ads.deleteMany({ userId: user._id });
      await Question.deleteMany({ userId: user._id });

      if (
        user.imagePath &&
        fs.existsSync(path.join(__dirname, "../", user.imagePath))
      ) {
        fs.unlinkSync(path.join(__dirname, "../", user.imagePath));
      }

      await User.findOneAndDelete({ email: req.body.email });

      res.status(200).json({ message: "Korisnik uspešno izbrisan!" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Došlo je do greške." });
    }
  },
];

exports.getUserById = async (req, res) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: "ID korisnika je neophodan." });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ message: "ID nije odgovarajućeg formata." });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Korisnik ne postoji." });
    }
    const userResponse = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      imagePath: user.imagePath,
    };
    return res.status(200).json({ user: userResponse });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Došlo je do greške." });
  }
};
exports.deleteUserById = [
  authenticateToken,
  async (req, res) => {
    try {
      const requestingUserRole = req.user.role;
      const requestUserId = req.user.id;
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ message: "ID korisnika je neophodan." });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(400)
          .json({ message: "ID korisnika nije odgovarajućeg formata." });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "Korisnik nije pronađen." });
      }
      if (user._id != requestUserId) {
        if (requestingUserRole != config.UserRoles.ADMINISTRATOR) {
          return res.status(403).json({
            message: "Nemate dozvolu za ovu akciju.",
          });
        }
      }

      const ads = await Ads.find({ userId: user._id });
      for (const ad of ads) {
        const adFolderPath = path.join(
          __dirname,
          "../AdsPicturesFolder",
          ad._id.toString()
        );
        if (fs.existsSync(adFolderPath)) {
          fs.rmdirSync(adFolderPath, { recursive: true });
        }
      }
      await Ads.deleteMany({ userId: user._id });

      if (
        user.imagePath &&
        fs.existsSync(path.join(__dirname, "../", user.imagePath))
      ) {
        fs.unlinkSync(path.join(__dirname, "../", user.imagePath));
      }

      await User.findByIdAndDelete(id);

      res.status(200).json({ message: "Korisnik uspešno izbrisan!" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Došlo je do greške." });
    }
  },
];

exports.updateUser = [
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { firstName, lastName, email, password, role } = req.body;
      const requestingUserRole = req.user.role;
      const requestUserId = req.user.id;

      if (!id) {
        return res.status(400).json({ message: "ID korisnika je neophodan." });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(400)
          .json({ message: "ID nije odgovarajućeg formata." });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "Korisnik nije pronađen." });
      }

      if (
        user._id.toString() !== requestUserId &&
        requestingUserRole !== config.UserRoles.ADMINISTRATOR
      ) {
        return res.status(403).json({
          message: "Nemate dozvolu za ovu akciju.",
        });
      }

      if (firstName && firstName !== user.firstName) {
        user.firstName = firstName;
      }
      if (lastName && lastName !== user.lastName) {
        user.lastName = lastName;
      }
      if (email && email !== user.email) {
        user.email = email;
      }
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
      }
      if (
        role == config.UserRoles.ADMINISTRATOR ||
        role == config.UserRoles.SELLER ||
        role == config.UserRoles.BUYER
      ) {
        user.role = role;
      }
      if (req.file) {
        if (
          user.imagePath &&
          fs.existsSync(path.join(__dirname, "../", user.imagePath))
        ) {
          fs.unlinkSync(path.join(__dirname, "../", user.imagePath));
        }
        user.imagePath = `userImages/${req.file.filename}`;
      }

      await user.save();

      const userResponse = {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        imagePath: user.imagePath,
      };

      res.status(200).json({
        message: "Korisnik uspešno izmenjen!",
        user: userResponse,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Došlo je do greške." });
    }
  },
];

exports.PromoteUser = [
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const requestingUserRole = req.user.role;

      if (!id) {
        return res.status(400).json({ message: "ID korisnika je neophodan." });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(400)
          .json({ message: "ID nije odgovarajućeg formata." });
      }
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "Korisnik nije pronađen." });
      }

      if (requestingUserRole < config.UserRoles.ADMINISTRATOR) {
        return res.status(403).json({
          message: "Nemate dozvolu za ovu akciju.",
        });
      }

      if (user.role > 2 || user.role < 0) {
        if (user.role < 0) {
          user.role = 0;
          await user.save();
        } else if (user.role > 2) {
          user.role = 2;
          await user.save();
        }
        return res.status(404).json({ message: "Uloga korisnika van dometa." });
      }

      if (user.role === config.UserRoles.ADMINISTRATOR) {
        return res
          .status(404)
          .json({ message: "Korisnik je vec poseduje najveću ulogu." });
      }

      user.role++;
      await user.save();
      return res.status(200).json({ message: "Korisnik uspešno unapredjen." });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Došlo je do greške." });
    }
  },
];

exports.DemoteUser = [
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const requestingUserRole = req.user.role;

      if (!id) {
        return res.status(400).json({ message: "ID korisnika je neophodan." });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(400)
          .json({ message: "ID nije odgovarajućeg formata." });
      }
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "Korisnik nije pronađen." });
      }

      if (requestingUserRole < config.UserRoles.ADMINISTRATOR) {
        return res.status(403).json({
          message: "Nemate dozvolu za ovu akciju.",
        });
      }

      if (user.role > 2 || user.role < 0) {
        return res.status(404).json({ message: "Uloga korisnika van dometa." });
      }

      if (user.role === config.UserRoles.BUYER) {
        return res
          .status(404)
          .json({ message: "Korisnik je vec poseduje najnižu ulozi." });
      }

      if (user.role === config.UserRoles.SELLER) {
        const ads = await Ads.find({ userId: user._id });
        for (const ad of ads) {
          const adFolderPath = path.join(
            __dirname,
            "../AdsPicturesFolder",
            ad._id.toString()
          );
          if (fs.existsSync(adFolderPath)) {
            fs.rmdirSync(adFolderPath, { recursive: true });
          }
        }
        await Ads.deleteMany({ userId: user._id });
      }

      user.role--;
      await user.save();
      return res.status(200).json({ message: "Korisnik uspešno unazadjen." });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Došlo je do greške." });
    }
  },
];

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email i lozinka su neophodni." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Korisnik ne postoji." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Pogrešna lozinka." });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      config.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const userResponse = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      imagePath: user.imagePath,
    };

    res.status(200).json({
      message: "Uspešno logovanje.",
      user: userResponse,
      token,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Došlo je do greške." });
  }
};
exports.searchUsersByEmail = async (req, res) => {
  try {
    const { wantedEmail } = req.query;

    if (!wantedEmail) {
      return res
        .status(400)
        .json({ message: "Potreban je parametar za pretragu." });
    }

    const regex = new RegExp(wantedEmail, "i");

    const users = await User.find({ email: regex });

    if (users.length === 0) {
      return res.status(200).json({ message: "Nisu pronađeni korisnici." });
    }

    const usersResponse = users.map((user) => ({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      imagePath: user.imagePath,
      role: user.role,
    }));

    return res.status(200).json({ users: usersResponse });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Došlo je do greške." });
  }
};
