const express = require("express");
const router = express.Router();
const questionController = require("../Controllers/QuestionController.js");

router.get("/questions", questionController.getAll);
router.get("/questions/:id", questionController.getQuestionById);
router.get("/questionsByUserId/:id", questionController.getQuestionsByUserId);
router.post("/questions", questionController.createQuestion);
router.patch("/questions/:id", questionController.updateQuestion);
router.delete("/questions/:id", questionController.deleteQuestion);
module.exports = router;
