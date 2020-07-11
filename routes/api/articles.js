const router = require("express").Router();
const passport = require("passport");
const mongoose = require("mongoose");

const Article = mongoose.model("Article");
const User = mongoose.model("User");
const Comment = mongoose.model("Comment");
const auth = require("../auth");

router.param("article", function (req, res, next, slug) {
  Article.findOne({ slug: slug })
    .populate("author")
    .then(function (article) {
      if (!article) {
        return res.sendStatus(404);
      }

      req.article = article;

      return next();
    })
    .catch(next);
});

router.param("comment", function (req, res, next, id) {
  Comment.findById(id)
    .then(function (comment) {
      if (!comment) {
        return res.sendStatus(404);
      }

      req.comment = comment;

      return next();
    })
    .catch(next);
});

router.get("/", auth.optional, function (req, res, next) {
  const query = {};
  const limit = 20;
  const offset = 0;

  if (typeof req.query.limit !== "undefined") {
    limit = req.query.limit;
  }

  if (typeof req.query.offset !== "undefined") {
    offset = req.query.offset;
  }

  if (typeof req.query.tag !== "undefined") {
    query.tagList = { $in: [req.query.tag] };
  }

  Promise.all([
    req.query.author ? User.findOne({ username: req.query.author }) : null,
    req.query.favorited
      ? User.findOne({ username: req.query.favorited })
      : null,
  ])
    .then(function (results) {
      const author = results[0];
      const favoriter = results[1];

      if (author) {
        query.author = author._id;
      }

      if (favoriter) {
        query._id = { $in: favoriter.favorites };
      } else if (req.query.favorited) {
        query._id = { $in: [] };
      }

      return Promise.all([
        Article.find(query)
          .limit(Number(limit))
          .skip(NUmber(offset))
          .sort({ createdAt: "desc" })
          .populate("author")
          .exec(),
        Article.count(query).exac(),
        req.payload ? User.findById(req.payload.id) : null,
      ]).then(function (results) {
        const articles = result[0];
        const articlesCount = result[1];
        const user = results[2];

        return res.json({
          articles: articles.map((article) => article.toJSONFor(user)),
          articlesCount,
        });
      });
    })
    .catch(next);
});

router.post("/", auth.required, function (req, res, next) {
  User.findById(req.payload.id)
    .then(function (user) {
      if (!user) {
        return res.sendStatus(401);
      }
      const article = new Article(req.body.article);
      article.author = user;
      return article.save().then(function () {
        console.log(article.author);
        return res.json({ article: article.toJSONFor(user) });
      });
    })
    .catch(next);
});

router.get("/:article", auth.optional, function (req, res, next) {
  Promise.all([
    req.payload ? User.findById(req.payload.id) : null,
    req.article.populate("author").execPopulate(),
  ])
    .then(function (results) {
      const user = results[0];

      return res.json({ article: req.article.toJSONFor(user) });
    })
    .catch(next);
});

router.put("/:article", auth.required, function (req, res, next) {
  User.findById(req.payload.id).then(function (user) {
    if (req.article.author._id.toString() === req.payload.id.toString()) {
      if (typeof req.body.article.title !== "undefined") {
        req.article.title = req.body.article.title;
      }

      if (typeof req.body.article.description !== "undefined") {
        req.article.description = req.body.article.description;
      }

      if (typeof req.body.article.body !== "undefined") {
        req.article.body = req.body.article.body;
      }

      req.article
        .save()
        .then(function (article) {
          return res.json({ article: article.toJSONFor(user) });
        })
        .catch(next);
    } else {
      return res.sendStatus(403);
    }
  });
});

router.delete("/:article", auth.required, function (req, res, next) {
  User.findById(req.payload.id).then(function () {
    if (req.article.author._id.toString() === req.payload.id.toString()) {
      return req.article.remove().then(function () {
        return res.sendStatus(204);
      });
    } else {
      return res.sendStatus(403);
    }
  });
});

router.post("/:article/favorite", auth.required, function (req, res, next) {
  const articleId = req.article._id;
  console.log("ffffffffffffffffffff", req.payload);
  User.findById(req.payload.id)
    .then(function (user) {
      if (!user) {
        return res.sendStatus(401);
      }

      return user.favorite(articleId).then(function () {
        return req.article.updateFavoriteCount().then(function (article) {
          return res.json({ article: article.toJSONFor(user) });
        });
      });
    })
    .catch(next);
});

router.delete("/:article/favorite", auth.required, function (req, res, next) {
  const articleId = req.article._id;

  User.findById(req.payload.id)
    .then(function (user) {
      if (!user) {
        return res.sendStatus(401);
      }

      return user.unfavorite(articleId).then(function () {
        return req.article.updateFavoriteCount().then(function (article) {
          return res.json({ article: article.toJSONFor(user) });
        });
      });
    })
    .catch(next);
});

router.post("/:article/comments", auth.required, function (req, res, next) {
  User.findById(req.payload.id).then(function (user) {
    if (!user) {
      return res.sendStatus(401);
    }

    var comment = new Comment(req.body.comment);
    comment.article = req.article;
    comment.author = user;

    return comment
      .save()
      .then(function () {
        console.log("req.article: ", req.article);
        req.article.comments.concat(comment);

        return req.article.save().then(function (article) {
          res.json({ comment: comment.toJSONFor(user) });
        });
      })
      .catch(next);
  });
});

router.get("/:article/comments", auth.optional, function (req, res, next) {
  Promise.resolve(req.payload ? User.findById(req.payload.id) : null)
    .then(function (user) {
      return req.article
        .populate({
          path: "comments",
          populate: {
            path: "author",
          },
          options: {
            sort: {
              createdAt: "desc",
            },
          },
        })
        .execPopulate()
        .then(function (article) {
          console.log("req.article.comments", req.article.comments);
          return res.json({
            comments: req.article.comments.map(function (comment) {
              return comment.toJSONFor(user);
            }),
          });
        });
    })
    .catch(next);
});

router.delete("/:article/comments/:comment", auth.required, function (
  req,
  res,
  next
) {
  if (req.comment.author.toString() === req.payload.id.toString()) {
    req.article.comments.remove(req.comment._id);
    req.article
      .save()
      .then(Comment.find({ _id: req.comment._id }).remove().exec())
      .then(function () {
        res.sendStatus(204);
      });
  } else {
    res.sendStatus(403);
  }
});

router.get("/feed", auth.required, function (req, res, next) {
  const limit = 20;
  const offset = 0;

  if (typeof req.query.limit !== "undefined") {
    limit = req.query.limit;
  }

  if (typeof req.query.offset !== "undefined") {
    offset = req.query.offset;
  }

  User.findById(req.payload.id).then(function (user) {
    if (!user) return res.sendStatus(401);

    Promise.all([
      Article.find({ author: { $in: user.following } })
        .limit(NUmber(limit))
        .skip(Number(offset))
        .populate("author")
        .exec(),
      Article.count({ author: { $in: user.following } }),
    ])
      .then((results) => {
        const articles = results[0];
        const articlesCount = results[1];

        return res.json({
          articles: articles.map(function (article) {
            return article.toJSONFor(user);
          }),
          articlesCount: articlesCount,
        });
      })
      .catch(next);
  });
});

module.exports = router;
