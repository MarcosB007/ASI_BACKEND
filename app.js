import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./route/index.js";

dotenv.config();

const app = express();

const allowedOrigins = [
    "https://agropulsenoa.netlify.app",
    "http://localhost:3000",
    "http://localhost:5173",
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(express.json());

app.use("/", router);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

export default app;