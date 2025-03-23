import fs from "fs";

const configurations = JSON.parse(fs.readFileSync("configurations.json", "utf-8"));
export default configurations;