import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function downloadImage(imageUrl: string, filename: string): Promise<string> {
    const filePath = path.join(__dirname, filename);
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(filePath, response.data);
    return filePath;
}

function encodeImageToBase64(filePath: string): string {
    const imageBuffer = fs.readFileSync(filePath);
    return imageBuffer.toString("base64");
}

export async function analyzeImageWithGemini(imagePath: string, textPrompt: string): Promise<string> {
    const base64Image = encodeImageToBase64(imagePath);

    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
    });

    const result = await model.generateContent({
        contents: [
            { role: "user", parts: [{ text: textPrompt }] },
            { role: "user", parts: [{ inlineData: { mimeType: "image/png", data: base64Image } }] },
        ],
    });

    return result.response.text() || "I couldn't analyze the image.";
}