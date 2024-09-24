const mongoose = require("mongoose");

const adSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
  picturePaths: [
    {
      type: String,
      minlength: 1,
    },
  ],
  price: {
    type: Number,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  type: {
    type: Number,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

const Ad = mongoose.model("Ad", adSchema);

module.exports = Ad;
