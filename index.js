import 'dotenv/config';
import { MongoClient } from 'mongodb';

function a(a, b = false, c = false) {
    if (c) {
        console.table(
            a.map(item =>
                Object.fromEntries(
                    Object.entries(item).map(([key, value]) => [key,
                        Array.isArray(value) ? value.map(v => typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)).join(', ')
                            : typeof value === 'object' && value !== null ? JSON.stringify(value) : value
                    ])
                )
            )
        );
        return;
    }
    if (b) {
        console.log(JSON.stringify(a, null, 2));
    } else {
        console.log(a);
    }
};

const mongoUri = process.env.MONGODB_URL;
const client = new MongoClient(mongoUri);
const collectionName = 'story';

async function getFields() {
    const documents = await client.db().collection(collectionName).find({}).limit(100).toArray();
    const fields = new Set();
    documents.forEach(document => {
        Object.keys(document).forEach(field => fields.add(field));
    });
    a([...fields], true);
    a([...fields].length);
};

async function describeCollection() {
    const db = client.db();
    const collection = db.collection(collectionName);
    const result = await collection.aggregate([
        {
            $project: {
                fields: { $objectToArray: "$$ROOT" }
            }
        },
        {
            $unwind: "$fields"
        },
        {
            $project: {
                key: "$fields.k",
                type: { $type: "$fields.v" }
            }
        },
        {
            $group: {
                _id: {
                    field: "$key",
                    type: "$type"
                },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: "$_id.field",
                totalOccurrences: { $sum: "$count" },
                types: {
                    $push: {
                        type: "$_id.type",
                        count: "$count"
                    }
                }
            }
        },
        {
            $sort: { _id: 1 }
        }
    ]).toArray();
    const numOfDocuments = await collection.countDocuments();
    a("Total Documents: " + numOfDocuments);
    console.table(result.map(r => ({
        field: r._id,
        totalOccurrences: r.totalOccurrences,
        types: r.types.map(t => `${t.type} (${t.count})`).join(', ')
    })));
}

async function removeFieldFromCollection(fieldName) {
    const db = client.db();
    const collection = db.collection(collectionName);
    const result = await collection.updateMany(
        { [fieldName]: { $exists: true } },
        { $unset: { [fieldName]: "" } }
    );
    a(result.modifiedCount);
};

async function addFieldToCollection(fieldName, defaultValue) {
    const db = client.db();
    const collection = db.collection(collectionName);
    const result = await collection.updateMany(
        { [fieldName]: { $exists: false } },
        { $set: { [fieldName]: defaultValue } }
    );
    a(result.modifiedCount);
};

const q = {
    warningText: { $exists: true },
    warningText: '',
};
const p = {
    slug: 1,
    warningText: 1
};

async function main() {
    const db = client.db();
    const collection = db.collection(collectionName);
    const documents = await collection.find(q, { projection: p }).toArray();
    a(documents);
};

try {
    await client.connect();
    await main();
    // await getFields();
    // await describeCollection();
    // await removeFieldFromCollection("geoRestricted");
    // await addFieldToCollection("coverPictureLandscape", null);
} finally {
    client.close();
}
