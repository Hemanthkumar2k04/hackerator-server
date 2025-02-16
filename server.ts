import express, { Request, Response } from 'express';
import undici from 'undici';
import cors from 'cors';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';

const app = express();
const port = 5000;
const template = "I would like you to generate an idea on: ";
const MONGO_URI = "mongodb://127.0.0.1:27017/myDb";

mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  credits: { type: Number, default: 300 }
}, { collection: 'Users' });

const User = mongoose.model("User", userSchema);

// Register new user
app.post("/register", async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ message: "Username and Password Required" });
    return;
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      res.status(409).json({ message: "User already exists!" });
      return;
    }

    const newUser = new User({ username, password, credits: 300 });
    await newUser.save();

    res.status(201).json({ message: "Registration Successful"});
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ message: "Server error while registering" });
  }
});

// Login user
app.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ message: "Username and Password Required" });
    return;
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      res.status(404).json({ message: "User Not Found" });
      return;
    }

    if (password !== user.password) {
      res.status(401).json({ message: "Invalid Username or Password" });
      return;
    }

    res.status(200).json({ message: "Login Successful"});
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get('/get-credits/:username', async (req, res) => {
  try{
    const username = req.params.username;
    const user = await User.findOne({username});

    if(!user){
      res.status(404).json({message: 'User not found'});
    }

    res.status(200).json({credits: user?.credits})
  }
  catch (err){
    console.log(err);
    res.status(500).json({message: 'Server Error'});
  }
})
app.patch('/updateCredits', async (req, res) =>{
  const {username, credits} = req.body;
  try{
    const user = await User.findOne({username});
    if(!user){
      res.status(404).json({message: "User not Found"});
    }
    if(user){
      user.credits = credits;
      await user.save();
      res.status(200).json({message: "Updated Successfully"});
    }
  }
  catch (err){
    console.log(err);
    res.status(500).json({message: "Internal Server Error"});
  }
})
// Generate idea and deduct credits
app.post("/generate", async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, is_custom_prompt, username } = req.body;

    if (!username || !prompt) {
      res.status(400).json({ message: "Username and Prompt are required" });
      return;
    }

    const user = await User.findOne({ username });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }


    const finalPrompt = is_custom_prompt
      ? prompt
      : `${template}${prompt} and I would like the details of Project name, Short Description, what it actually solves, existing solutions, TECH STACK and whether it can be done in a 24 or 48 hr hackathon and your important suggestion on this project with Releveant Research Papers which are recent. Never give any snippet of code.`;

    const response = await undici.fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        model: "llama3.2",
        prompt: finalPrompt,
        max_tokens: 25,
        num_ctx: 64
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    const responseText = await response.text();
    const parsedResponse = parseModelResponse(responseText);


    res.json({ result: parsedResponse});

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

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

// Check remaining credits for a user
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
