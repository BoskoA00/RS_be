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
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const ads = await Ads.find({})
      .skip(skip)
      .limit(limit)
      .populate("userId", "firstName lastName")
      .populate("picturePaths");
    const totalAds = await Ads.countDocuments();

    if (ads.length === 0) {
      return res.status(200).json({ message: "Nema oglasa." });
    }

    res.status(200).json({
      ads: ads.reverse(),
      totalAds,
      totalPages: Math.ceil(totalAds / limit),
      currentPage: page,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Došlo je do greške." });
  }
};

exports.getAdById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(500)
        .json({ message: "ID oglasa nije odgovarajućeg formata." });
    }
    const ad = await Ads.findById(id).populate("userId", "firstName lastName");
    if (!ad) {
      return res.status(404).json({ message: "Oglas nije nadjen." });
    }
    res.status(200).json(ad);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Došlo je do greške." });
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
        return res
          .status(404)
          .json({ message: "ID korisnika nije odgovarajućeg formata." });
      }

      const user = await User.findById(requestingUserID);
      if (!user) {
        return res.status(404).json({ message: "Korisnik nije pronađen." });
      }

      if (
        user.role !== config.UserRoles.ADMINISTRATOR &&
        user.role !== config.UserRoles.SELLER
      ) {
        return res
          .status(403)
          .json({ message: "Korisnik nema mogućnost kreiranja oglasa." });
      }

      if (!title || !title.trim()) {
        return res.status(400).json({ message: "Naslov je neophodan." });
      }
      if (!city || !city.trim()) {
        return res.status(400).json({ message: "Grad je neophodan." });
      }
      if (!country || !country.trim()) {
        return res.status(400).json({ message: "Država je neophodna." });
      }
      if (price <= 0 || isNaN(price)) {
        return res
          .status(400)
          .json({ message: "Cena mora biti pozitivan broj." });
      }
      if (size <= 0 || isNaN(size)) {
        return res
          .status(400)
          .json({ message: "Veličina mora biti pozitivan broj" });
      }
      if (!(config.AdTypes.RENTING == type || config.AdTypes.SELLING == type)) {
        return res.status(400).json({ message: "Neodgovarajući tip oglasa." });
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
      res.status(200).json({ message: "Oglas uspešno kreiran", ad: returnAd });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Došlo je do greške." });
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
        return res
          .status(404)
          .json({ message: "ID korisnika nije odgovarajućeg formata." });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(500)
          .json({ message: "ID oglasa nije odgovarajućeg formata." });
      }

      const adToDelete = await Ads.findById(id);
      if (!adToDelete) {
        return res.status(404).json({ message: "Oglas nije pronađen." });
      }

      if (requestingUserRole != config.UserRoles.ADMINISTRATOR) {
        if (requestingUserID != adToDelete.userId) {
          return res
            .status(403)
            .json({ message: "Nemate dozovolu za ovu akciju." });
        }
      }

      const adFolderPath = path.join(
        __dirname,
        "../AdsPicturesFolder",
        id.toString()
      );
      await fs.remove(adFolderPath);

      await Ads.findByIdAndDelete(id);

      res.status(200).json({ message: "Oglas uspešno izbrisan!" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Došlo je do greške." });
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
        return res
          .status(404)
          .json({ message: "ID korisnika nije validnog formata." });
      }
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(500)
          .json({ message: "Id oglasa nije validnog formata." });
      }
      const adToUpdate = await Ads.findById(id);
      if (!adToUpdate) {
        return res.status(404).json({ message: "Oglas nije pronađen." });
      }
      if (requestingUserRole != config.UserRoles.ADMINISTRATOR) {
        if (requestingUserID != adToUpdate.userId) {
          return res
            .status(403)
            .json({ message: "Nemate dozvolu za ovu akciju." });
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
        return res.status(400).json({ message: "Nema podataka za izmenu." });
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
        .json({ message: "Oglas uspešno izmenjen", ad: updatedAd });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Došlo je do greške." });
    }
  },
];

exports.getAdsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(404)
        .json({ message: "ID korisnika nije validnog formata." });
    }

    const ads = await Ads.find({ userId: userId }).populate(
      "userId",
      "firstName lastName"
    );
    if (!ads) {
      return res
        .status(404)
        .json({ message: "Ne postoje oglasi ovog korisnika." });
    }
    res.status(200).json(ads);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Došlo je do greške." });
  }
};
exports.getAdsBySearch = async (req, res) => {
  try {
    const {
      city,
      country,
      maxPrice,
      minPrice,
      minSize,
      maxSize,
      type,
      page = 1,
    } = req.query;
    const limit = 4;
    const skip = (page - 1) * limit;
    const query = {};

    if (city && city.trim() !== "") query.city = city;
    if (country && country.trim() !== "") query.country = country;
    if (maxPrice && parseFloat(maxPrice) > 0)
      query.price = { ...query.price, $lte: parseFloat(maxPrice) };
    if (minPrice && parseFloat(minPrice) > 0)
      query.price = { ...query.price, $gte: parseFloat(minPrice) };
    if (minSize && parseFloat(minSize) > 0)
      query.size = { ...query.size, $gte: parseFloat(minSize) };
    if (maxSize && parseFloat(maxSize) > 0)
      query.size = { ...query.size, $lte: parseFloat(maxSize) };
    if (
      type != "" &&
      (type == config.AdTypes.SELLING || type == config.AdTypes.RENTING)
    )
      query.type = parseInt(type);

    const ads = await Ads.find(query)
      .skip(skip)
      .limit(limit)
      .populate("userId", "firstName lastName");

    const totalAds = await Ads.countDocuments(query);

    if (ads.length === 0) {
      return res
        .status(200)
        .json({ message: "Nema oglasa koji odgovaraju parametrima." });
    }

    res.status(200).json({
      ads,
      totalAds,
      totalPages: Math.ceil(totalAds / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Došlo je do greške." });
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
