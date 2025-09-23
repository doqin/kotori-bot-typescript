/**
 * Get available models to use from AIHorde
 * @returns a list of models you can use
 */
export async function getAIHordeModels() {
    const url = `https://oai.aihorde.net/v1/models`
    const headers = {
        "accept": "application/json"
    }
    const response = await fetch(url, {
        method: "GET",
        headers: headers
    });
    const data = await response.json();
    console.debug(data);
    return data.data;
} 