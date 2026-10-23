import { connect } from "@lancedb/lancedb";
import fs from "fs";
import path from "path";
import { pipeline } from "@huggingface/transformers";

const dataPath = path.resolve("./src/data/medical_knowledge.json");
const dbPath = path.resolve("./lancedb");

async function main() {
  console.log("Loading medical knowledge dataset...");
  const rawData = fs.readFileSync(dataPath, "utf-8");
  const documents = JSON.parse(rawData);

  console.log("Loading embedding model (this may take a moment on first run)...");
  // We use a small, fast sentence-transformers model
  const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

  console.log("Connecting to local LanceDB at:", dbPath);
  const db = await connect(dbPath);

  // Generate embeddings for all documents
  const data = [];
  for (const doc of documents) {
    console.log(`Embedding: ${doc.topic}`);
    const output = await extractor(doc.content, { pooling: "mean", normalize: true });
    // Convert Float32Array to standard array
    const vector = Array.from(output.data);
    
    data.push({
      vector,
      id: doc.id,
      topic: doc.topic,
      text: doc.content
    });
  }

  // Define the table schema and create the table
  console.log("Saving vectors to LanceDB...");
  
  // Create or overwrite the table
  try {
    await db.createTable("medical_knowledge", data, { mode: "overwrite" });
    console.log(`Successfully ingested ${data.length} documents into the vector database!`);
  } catch (err) {
    console.error("Error creating table:", err);
  }
}

main().catch(console.error);
