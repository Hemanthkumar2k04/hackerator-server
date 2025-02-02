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
const app = (0, express_1.default)();
const port = 5000;
const template = "I would like you to generate an idea on: ";
app.use((0, cors_1.default)());
app.use(express_1.default.json());
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
app.post('/generate', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { prompt, is_custom_prompt } = req.body;
        const finalPrompt = is_custom_prompt
            ? prompt
            : `${template}${prompt} and I would like the details of Project name, Short Description, what it actually solves, existing solutions, and whether it can be done in a 24 or 48 hr hackathon`;
        console.log(prompt);
        const response = yield undici_1.default.fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            body: JSON.stringify({
                model: "llama3.1:8b",
                prompt: finalPrompt,
                max_tokens: 25,
                num_ctx: 256
            }),
            headers: { 'Content-Type': 'application/json' }
        });
        const responseText = yield response.text();
        res.json({ result: parseModelResponse(responseText) });
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}));
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
