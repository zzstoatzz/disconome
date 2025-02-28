import { storage } from "@/lib/storage";
import { CLASSIFICATIONS_PATH } from "@/app/constants";
import { Classification, Label } from "@/lib/types";
import { isClassification } from "@/lib/utils";
import { createInterface } from "readline/promises";

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

async function askQuestion(question: string): Promise<string> {
    const answer = await rl.question(question);
    return answer.trim();
}

async function editClassification(path: string, slug: string) {
    try {
        const data = await storage.get<Classification>(path);
        if (!isClassification(data)) {
            console.log(`\nSkipping ${slug} - not a valid classification`);
            return;
        }

        // Display current classification
        console.log(`\n\nEditing: ${slug}`);
        console.log("Current labels:", data.labels?.map(l => `${l.name} (${l.source})`));
        console.log("Explanation:", data.explanation?.slice(0, 100) + "...");

        const shouldEdit = await askQuestion("\nEdit this classification? (y/n): ");
        if (shouldEdit.toLowerCase() !== 'y') {
            console.log("Skipping...");
            return;
        }

        // Edit labels interactively
        const newLabels: Label[] = [];
        console.log("\nEnter new labels (empty line to finish):");
        console.log("Format: <label name> | <source> (ai or trending)");
        console.log("Example: German Elections | trending");

        while (true) {
            const input = await askQuestion("> ");
            if (!input) break;

            const [name, source] = input.split("|").map(s => s.trim());
            if (!name || !source || !['ai', 'trending'].includes(source)) {
                console.log("Invalid format. Use: Label Name | ai/trending");
                continue;
            }

            newLabels.push({ name, source: source as 'ai' | 'trending' });
            console.log("Added:", { name, source });
        }

        if (newLabels.length === 0) {
            console.log("No labels provided, keeping existing labels");
            return;
        }

        // Save updated classification
        const updatedClassification: Classification = {
            ...data,
            labels: newLabels,
            timestamp: Date.now()
        };

        await storage.put(path, updatedClassification);
        console.log(`\n✅ Updated classification for ${slug}`);
        console.log("New labels:", newLabels.map(l => `${l.name} (${l.source})`));

    } catch (error) {
        console.error(`Error updating classification for ${slug}:`, error);
    }
}

async function main() {
    try {
        // List all classifications
        const paths = await storage.list(CLASSIFICATIONS_PATH);
        console.log(`Found ${paths.length} classification files`);

        // Process each classification
        for (const path of paths) {
            const slug = path.replace(CLASSIFICATIONS_PATH, "").replace(".json", "");
            await editClassification(path, slug);
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        rl.close();
    }
}

// Run the script
main().then(() => {
    console.log("\nDone editing classifications");
}); 