const router = require("express").Router();
const mongoose = require("mongoose");
const Article = mongoose.model("Article");

router.get("/", function (req, res, next) {
  Article.find()
    .distinct("tagList")
    .then(function (tags) {
      return res.json({ tags });
    });
});

module.exports = router;
