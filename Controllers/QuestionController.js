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
    return res.status(500).json({ message: "Došlo je do greške" });
  }
};

exports.getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(404)
        .json({ message: "ID nije odgovarajućeg formata." });
    }
    const question = await Questions.findById(id)
      .populate("userId", "firstName lastName")
      .populate("answers", "content ");
    if (!question) {
      return res.status(404).json({ message: "Pitanje nije pronađeno." });
    }
    res.status(200).json(question);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Došlo je do greške." });
  }
};
exports.getQuestionsByUserId = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(404)
        .json({ message: "ID je neodgovarajućeg formata." });
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
      message: "Došlo je do greške.",
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
          .json({ message: "ID nije odgovarajućeg formata." });
      }
      if (!title || !title.trim()) {
        return res
          .status(400)
          .json({ message: "Naslov pitanja je neophodan." });
      }
      if (!content || !content.trim()) {
        return res
          .status(400)
          .json({ message: "Sadržaj pitanja je neophodan." });
      }
      const user = await User.findById(requestingUserId);
      if (!user) {
        return res.status(404).json({ message: "Korisnik nije pronađen." });
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
        message: "Pitanje kreirano uspešno.",
        question: responseQuestion,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Došlo je do greške." });
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
          .json({ message: "ID korisnika nije odgovarajućeg formata." });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(404)
          .json({ message: "ID pitanja nije odgovarajućeg formata." });
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
        message: "Pitanje uspešno izmenjeno.",
        question: responseQuestion,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Došlo je do greške." });
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
        .json({ message: "ID korisnika nije odgovarajućeg formata." });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(404)
        .json({ message: "ID pitanja nije odgovarajućeg formata." });
    }
    const user = await User.findById(requestingUserId);
    if (!user) {
      return res.status(404).json({ message: "Korisnik nije pronađen." });
    }
    const question = await Questions.findById(id);
    if (!question) {
      return res.status(404).json({ message: "Pitanje nije pronađeno." });
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

    res.status(200).json({ message: "Pitanje uspešno obirsano." });

    try {
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        message: "Došlo je do greške.",
      });
    }
  },
];
