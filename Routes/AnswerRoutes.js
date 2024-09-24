const express = require("express");
const router = express.Router();
const answerController = require("../Controllers/AnswerController.js");

router.get("/answers", answerController.getAll);
router.get("/answers/:id", answerController.getAnswerById);
router.get("/answersByQuestion/:id", answerController.getAnswerByQuestion);
router.get("/answersByUserId/:id", answerController.getAnswersByUserId);
router.post("/answers", answerController.createAnswer);
router.patch("/answers/:id", answerController.updateAnswer);
router.delete("/answers/:id", answerController.deleteAnswer);
module.exports = router;
