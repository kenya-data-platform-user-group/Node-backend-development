// Query Playground: admin@localhost:10260
//
// Use Ctrl+Enter to run the current block or Ctrl+Shift+Enter to run the entire file
// Note: when running multiple statements, only the last result is displayed

// --- Connection Info ---
db.runCommand({ ping: 1 });

// --- List All Databases ---
db.adminCommand({ listDatabases: 1 });

// --- Current User Roles & Permissions ---
db.adminCommand({ connectionStatus: 1 }).authInfo.authenticatedUserRoles;

db.getUsers(); // list users in current database

db.stats(); // database stats

db.version(); // server version

// create collections
db.createCollection('posts'); // create 'posts' collection
db.createCollection('trends'); // create 'trends' collection
db.createCollection('comments'); // create 'comments' collection

// list collections
db.getCollectionNames();

// delete a collection
db.getCollection('comments').drop();

// insert a document to the 'trends' collection
db.getCollection('trends').insertOne({
  topic: 'DocumentDB',
  mentions: 1000,
  date: new Date(),
});

// insert multiple documents to the 'trends' collection
db.getCollection('trends').insertMany([
  { topic: 'NoSQLDB', mentions: 800, date: new Date() },
  { topic: 'MongoDB', mentions: 1200, date: new Date() },
]);

// delete all documents in the 'trends' collection
db.getCollection('trends').deleteMany({});

// delete with id
db.getCollection('trends').deleteOne({
  _id: ObjectId('6a257f3a03d4236073fb33a1'),
});

// find all documents in the 'trends' collection
db.getCollection('trends').find().toArray();

// search for a trend by topic
db.getCollection('trends').find({ topic: 'DocumentDB' }).toArray();

// search by a regular expression
// ending with 'DB'
db.getCollection('trends').find({ topic: /oDB$/ }).toArray(); // topics ending with 'DB'

// starting with 'M'
db.getCollection('trends').find({ topic: /^M/ }).toArray();

// containing 'SQL'
db.getCollection('trends').find({ topic: /SQL/ }).toArray();

// Find with Filter

// insert man posts to the 'posts' collection
db.getCollection('posts').insertMany([
  { title: 'Post 1', content: 'Content 1', createdAt: new Date() },
  { title: 'Post 2', content: 'Content 2', createdAt: new Date() },
  { title: 'Post 3', content: 'Content 3', createdAt: new Date() },
]);
// find with a filter
db.getCollection('posts').find({ title: 'Post 1' }).toArray(); // find post with title 'Post 1'

// Find One Document
db.getCollection('posts').findOne({ title: 'Post 1' }); // find one post with title 'Post 1'

//  Find with Sorting
// find all posts sorted by createdAt descending
db.getCollection('posts').find().sort({ createdAt: -1 }).toArray();

// // find all posts sorted by createdAt ascending
db.getCollection('posts').find().sort({ createdAt: 1 }).toArray();

// Find with Limit & Skip (pagination)
db.getCollection('posts')
  .find()
  .sort({ createdAt: -1 })
  .skip(0)
  .limit(2)
  .toArray(); // get first 2 posts

// Count Documents
db.getCollection('posts').countDocuments(); // count all documents in the 'posts' collection

db.getCollection('posts').countDocuments({ author: 'admin' });

// ----- UPDATE -----
// Update One Document
db.getCollection('posts').updateOne(
  { title: 'Post 1' }, // filter
  { $set: { content: 'Updated Content 1' } }, // update operation
);

// Update Many Documents
db.getCollection('posts').updateMany(
  { title: /^Post/ }, // filter
  { $set: { author: 'admin' } }, // update operation
);

// Update Many Documents
db.getCollection('posts').updateMany(
  { author: 'admin' },
  { $set: { status: 'published' } },
);

// Replace Entire Document
db.getCollection('posts').replaceOne(
  { _id: ObjectId('...') },
  { title: 'New Title', content: 'New Content', createdAt: new Date() },
);

// ----- DELETE -----

// Delete One Document
db.getCollection('posts').deleteOne({ title: 'Post to Remove' });

// Delete Many Documents
db.getCollection('posts').deleteMany({ status: 'draft' });

// Delete All Documents in Collection
db.getCollection('posts').deleteMany({});

// ************************************************************
// 6. QUERY OPERATORS & FILTERS
// ************************************************************

// --- Comparison ---
db.getCollection('posts').find({ views: { $gt: 100 } }); // greater than
db.getCollection('posts').find({ views: { $gte: 100 } }); // greater than or equal
db.getCollection('posts').find({ views: { $lt: 50 } }); // less than
db.getCollection('posts').find({ views: { $lte: 50 } }); // less than or equal
db.getCollection('posts').find({ status: { $ne: 'draft' } }); // not equal
db.getCollection('posts').find({ status: { $in: ['published', 'featured'] } }); // in array

// --- Logical ---
db.getCollection('posts').find({
  $and: [{ author: 'admin' }, { status: 'published' }],
});
db.getCollection('posts').find({
  $or: [{ author: 'admin' }, { author: 'editor' }],
});

// --- Element ---
db.getCollection('posts').find({ tags: { $exists: true } });

// --- Regex ---
db.getCollection('posts').find({ title: { $regex: /documentdb/i } });

// ************************************************************
// 7. AGGREGATION PIPELINE
// ************************************************************

// --- Count Posts by Author ---
db.getCollection('posts').aggregate([
  { $group: { _id: '$author', totalPosts: { $sum: 1 } } },
  { $sort: { totalPosts: -1 } },
]);

// --- Posts with Comment Count (lookup/join) ---
db.getCollection('posts').aggregate([
  {
    $lookup: {
      from: 'comments',
      localField: '_id',
      foreignField: 'postId',
      as: 'comments',
    },
  },
  { $addFields: { commentCount: { $size: '$comments' } } },
  { $project: { title: 1, author: 1, commentCount: 1 } },
]);

// ************************************************************
// 8. COMMENTS COLLECTION
// ************************************************************

// --- List All Comments ---
db.getCollection('comments').find().toArray();

// --- Find Comments for a Specific Post ---
db.getCollection('comments').find({ postId: ObjectId('...') });

// --- Insert a Comment ---
db.getCollection('comments').insertOne({
  postId: ObjectId('...'),
  author: 'user1',
  body: 'Great post!',
  createdAt: new Date(),
});
