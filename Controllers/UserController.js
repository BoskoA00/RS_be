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
      res.status(200).json({ message: "No users found." });
    }
    res.status(200).json({ users });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching users." });
  }
};
exports.getUserByEmail = async (req, res) => {
  try {
    if (!req.body.email.trim()) {
      return res.status(400).json({ message: "Email is required." });
    }
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
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
    res
      .status(500)
      .json({ message: "An error occurred while fetching user by email." });
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
        return res.status(400).json({ message: "All fields are required." });
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists." });
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
        .json({ message: "User registered successfully!", user: newUser });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "An error occurred during registration." });
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
        return res.status(400).json({ message: "Email is required." });
      }
      const user = await User.findOne({ email: req.body.email });
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
      if (user._id !== requestUserId) {
        if (requestingUserRole !== config.UserRoles.ADMINISTRATOR) {
          return res.status(403).json({
            message: "You cannot do this action.",
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

      res.status(200).json({ message: "User deleted successfully!" });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "An error occurred while deleting user by email." });
    }
  },
];

exports.getUserById = async (req, res) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ message: "User ID is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Id is not in correct format." });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
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
    res
      .status(500)
      .json({ message: "An error occurred while fetching user by id." });
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
        return res.status(400).json({ message: "User ID is required." });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(400)
          .json({ message: "Id is not in correct format." });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
      if (user._id != requestUserId) {
        if (requestingUserRole != config.UserRoles.ADMINISTRATOR) {
          return res.status(403).json({
            message: "You cannot do this action.",
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

      res.status(200).json({ message: "User deleted successfully!" });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "An error occurred while deleting user by ID." });
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
        return res.status(400).json({ message: "User ID is required." });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid user ID format." });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      if (
        user._id.toString() !== requestUserId &&
        requestingUserRole !== config.UserRoles.ADMINISTRATOR
      ) {
        return res.status(403).json({
          message: "You do not have permission to update this profile.",
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
        message: "User details updated successfully!",
        user: userResponse,
      });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "An error occurred while updating user details." });
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
        return res.status(400).json({ message: "User ID is required." });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid user ID format." });
      }
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      if (requestingUserRole < config.UserRoles.ADMINISTRATOR) {
        return res.status(403).json({
          message: "You do not have permission to perform this action.",
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
        return res.status(404).json({ message: "User role out of bounds." });
      }

      if (user.role === config.UserRoles.ADMINISTRATOR) {
        return res
          .status(404)
          .json({ message: "User is already at the highest role." });
      }

      user.role++;
      await user.save();
      return res.status(200).json({ message: "User successfully promoted." });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "An error occurred while promoting user." });
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
        return res.status(400).json({ message: "User ID is required." });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid user ID format." });
      }
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      if (requestingUserRole < config.UserRoles.ADMINISTRATOR) {
        return res.status(403).json({
          message: "You do not have permission to perform this action.",
        });
      }

      if (user.role > 2 || user.role < 0) {
        return res.status(404).json({ message: "User role out of bounds." });
      }

      if (user.role === config.UserRoles.BUYER) {
        return res
          .status(404)
          .json({ message: "User is already at the lowest role." });
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
      return res.status(200).json({ message: "User successfully demoted." });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "An error occurred while demoting user." });
    }
  },
];

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "User doesn't exist." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid  password." });
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
      message: "Login successful.",
      user: userResponse,
      token,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "An error occurred while logging in." });
  }
};
exports.searchUsersByEmail = async (req, res) => {
  try {
    const { wantedEmail } = req.query;

    if (!wantedEmail) {
      return res
        .status(400)
        .json({ message: "Email substring query parameter is required." });
    }

    const regex = new RegExp(wantedEmail, "i");

    const users = await User.find({ email: regex });

    if (users.length === 0) {
      return res.status(200).json({ message: "No users found." });
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
    res
      .status(500)
      .json({ message: "An error occurred while searching for users." });
  }
};
