import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_DB_URI as string);

export async function connectToMongoDB() {
    try {
        await client.connect();
        console.log('You successfully connected to MongoDB!');
    } catch (err) {
        console.dir(err);
    }
}

await connectToMongoDB();
const db = client.db('studio-space');
const studiosCollection = db.collection('studios');
const bookingsCollection = db.collection('my-bookings');

app.get('/', (req, res) => {
    res.send({ message: 'Server Is Running' });
});

// ---------- Studios ----------

app.get('/studios', async (req, res) => {
    const result = await studiosCollection.find().toArray();
    res.send(result);
});

app.get('/featured-studios', async (req, res) => {
    const result = await studiosCollection
        .find()
        .sort({ rating: -1, _id: -1 })
        .limit(6)
        .toArray();
    res.send(result);
});

app.get('/studios/category/:category', async (req, res) => {
    const { category } = req.params;
    const result = await studiosCollection.find({ category }).toArray();
    res.send(result);
});

app.get('/studios/:id', async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid id' });
    }
    const result = await studiosCollection.findOne({ _id: new ObjectId(id) });
    res.send(result);
});

app.get('/my-listings/:email', async (req, res) => {
    const { email } = req.params;
    const result = await studiosCollection.find({ ownerEmail: email }).toArray();
    res.send(result);
});

app.post('/add-studios', async (req, res) => {
    const result = await studiosCollection.insertOne(req.body);
    res.send(result);
});

app.patch('/studios/:id', async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid id' });
    }
    const { ownerEmail, title, category, hourlyRate, securityDeposit, maxCapacity,
        location, image, gallery, amenities, overview } = req.body;

    const result = await studiosCollection.updateOne(
        { _id: new ObjectId(id), ownerEmail },
        { $set: { title, category, hourlyRate, securityDeposit, maxCapacity,
            location, image, gallery, amenities, overview } }
    );
    if (result.matchedCount === 0) {
        return res.status(403).send({ message: 'Studio not found or you are not the owner' });
    }
    res.send(result);
});

app.delete('/studios/:id', async (req, res) => {
    const { id } = req.params;
    const email = req.query.email as string;
    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid id' });
    }
    if (!email) {
        return res.status(400).send({ message: 'Email is required' });
    }
    const result = await studiosCollection.deleteOne({ _id: new ObjectId(id), ownerEmail: email });
    if (result.deletedCount === 0) {
        return res.status(403).send({ message: 'Studio not found or you are not the owner' });
    }
    res.send(result);
});

// ---------- Bookings ----------

app.post('/my-bookings', async (req, res) => {
    const { studioId, date, startTime, endTime } = req.body;
    const timeFormat = /^\d{2}:\d{2}$/;
    if (!studioId || !date || !timeFormat.test(startTime) || !timeFormat.test(endTime)) {
        return res.status(400).send({ message: 'studioId, date, startTime and endTime (HH:MM) are required' });
    }
    if (startTime >= endTime) {
        return res.status(400).send({ message: 'End time must be after start time' });
    }

    // Double-booking prevention: reject any overlap with an active booking on the same day
    const clash = await bookingsCollection.findOne({
        studioId,
        date,
        status: { $in: ['Pending', 'Confirmed'] },
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
    });
    if (clash) {
        return res.status(409).send({
            message: `Already booked on ${date} from ${clash.startTime} to ${clash.endTime}`,
        });
    }

    const result = await bookingsCollection.insertOne({ ...req.body, status: 'Pending' });
    res.send(result);
});

app.get('/my-bookings/:email', async (req, res) => {
    const { email } = req.params;
    const result = await bookingsCollection.find({ email }).toArray();
    res.send(result);
});

app.patch('/my-bookings/:id/cancel', async (req, res) => {
    const { id } = req.params;
    const email = req.query.email as string;
    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid id' });
    }
    if (!email) {
        return res.status(400).send({ message: 'Email is required' });
    }
    const result = await bookingsCollection.updateOne(
        { _id: new ObjectId(id), email, status: 'Pending' },
        { $set: { status: 'Cancelled' } }
    );
    if (result.matchedCount === 0) {
        return res.status(403).send({ message: 'Booking not found, not yours, or not pending' });
    }
    res.send(result);
});

if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`This Server Is Running On Port: ${port}`);
    });
}

export default app;
