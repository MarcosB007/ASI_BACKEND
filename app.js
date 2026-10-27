import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./route/index.js";
import { manejarErrores } from "./utils/http.js";

dotenv.config();

const app = express();

const allowedOrigins = [
    "https://agropulsenoa.netlify.app",
    "http://localhost:3000",
    "http://localhost:5173",
    ...(process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
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

app.get("/", (req, res) => res.json({ app: "AgroPulse API", estado: "ok" }));
app.use("/", router);

app.use((req, res) => res.status(404).json({ mensaje: "Ruta no encontrada" }));
app.use(manejarErrores);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`AgroPulse API escuchando en el puerto ${PORT}`);
});

export default app;
