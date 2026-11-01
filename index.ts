import express, { NextFunction, Request, Response } from 'express';
import 'dotenv/config';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import { createRemoteJWKSet, jwtVerify } from 'jose';

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

const JWKS = createRemoteJWKSet(new URL(process.env.JWT_Client_Token as string));

const verifyApi = async <P,>(req: Request<P>, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
    try {
        const { payload } = await jwtVerify(token, JWKS);
        res.locals.email = payload.email;
        next();
    } catch {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
};

app.get('/', (req, res) => {
    res.send({ message: 'Server Is Running' });
});

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

app.get('/my-listings/:email', verifyApi, async (req, res) => {
    const { email } = req.params;
    if (res.locals.email !== email) {
        return res.status(403).send({ message: 'Forbidden access' });
    }
    const result = await studiosCollection.find({ ownerEmail: email }).toArray();
    res.send(result);
});

app.post('/add-studios', verifyApi, async (req, res) => {
    const result = await studiosCollection.insertOne({ ...req.body, ownerEmail: res.locals.email });
    res.send(result);
});

app.patch('/studios/:id', verifyApi, async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid id' });
    }
    const { title, category, hourlyRate, securityDeposit, maxCapacity,
        location, image, gallery, amenities, overview } = req.body;

    const result = await studiosCollection.updateOne(
        { _id: new ObjectId(id), ownerEmail: res.locals.email },
        { $set: { title, category, hourlyRate, securityDeposit, maxCapacity,
            location, image, gallery, amenities, overview } }
    );
    if (result.matchedCount === 0) {
        return res.status(403).send({ message: 'Studio not found or you are not the owner' });
    }
    res.send(result);
});

app.delete('/studios/:id', verifyApi, async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid id' });
    }
    const result = await studiosCollection.deleteOne({ _id: new ObjectId(id), ownerEmail: res.locals.email });
    if (result.deletedCount === 0) {
        return res.status(403).send({ message: 'Studio not found or you are not the owner' });
    }
    res.send(result);
});

app.post('/my-bookings', verifyApi, async (req, res) => {
    const { studioId, date, startTime, endTime } = req.body;
    const timeFormat = /^\d{2}:\d{2}$/;
    if (!studioId || !date || !timeFormat.test(startTime) || !timeFormat.test(endTime)) {
        return res.status(400).send({ message: 'studioId, date, startTime and endTime (HH:MM) are required' });
    }
    if (startTime >= endTime) {
        return res.status(400).send({ message: 'End time must be after start time' });
    }

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

    const result = await bookingsCollection.insertOne({ ...req.body, email: res.locals.email, status: 'Pending' });
    res.send(result);
});

app.get('/my-bookings/:email', verifyApi, async (req, res) => {
    const { email } = req.params;
    if (res.locals.email !== email) {
        return res.status(403).send({ message: 'Forbidden access' });
    }
    const result = await bookingsCollection.find({ email }).toArray();
    res.send(result);
});

app.get('/listing-bookings/:email', verifyApi, async (req, res) => {
    const { email } = req.params;
    if (res.locals.email !== email) {
        return res.status(403).send({ message: 'Forbidden access' });
    }
    const studios = await studiosCollection.find({ ownerEmail: email }).project({ _id: 1 }).toArray();
    const studioIds = studios.map(studio => studio._id.toString());
    const result = await bookingsCollection
        .find({ studioId: { $in: studioIds } })
        .sort({ date: 1, startTime: 1 })
        .toArray();
    res.send(result);
});

app.patch('/my-bookings/:id/confirm', verifyApi, async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid id' });
    }
    const booking = await bookingsCollection.findOne({ _id: new ObjectId(id), status: 'Pending' });
    if (!booking || !ObjectId.isValid(booking.studioId)) {
        return res.status(404).send({ message: 'Pending booking not found' });
    }
    const studio = await studiosCollection.findOne({
        _id: new ObjectId(booking.studioId as string),
        ownerEmail: res.locals.email,
    });
    if (!studio) {
        return res.status(403).send({ message: 'You are not the owner of this studio' });
    }
    const result = await bookingsCollection.updateOne(
        { _id: booking._id, status: 'Pending' },
        { $set: { status: 'Confirmed' } }
    );
    res.send(result);
});

app.patch('/my-bookings/:id/cancel', verifyApi, async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid id' });
    }
    const result = await bookingsCollection.updateOne(
        { _id: new ObjectId(id), email: res.locals.email, status: 'Pending' },
        { $set: { status: 'Cancelled', cancelledBy: 'Client' } }
    );
    if (result.matchedCount === 0) {
        return res.status(404).send({ message: 'Pending booking not found' });
    }
    res.send(result);
});

app.patch('/listing-bookings/:id/cancel', verifyApi, async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: 'Invalid id' });
    }
    const booking = await bookingsCollection.findOne({ _id: new ObjectId(id), status: 'Pending' });
    if (!booking || !ObjectId.isValid(booking.studioId)) {
        return res.status(404).send({ message: 'Pending booking not found' });
    }
    const studio = await studiosCollection.findOne({
        _id: new ObjectId(booking.studioId as string),
        ownerEmail: res.locals.email,
    });
    if (!studio) {
        return res.status(403).send({ message: 'You are not the owner of this studio' });
    }
    const result = await bookingsCollection.updateOne(
        { _id: booking._id, status: 'Pending' },
        { $set: { status: 'Cancelled', cancelledBy: 'Owner' } }
    );
    res.send(result);
});

if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`This Server Is Running On Port: ${port}`);
    });
}

export default app;
