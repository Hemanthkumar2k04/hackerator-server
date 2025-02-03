"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const undici_1 = __importDefault(require("undici"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const body_parser_1 = __importDefault(require("body-parser"));
const node_cache_1 = __importDefault(require("node-cache"));
const compression_1 = __importDefault(require("compression"));
const app = (0, express_1.default)();
const port = 5000;
const template = "I would like you to generate an idea on: ";
const MONGO_URI = "mongodb://127.0.0.1:27017/myDb";
// Cache for in-memory user data
const cache = new node_cache_1.default({ stdTTL: 600 }); // Cache TTL of 10 minutes
// MongoDB Connection
mongoose_1.default
    .connect(MONGO_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.error("Error connecting to MongoDB:", err));
// Middleware
app.use((0, cors_1.default)());
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: "1mb" }));
app.use(body_parser_1.default.json());
const userSchema = new mongoose_1.default.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    credits: { type: Number },
}, { collection: "Users" });
const User = mongoose_1.default.model("User", userSchema);
// Helper to cache users
const getCachedUser = (username) => __awaiter(void 0, void 0, void 0, function* () {
    let user = cache.get(username);
    if (!user) {
        user = yield User.findOne({ username });
        if (user)
            cache.set(username, user);
    }
    return user;
});
// Routes
app.post("/message", (req, res) => {
    const { message, user } = req.body;
    if (message) {
        console.log(`USER(${user}): ${message}`);
        res.status(200).send({ status: "success", message: "Message received" });
    }
    else {
        res.status(400).send({ status: "error" });
    }
});
app.post("/resetPassword", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, oldPassword, newPassword } = req.body;
    try {
        const user = yield User.findOne(username);
        if (!user) {
            res.status(400).json({ message: "Username not found" });
            return;
        }
        if (user.password !== oldPassword) {
            res.status(401).json({ message: "Invalid Password" });
            return;
        }
        user.password = newPassword;
        yield user.save();
        cache.del(username); // Clear cache after update
        console.log("Successful password reset");
        res.status(200).json({ message: "Password reset complete" });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
}));
app.post("/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    if (!username || !password) {
        res.status(400).json({ message: "Username and Password Required" });
        return;
    }
    try {
        const user = yield User.findOne(username);
        if (!user) {
            res.status(400).json({ message: "User Not Found!" });
            return;
        }
        if (password !== user.password) {
            res.status(401).json({ message: "Invalid Username or Password" });
            return;
        }
        console.log(username);
        res.status(200).json({ message: "Login Successful" });
    }
    catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}));
app.post("/register", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    if (!username || !password) {
        res.status(400).json({ message: "Username and Password Required" });
        return;
    }
    try {
        const existingUser = yield User.findOne({ username });
        if (existingUser) {
            res.status(409).json({ message: "User already Exists!" });
            return;
        }
        const newUser = new User({ username, password, credits: 300 });
        yield newUser.save();
        res.status(201).json({ message: "Registration Successful" });
    }
    catch (error) {
        console.error("Error during registration:", error);
        res.status(500).json({ message: "Server error during registration" });
    }
}));
const parseModelResponse = (data) => {
    const lines = data.trim().split("\n");
    let finalResponse = "";
    for (const line of lines) {
        try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
                finalResponse += parsed.response;
            }
        }
        catch (_a) {
            // Ignore invalid JSON lines
        }
    }
    return finalResponse.trim();
};
app.post("/generate", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { prompt, is_custom_prompt } = req.body;
        const finalPrompt = is_custom_prompt
            ? prompt
            : `${template}${prompt} and I would like the details of Project name, Short Description, what it actually solves, existing solutions, TECH STACK and whether it can be done in a 24 or 48 hr hackathon and your important suggestion on this project.`;
        const response = yield undici_1.default.fetch("http://localhost:11434/api/generate", {
            method: "POST",
            body: JSON.stringify({
                model: "llama3.1:8b",
                prompt: finalPrompt,
                max_tokens: 25,
                num_ctx: 128,
            }),
            headers: { "Content-Type": "application/json", Connection: "keep-alive" },
        });
        const responseText = yield response.text();
        res.json({ result: parseModelResponse(responseText) });
    }
    catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
