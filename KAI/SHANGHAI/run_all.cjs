const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function runForYears(startYear, endYear, type) {
    console.log(`\n=== Ejecutando ${type.toUpperCase()} ${startYear}-${endYear} ===`);
    
    for (let year = startYear; year <= endYear; year++) {
        console.log(`  Procesando ${type} ${year}...`);
        try {
            const { stdout, stderr } = await execPromise(`node main.js ${year} ${type}`);
            if (stdout) console.log(stdout);
            if (stderr) console.error(stderr);
        } catch (error) {
            console.error(`  Error en ${year}: ${error.message}`);
        }
        // Pequeña pausa
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

async function main() {
    console.log("🚀 Iniciando scraping de Shanghai Ranking");
    console.log("=".repeat(50));
    
    // ARWU: 2003-2025
    await runForYears(2003, 2024, 'arwu');
    
    // GRAS: 2017-2025
    await runForYears(2017, 2024, 'gras');
    
    console.log("\n✅ Proceso completado");
}

main();
