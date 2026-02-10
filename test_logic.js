
// Mocking the normalization logic from utils.ts
const normalize = (w) =>
    w.toLowerCase()
     .replace(/[।.,!?]/g, "") 
     // simplified regex for standalone node test
     .replace(/[^\w\s]/g, "") 
     .trim();

const testNormalization = () => {
    const hindiWord = "नमस्ते!";
    const normalized = normalize(hindiWord);
    console.log(`Normalization test: "${hindiWord}" -> "${normalized}"`);
    if (normalized === "नमस्ते") {
        console.log("✅ Normalization test passed!");
    } else {
        console.log("❌ Normalization test failed.");
    }
};

const testPunctuationSpacing = () => {
    const testTranscriptData = [
        { word: "Hello" },
        { word: "." },
        { word: "How" },
        { word: "are" },
        { word: "you" },
        { word: "?" },
        { word: "मैं" },
        { word: "ठीक" },
        { word: "हूँ" },
        { word: "।" }
    ];

    let script = "";
    for (let i = 0; i < testTranscriptData.length; i++) {
        const word = testTranscriptData[i].word;
        if (i > 0 && !/^[।.,!?]/.test(word)) {
            script += " ";
        }
        script += word;
    }

    console.log("Reconstructed script:", script);
    const expectedScript = "Hello. How are you? मैं ठीक हूँ।";
    if (script === expectedScript) {
        console.log("✅ Punctuation spacing test passed!");
    } else {
        console.log("❌ Punctuation spacing test failed.");
        console.log("Expected:", expectedScript);
    }
};

testNormalization();
testPunctuationSpacing();
