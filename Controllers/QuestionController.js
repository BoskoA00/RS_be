const Questions = require("../Models/Question");
const authenticateToken = require("../Middleware/AuthenticationMiddleware.js");
const User = require("../Models/User.js");
const mongoose = require("mongoose");
const config = require("../config.js");
const Question = require("../Models/Question");
const Answers = require("../Models/Answer.js");
const Answer = require("../Models/Answer.js");

exports.getAll = async (req, res) => {
  try {
    const questions = await Questions.find({}).populate(
      "userId",
      "firstName lastName  imagePath"
    );
    if (questions.length === 0) {
      return res.status(404).json({ message: "Ne postoje pitanja" });
    }
    res.status(200).json(questions);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Doslo je do greske" });
  }
};

exports.getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(404)
        .json({ message: "ID nije odgovarajuceg formata." });
    }
    const question = await Questions.findById(id)
      .populate("userId", "firstName lastName")
      .populate("answers", "content ");
    if (!question) {
      return res.status(404).json({ message: "Pitanje nije pronadjeno." });
    }
    res.status(200).json(question);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Doslo je do greske." });
  }
};
exports.getQuestionsByUserId = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(404)
        .json({ message: "ID je neodgovarajuceg formata." });
    }
    const questions = await Questions.find({ userId: id })
      .populate("userId", "firstName lastName")
      .populate("answers", "content");
    if (questions.length === 0) {
      return res
        .status(404)
        .json({ message: "Ne postoje pitanja ovog korisnika" });
    }
    res.status(200).json(questions);
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Doslo je do greske.",
    });
  }
};

exports.createQuestion = [
  authenticateToken,
  async (req, res) => {
    try {
      const requestingUserId = req.user.id;
      const { title, content } = req.body;
      if (!mongoose.Types.ObjectId.isValid(requestingUserId)) {
        return res
          .status(404)
          .json({ message: "ID nije odgovarajuceg formata." });
      }
      if (!title || !title.trim()) {
        return res
          .status(400)
          .json({ message: "Naslov pitanja je neophodan." });
      }
      if (!content || !content.trim()) {
        return res
          .status(400)
          .json({ message: "Sadrzaj pitanja je neophodan." });
      }
      const user = await User.findById(requestingUserId);
      if (!user) {
        return res.status(404).json({ message: "Korisnik nije pronadjen." });
      }
      const newQuestion = new Questions({
        title,
        content,
        userId: requestingUserId,
      });

      const savedQuestion = await newQuestion.save();
      await user.questions.push(savedQuestion._id);
      await user.save();
      const responseQuestion = await Questions.findById(savedQuestion._id)
        .populate("userId", "firstName lastName imagePath")
        .populate("answers");

      return res.status(200).json({
        message: "Pitanje kreirano uspesno.",
        question: responseQuestion,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Doslo je do greske." });
    }
  },
];

exports.updateQuestion = [
  authenticateToken,
  async (req, res) => {
    try {
      const requestingUserId = req.user.id;
      const requestingUserRole = req.user.role;
      const { id } = req.params;
      const { title, content } = req.body;
      if (!mongoose.Types.ObjectId.isValid(requestingUserId)) {
        return res
          .status(404)
          .json({ message: "ID korisnika nije odgovarajuceg formata." });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(404)
          .json({ message: "ID pitanja nije odgovarajuceg formata." });
      }
      const question = await Questions.findById(id);
      if (!question) {
        return res.status(404).json({ message: "Pitanje ne postoji." });
      }
      if (requestingUserRole != config.UserRoles.ADMINISTRATOR) {
        if (question.userId !== requestingUserId) {
          return res.status(403).json({
            message: "Nemate dozvolu za ovu akciju.",
          });
        }
      }
      if ((!title || !title.trim()) && (!content || !content.trim())) {
        return res
          .status(400)
          .json({ message: "Potrebno je barem jedno od polja." });
      }
      if (title) question.title = title;
      if (content) question.content = content;
      const updatedQuestion = await question.save();
      const responseQuestion = await Questions.findById(updatedQuestion._id)
        .populate("userId", "firstName lastName")
        .populate("answers");

      return res.status(200).json({
        message: "Pitanje uspesno izmenjeno.",
        question: responseQuestion,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Doslo je do greske." });
    }
  },
];

exports.deleteQuestion = [
  authenticateToken,
  async (req, res) => {
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(requestingUserId)) {
      return res
        .status(404)
        .json({ message: "ID korisnika nije odgovarajuceg formata." });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(404)
        .json({ message: "ID pitanja nije odgovarajuceg formata." });
    }
    const user = await User.findById(requestingUserId);
    if (!user) {
      return res.status(404).json({ message: "Korisnik nije pronadjen." });
    }
    const question = await Questions.findById(id);
    if (!question) {
      return res.status(404).json({ message: "Pitanje nije pronadjeno." });
    }
    if (requestingUserRole !== config.UserRoles.ADMINISTRATOR) {
      if (question.userId !== requestingUserId) {
        return res.status(403).json({
          message: "Nemate dozvolu za ovu akciju.",
        });
      }
    }
    await Answer.deleteMany({ questionId: id });
    await Question.findByIdAndDelete(id);

    res.status(200).json({ message: "Pitanje uspesno obirsano." });

    try {
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        message: "Doslo je do greske.",
      });
    }
  },
];
