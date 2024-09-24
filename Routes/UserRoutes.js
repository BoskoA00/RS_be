const express = require("express");
const router = express.Router();
const userController = require("../Controllers/UserController.js");

router.get("/user", userController.getAll);
router.get("/getUserByEmail", userController.getUserByEmail);
router.get("/user/:id", userController.getUserById);
router.get("/searchUsersByEmail", userController.searchUsersByEmail);
router.post("/user/register", userController.register);
router.post("/user/login", userController.login);
router.delete("/user", userController.deleteUserByEmail);
router.delete("/user/:id", userController.deleteUserById);
router.patch("/user/:id", userController.updateUser);
router.patch("/demoteUser/:id", userController.DemoteUser);
router.patch("/promoteUser/:id", userController.PromoteUser);
module.exports = router;
