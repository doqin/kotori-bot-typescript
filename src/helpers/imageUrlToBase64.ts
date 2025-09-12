import axios from "axios";

export async function imageUrlToBase64(imageUrl: string): Promise<string> {
	const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
	return Buffer.from(response.data).toString("base64");
}