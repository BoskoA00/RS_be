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
      return res.status(404).json({ message: "No questions found" });
    }
    res.status(200).json(questions);
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "There was an error while getting questions" });
  }
};

exports.getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Invalid question ID" });
    }
    const question = await Questions.findById(id)
      .populate("userId", "firstName lastName")
      .populate("answers", "content ");
    if (!question) {
      return res.status(404).json({ message: "Question not found." });
    }
    res.status(200).json(question);
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "An error occurred while getting question by id." });
  }
};
exports.getQuestionsByUserId = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Invalid user ID" });
    }
    const questions = await Questions.find({ userId: id })
      .populate("userId", "firstName lastName")
      .populate("answers", "content");
    if (questions.length === 0) {
      return res
        .status(404)
        .json({ message: "No questions found for this user" });
    }
    res.status(200).json(questions);
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "An error occurred while getting questions by user id.",
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
        return res.status(404).json({ message: "Invalid user ID" });
      }
      if (!title || !title.trim()) {
        return res.status(400).json({ message: "Title is required." });
      }
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Content is required." });
      }
      const user = await User.findById(requestingUserId);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
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
        message: "Question created sucessfully.",
        question: responseQuestion,
      });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: "An error occurred while creating a question." });
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
        return res.status(404).json({ message: "Invalid user ID" });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ message: "Invalid question ID" });
      }
      const question = await Questions.findById(id);
      if (!question) {
        return res.status(404).json({ message: "Question not found." });
      }
      if (requestingUserRole != config.UserRoles.ADMINISTRATOR) {
        if (question.userId !== requestingUserId) {
          return res.status(403).json({
            message: "You do not have permission to perform this action.",
          });
        }
      }
      if ((!title || !title.trim()) && (!content || !content.trim())) {
        return res
          .status(400)
          .json({ message: "Need atleast one of the fields to do an update." });
      }
      if (title) question.title = title;
      if (content) question.content = content;
      const updatedQuestion = await question.save();
      const responseQuestion = await Questions.findById(updatedQuestion._id)
        .populate("userId", "firstName lastName")
        .populate("answers");

      return res.status(200).json({
        message: "Question updated successfully.",
        question: responseQuestion,
      });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: "There was an error while updaing question" });
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
      return res.status(404).json({ message: "Invalid user ID" });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Invalid question ID" });
    }
    const user = await User.findById(requestingUserId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    const question = await Questions.findById(id);
    if (!question) {
      return res.status(404).json({ message: "Question not found." });
    }
    if (requestingUserRole !== config.UserRoles.ADMINISTRATOR) {
      if (question.userId !== requestingUserId) {
        return res.status(403).json({
          message: "You do not have permission to perform this action.",
        });
      }
    }
    await Answer.deleteMany({ questionId: id });
    await Question.findByIdAndDelete(id);

    res.status(200).json({ message: "Question deleted successfully." });

    try {
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        message: "There was an error while trying to delete the question",
      });
    }
  },
];
