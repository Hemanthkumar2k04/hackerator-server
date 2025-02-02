import express from 'express';
import undici from 'undici';
import cors from 'cors';

const app = express();
const port = 5000;
const template = "I would like you to generate an idea on: ";

app.use(cors());
app.use(express.json());

const parseModelResponse = (data: string): string => {
  const lines = data.trim().split("\n");
  let finalResponse = "";

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.response) {
        finalResponse += parsed.response;
      }
    } catch {
      // Ignore invalid JSON lines
    }
  }

  return finalResponse.trim();
};

app.post('/generate', async (req, res) => {
  try {
    const { prompt, is_custom_prompt } = req.body;
    const finalPrompt = is_custom_prompt
      ? prompt
      : `${template}${prompt} and I would like the details of Project name, Short Description, what it actually solves, existing solutions, and whether it can be done in a 24 or 48 hr hackathon`;
    console.log(prompt);
    
    const response = await undici.fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        model: "llama3.1:8b",
        prompt: finalPrompt,
        max_tokens: 25,
        num_ctx: 256
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    const responseText = await response.text();
    res.json({ result: parseModelResponse(responseText) });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
