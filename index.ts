import express from 'express';
import "dotenv/config";
import cors from "cors";
import { MongoClient, ObjectId } from 'mongodb';

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_DB_URI as string);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const mongoClient = await connectToMongoDB();
const db = mongoClient.db('studio-space');
const studiosCollection = db.collection('studios');

app.get('/', (req, res) => {
    res.send('Hello World')
})

app.get('/studios', async (req, res) => {
    const result = await  studiosCollection.find().toArray()
    res.send(result)
})

app.get('/studios/:id', async (req, res) => {
    const {id} = req.params
    const result = await  studiosCollection.findOne({_id:new ObjectId(id)})
    res.send(result)
})


app.listen(port, () => {
    console.log(`This Server Is Running On Port: ${port}`)
})
