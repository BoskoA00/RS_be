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
      return res.status(200).json({ message: "No answers found" });
    }
    return res.status(200).json(answers);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error while getting answers" });
  }
};

exports.getAnswerById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    const answer = await Answer.findById(id)
    .populate("userId", "firstName lastName");
    if (!answer) {
      return res.status(404).json({ message: "Answer not found" });
    }
    return res.status(200).json(answer);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error while getting answer" });
  }
};

exports.getAnswerByQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }
    const answers = await Answer.find({ questionId: id }).populate(
      "userId",
      "firstName lastName"
    );
    if (answers.length === 0) {
      return res
        .status(200)
        .json({ message: "No answers found for this question" });
    }
    return res.status(200).json(answers);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error while getting answers" });
  }
};

exports.getAnswersByUserId = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    const answers = await Answer.find({ userId: id }).populate(
      "questionId",
      "title content"
    );
    if (answers.length === 0) {
      return res
        .status(200)
        .json({ message: "No answers found for this user" });
    }
    return res.status(200).json(answers);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error while getting answers" });
  }
};

exports.createAnswer = [
  authenticateToken,
  async (req, res) => {
    try {
      const requestingUserId = req.user.id;
      const { questionId, content } = req.body;
      if (!mongoose.Types.ObjectId.isValid(requestingUserId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      if (!mongoose.Types.ObjectId.isValid(questionId)) {
        return res.status(400).json({ message: "Invalid question ID" });
      }
      const user = await User.findById(requestingUserId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const question = await Question.findById(questionId);
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Content is required" });
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
        message: "Answer created successfully",
        answer: answerResponse,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Error while creating answer" });
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
        return res.status(404).json({ message: "Invalid user ID" });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid question ID" });
      }
      const user = await User.findById(requestingUserId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const answer = await Answer.findById(id);
      if (!answer) {
        return res.status(404).json({ message: "Answer not found" });
      }
      if (requestingUserRole != config.UserRoles.ADMINISTRATOR) {
        if (requestingUserId != answer.userId)
          return res
            .status(403)
            .json({ message: "You are not authorized to delete this answer." });
      }
      const question = await Question.findById(answer.questionId);
      await question.answers.remove(answer._id);
      await question.save();
      await user.answers.remove(answer._id);
      await user.save();
      await Answer.findByIdAndDelete(id);

      return res.status(200).json({ message: "Answer deleted successfully" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Error while deleting answer" });
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
        return res.status(404).json({ message: "Invalid user ID" });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid answer ID" });
      }
      const user = await User.findById(requestingUserId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const answer = await Answer.findById(id);
      if (!answer) {
        return res.status(404).json({ message: "Answer not found" });
      }
      if (requestingUserRole != config.UserRoles.ADMINISTRATOR) {
        if (requestingUserId != answer.userId)
          return res
            .status(403)
            .json({ message: "You are not authorized to update this answer." });
      }
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Content is required" });
      }
      answer.content = content;
      const updatedAnswer = await answer.save();
      return res.status(200).json({
        message: "Answer updated successfully",
        answer: updatedAnswer,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Error while updating answer" });
    }
  },
];
