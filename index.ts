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

await connectToMongoDB();
const db = client.db('studio-space');
const studiosCollection = db.collection('studios');
const myStudiosBookingCollection = db.collection('my-bookings')

app.get('/', (req, res) => {
    res.send({message: "Server Is Runing"})
})

app.get('/studios', async (req, res) => {
    const result = await  studiosCollection.find().toArray()
    res.send(result)
})

app.get('/studios/:id', async (req, res) => {
    const {id} = req.params
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: 'Invalid id' })
    }
    const result = await  studiosCollection.findOne({_id:new ObjectId(id)})
    res.send(result)
})

app.get('/studios/category/:category', async (req, res)=> {
  const { category } = req.params
  const result = await studiosCollection.find({category}).toArray()
  res.send(result)
})

app.patch('/studios/:id', async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: 'Invalid id' })
  }

const { ownerEmail, title, category, hourlyRate, securityDeposit, maxCapacity,
          location, image, gallery, amenities, overview } = req.body

  const result = await studiosCollection.updateOne(
    { _id: new ObjectId(id), ownerEmail },
    { $set: { ownerEmail, title, category, hourlyRate, securityDeposit, maxCapacity,
          location, image, gallery, amenities, overview } }
  );
  if (result.matchedCount === 0) {
    return res.status(403).send({ message: 'Studio not found or you are not the owner' })
  }
  res.send(result)
});

app.post('/add-studios', async (req, res) => {
  const data = req.body
  const result = await studiosCollection.insertOne(data)
  res.send(result)
})

app.post('/my-bookings', async(req, res) => {
  const data = req.body
  const result = await myStudiosBookingCollection.insertOne(data)
  res.send(result)
})

app.get('/my-bookings/:email', async (req, res) => {
  const { email } = req.params
  const result = await myStudiosBookingCollection.find({email: email}).toArray()
  res.send(result)
})

app.delete('/my-bookings/:id', async (req, res) => {
  const { id } = req.params;
  const email = req.query.email as string
  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: 'Invalid id' })
  }
  if (!email) {
    return res.status(400).send({ message: 'Email is required' })
  }


  const result = await myStudiosBookingCollection.deleteOne({ _id: new ObjectId(id), email })
  if (result.deletedCount === 0) {
    return res.status(403).send({ message: 'Booking not found or not yours' })
  }
  res.send(result)
})

if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`This Server Is Running On Port: ${port}`)
    })
}

export default app;
