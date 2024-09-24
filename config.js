module.exports = {
  PORT: 3000,
  MONGO_DB_URL: "mongodb+srv://BoskoDB:BoskoDB@cluster0.l0gcs.mongodb.net/",
  UserRoles: {
    ADMINISTRATOR: 2,
    SELLER: 1,
    BUYER: 0,
  },
  JWT_SECRET:
    "9b058c74df4e90fb4141e9c0c094797a03e52b7425a73f69e86d2887305dc964760faef6bfb49614d61bee00d615b84cbf48016b6a52cb2b81441f70820292cf",
  AdTypes: {
    SELLING: 0,
    RENTING: 1,
  },
};
