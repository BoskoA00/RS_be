const Ads = require("../Models/Ad");
const User = require("../Models/User");
const mongoose = require("mongoose");
const config = require("../config.js");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");
const authenticateToken = require("../Middleware/AuthenticationMiddleware.js");
const { count } = require("console");

const upload = multer({ dest: "temp/" });

exports.getAll = async (req, res) => {
  try {
    const ads = await Ads.find({})
      .populate("userId", "firstName lastName")
      .populate("picturePaths");
    if (ads.length === 0) {
      return res.status(200).json({ message: "No ads found" });
    }

    res.status(200).json(ads);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "There was an error while trying to retrieve ads" });
  }
};
exports.getAdById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(500).json({ message: "Ad ID must be in valid format" });
    }
    const ad = await Ads.findById(id).populate("userId", "firstName lastName");
    if (!ad) {
      return res.status(404).json({ message: "Ad not found" });
    }
    res.status(200).json(ad);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "There was an error while trying to retrieve ad" });
  }
};

exports.createAd = [
  authenticateToken,
  upload.array("pictures"),
  async (req, res) => {
    try {
      const requestingUserID = req.user.id;
      const { title, city, country, price, size, type } = req.body;
      const pictureFiles = req.files;

      if (!mongoose.Types.ObjectId.isValid(requestingUserID)) {
        return res.status(404).json({ message: "User ID is not valid" });
      }

      const user = await User.findById(requestingUserID);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (
        user.role !== config.UserRoles.ADMINISTRATOR &&
        user.role !== config.UserRoles.SELLER
      ) {
        return res.status(403).json({ message: "User cannot create ads" });
      }

      if (!title || !title.trim()) {
        return res.status(400).json({ message: "Title is required" });
      }
      if (!city || !city.trim()) {
        return res.status(400).json({ message: "City is required" });
      }
      if (!country || !country.trim()) {
        return res.status(400).json({ message: "Country is required" });
      }
      if (price <= 0 || isNaN(price)) {
        return res
          .status(400)
          .json({ message: "Price must be a positive number" });
      }
      if (size <= 0 || isNaN(size)) {
        return res
          .status(400)
          .json({ message: "Size must be a positive number" });
      }
      if (!(config.AdTypes.RENTING == type || config.AdTypes.SELLING == type)) {
        return res.status(400).json({ message: "Invalid ad type" });
      }

      const newAd = new Ads({
        title,
        city,
        country,
        price,
        size,
        type,
        userId: requestingUserID,
      });

      const savedAd = await newAd.save();

      const adFolderPath = path.join(
        __dirname,
        "../AdsPicturesFolder",
        savedAd._id.toString()
      );
      await fs.ensureDir(adFolderPath);

      const picturePaths = pictureFiles.map((file) => {
        const newFilePath = path.join(adFolderPath, file.originalname);
        fs.renameSync(file.path, newFilePath);
        return path.join(savedAd._id.toString(), file.originalname);
      });

      savedAd.picturePaths = picturePaths;
      await savedAd.save();

      user.ads.push(savedAd._id);
      await user.save();

      const returnAd = await Ads.findById(savedAd._id);
      res
        .status(200)
        .json({ message: "Ad created successfully", ad: returnAd });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "An error occurred while creating a new ad" });
    }
  },
];

exports.deleteAd = [
  authenticateToken,
  async (req, res) => {
    try {
      const requestingUserRole = req.user.role;
      const requestingUserID = req.user.id;
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(requestingUserID)) {
        return res.status(404).json({ message: "User ID is not valid" });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(500)
          .json({ message: "Ad ID must be in valid format" });
      }

      const adToDelete = await Ads.findById(id);
      if (!adToDelete) {
        return res.status(404).json({ message: "Ad not found" });
      }

      if (requestingUserRole != config.UserRoles.ADMINISTRATOR) {
        if (requestingUserID != adToDelete.userId) {
          return res
            .status(403)
            .json({ message: "You do not have permission to delete this ad." });
        }
      }

      const adFolderPath = path.join(
        __dirname,
        "../AdsPicturesFolder",
        id.toString()
      );
      await fs.remove(adFolderPath);

      await Ads.findByIdAndDelete(id);

      res.status(200).json({ message: "Ad deleted successfully!" });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ message: "An error occurred while deleting an ad" });
    }
  },
];

exports.updateAd = [
  authenticateToken,
  async (req, res) => {
    try {
      const requestingUserRole = req.user.role;
      const requestingUserID = req.user.id;
      const { id } = req.params;
      const { title, city, country, price, size, type } = req.body;
      if (!mongoose.Types.ObjectId.isValid(requestingUserID)) {
        return res.status(404).json({ message: "User ID is not valid" });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(500)
          .json({ message: "Ad ID must be in valid format" });
      }
      const adToUpdate = await Ads.findById(id);
      if (!adToUpdate) {
        return res.status(404).json({ message: "Ad not found" });
      }
      if (requestingUserRole != config.UserRoles.ADMINISTRATOR) {
        if (requestingUserID != adToUpdate.userId) {
          return res
            .status(403)
            .json({ message: "You do not have permission to update this ad." });
        }
      }
      if (
        !title &&
        !city &&
        !country &&
        (type === null || type === undefined) &&
        size <= 0 &&
        price <= 0
      ) {
        return res.status(400).json({ message: "No updates provided" });
      }

      if (title) adToUpdate.title = title;
      if (city) adToUpdate.city = city;
      if (country) adToUpdate.country = country;
      if (price && price > 0 && !isNaN(price)) adToUpdate.price = price;
      if (size && size > 0 && !isNaN(size)) adToUpdate.size = size;
      if (type && Object.values(config.AdTypes).includes(type)) {
        adToUpdate.type = type;
      }
      await adToUpdate.save();
      const updatedAd = await Ads.findById(id).populate(
        "userId",
        "firstName lastName"
      );
      res
        .status(200)
        .json({ message: "Ad updated successfully", ad: updatedAd });
    } catch (error) {
      console.log(error);
      return res
        .status(500)
        .json({ message: "There was an error while trying to delete ad" });
    }
  },
];

exports.getAdsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(404)
        .json({ message: "User ID must be in valid format" });
    }

    const ads = await Ads.find({ userId: userId }).populate(
      "userId",
      "firstName lastName"
    );
    if (!ads) {
      return res.status(404).json({ message: "No ads found for this user" });
    }
    res.status(200).json(ads);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "There was an error while trying to retrieve ads" });
  }
};
exports.getAdsBySearch = async (req, res) => {
  try {
    const { city, country, maxPrice, minPrice, minSize, maxSize, type } =
      req.query;
    const query = {};

    if (city && city.trim() !== "") {
      query.city = city;
    }

    if (country && country.trim() !== "") {
      query.country = country;
    }

    if (maxPrice && parseFloat(maxPrice) > 0) {
      query.price = { ...query.price, $lte: parseFloat(maxPrice) };
    }

    if (minPrice && parseFloat(minPrice) > 0) {
      query.price = { ...query.price, $gte: parseFloat(minPrice) };
    }

    if (minSize && parseFloat(minSize) > 0) {
      query.size = { ...query.size, $gte: parseFloat(minSize) };
    }

    if (maxSize && parseFloat(maxSize) > 0) {
      query.size = { ...query.size, $lte: parseFloat(maxSize) };
    }

    if (
      type != "" &&
      (type == config.AdTypes.SELLING || type == config.AdTypes.RENTING)
    ) {
      query.type = parseInt(type);
    }
    const ads = await Ads.find(query).populate("userId", "firstName lastName");

    if (ads.length === 0) {
      return res
        .status(200)
        .json({ message: "No ads found matching the criteria" });
    }

    res.status(200).json(ads);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "There was an error while trying to retrieve ads" });
  }
};

exports.getParamsForSearch = async (req, res) => {
  const ads = await Ads.find();

  const minPrice = Math.min(...ads.map((ad) => ad.price));
  const maxPrice = Math.max(...ads.map((ad) => ad.price));
  const minSize = Math.min(...ads.map((ad) => ad.size));
  const maxSize = Math.max(...ads.map((ad) => ad.size));

  res.json({
    minPrice,
    maxPrice,
    minSize,
    maxSize,
  });
};
