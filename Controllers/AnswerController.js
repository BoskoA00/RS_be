const Answer = require("../Models/Answer.js");
const Question = require("../Models/Question.js");
const authenticateToken = require("../Middleware/AuthenticationMiddleware.js");
const User = require("../Models/User.js");
const mongoose = require("mongoose");
const config = require("../config.js");

exports.getAll = async (req, res) => {
  try {
    const answers = await Answer.find({})
      .populate("userId", "firstName lastName")
      .populate("questionId", "title content");
    if (answers.length === 0) {
      return res.status(200).json({ message: "Nema odgovora." });
    }
    return res.status(200).json(answers);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Doslo je do greske." });
  }
};

exports.getAnswerById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Neodgovarajuci format ID-ja." });
    }
    const answer = await Answer.findById(id).populate(
      "userId",
      "firstName lastName"
    );
    if (!answer) {
      return res.status(404).json({ message: "Odgovor nije pronadjen." });
    }
    return res.status(200).json(answer);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Doslo je do greske." });
  }
};

exports.getAnswerByQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Neodgovarajuci format ID-ja." });
    }
    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ message: "Pitanje nije pronadjeno." });
    }
    const answers = await Answer.find({ questionId: id }).populate(
      "userId",
      "firstName lastName"
    );
    if (answers.length === 0) {
      return res.status(200).json({ message: "Ovo pitanje nema odgovore." });
    }
    return res.status(200).json(answers);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Doslo je do greske." });
  }
};

exports.getAnswersByUserId = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ message: "ID je neodgovarajuceg formata." });
    }
    const answers = await Answer.find({ userId: id }).populate(
      "questionId",
      "title content"
    );
    if (answers.length === 0) {
      return res
        .status(200)
        .json({ message: "Ne postoje odgovori ovog korisnika." });
    }
    return res.status(200).json(answers);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Doslo je do greske." });
  }
};

exports.createAnswer = [
  authenticateToken,
  async (req, res) => {
    try {
      const requestingUserId = req.user.id;
      const { questionId, content } = req.body;
      if (!mongoose.Types.ObjectId.isValid(requestingUserId)) {
        return res
          .status(400)
          .json({ message: "Neodgovarajuci ID korisnika." });
      }
      if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return res.status(400).json({ message: "Neodgovarajuci ID pitanja." });
      }
      const user = await User.findById(requestingUserId);
      if (!user) {
        return res.status(404).json({ message: "Korisnik nije pronadjen." });
      }
      const question = await Question.findById(questionId);
      if (!question) {
        return res.status(404).json({ message: "Pitanje nije pronadjeno." });
      }
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Sadrzaj je neophodan." });
      }
      const answer = new Answer({
        userId: requestingUserId,
        questionId,
        content,
      });
      const savedAnswer = await answer.save();
      await question.answers.push(savedAnswer._id);
      await question.save();
      await user.answers.push(savedAnswer._id);
      await user.save();
      const answerResponse = await Answer.findById(savedAnswer._id)
        .populate("userId", "firstName lastName")
        .populate("questionId", "title content");

      return res.status(201).json({
        message: "Odgovor usepsno kreiran.",
        answer: answerResponse,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Doslo je do greske." });
    }
  },
];

exports.deleteAnswer = [
  authenticateToken,
  async (req, res) => {
    try {
      const requestingUserRole = req.user.role;
      const requestingUserId = req.user.id;
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(requestingUserId)) {
        return res
          .status(404)
          .json({ message: "ID korisnika nije odgovarajuceg formata." });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(400)
          .json({ message: "ID odgovora nije odgovarajuceg formata" });
      }
      const user = await User.findById(requestingUserId);
      if (!user) {
        return res.status(404).json({ message: "Korisnik nije pronadjen." });
      }

      const answer = await Answer.findById(id);
      if (!answer) {
        return res.status(404).json({ message: "Odgovor nije pronadjen." });
      }
      if (requestingUserRole != config.UserRoles.ADMINISTRATOR) {
        if (requestingUserId != answer.userId)
          return res
            .status(403)
            .json({ message: "Nemate dozvolu za ovu akciju." });
      }
      const question = await Question.findById(answer.questionId);
      await question.answers.remove(answer._id);
      await question.save();
      await user.answers.remove(answer._id);
      await user.save();
      await Answer.findByIdAndDelete(id);

      return res.status(200).json({ message: "Odgovor usepsno izbrisan." });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Doslo je do greske." });
    }
  },
];

exports.updateAnswer = [
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const requestingUserRole = req.user.role;
      const requestingUserId = req.user.id;
      if (!mongoose.Types.ObjectId.isValid(requestingUserId)) {
        return res
          .status(404)
          .json({ message: "ID korisnika nije odgovarajuceg formata." });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(400)
          .json({ message: "ID odgovora nije odgovarajuceg formata." });
      }
      const user = await User.findById(requestingUserId);
      if (!user) {
        return res.status(404).json({ message: "Korisnik nije pronadjen." });
      }
      const answer = await Answer.findById(id);
      if (!answer) {
        return res.status(404).json({ message: "Odgovor nije pronadjen" });
      }
      if (requestingUserRole != config.UserRoles.ADMINISTRATOR) {
        if (requestingUserId != answer.userId)
          return res
            .status(403)
            .json({ message: "Nemate dozvolu za ovu akciju." });
      }
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Sadrzaj je neophodan." });
      }
      answer.content = content;
      const updatedAnswer = await answer.save();
      return res.status(200).json({
        message: "Odgovor uspesno izmenjen.",
        answer: updatedAnswer,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Doslo je do greske." });
    }
  },
];
