const express = require("express");
const router = express.Router();
const AdsController = require("../Controllers/AdsController.js");

router.get("/ads", AdsController.getAll);
router.get("/ads/:id", AdsController.getAdById);
router.get("/adsByUser/:userId", AdsController.getAdsByUser);
router.get("/adsBySearch", AdsController.getAdsBySearch);
router.get("/adsSearchParams", AdsController.getParamsForSearch);
router.post("/ads", AdsController.createAd);
router.delete("/ads/:id", AdsController.deleteAd);
router.patch("/ads/:id", AdsController.updateAd);
module.exports = router;
