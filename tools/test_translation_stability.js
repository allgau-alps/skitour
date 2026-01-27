const { translateText } = require('./lib/translator');
const { log } = require('./lib/utils');

async function testStability() {
    console.log("Starting Translation Stability Test...");

    const testPhrases = [
        "Good morning",
        "The weather is nice",
        "Snow is falling",
        "Avalanche danger is high",
        "Have a nice day"
    ];

    let successCount = 0;
    const start = Date.now();

    for (let i = 0; i < testPhrases.length; i++) {
        const phrase = testPhrases[i];
        console.log(`[${i + 1}/${testPhrases.length}] Translating: "${phrase}"...`);
        try {
            const result = await translateText(phrase);
            if (result) {
                console.log(`\t✅ Success: "${result}"`);
                successCount++;
            } else {
                console.log(`\t❌ Failed (returned null)`);
            }
        } catch (error) {
            console.log(`\t❌ Error: ${error.message}`);
        }
        // Small delay to be polite
        await new Promise(r => setTimeout(r, 500));
    }

    const duration = (Date.now() - start) / 1000;
    console.log("\n--- Test Results ---");
    console.log(`Total Requests: ${testPhrases.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${testPhrases.length - successCount}`);
    console.log(`Duration: ${duration}s`);

    if (successCount === testPhrases.length) {
        console.log("\n✅ API seems stable.");
    } else {
        console.log("\n⚠️ API is experiencing issues.");
    }
}

testStability();
