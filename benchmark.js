const fs = require('fs');
const fsPromises = require('fs/promises');
const { performance } = require('perf_hooks');

const ITERATIONS = 1000;
const DATA = JSON.stringify({ LAST_ESSENTIAL_ID: "https://blog.playstation.com/?p=10000", LAST_CATALOG_ID: "https://blog.playstation.com/?p=10001" }, null, 2);

async function runBenchmark() {
  console.log(`Running benchmark with ${ITERATIONS} iterations...`);

  // Synchronous benchmark
  const startSync = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    fs.writeFileSync('sync_test.json', DATA);
  }
  const endSync = performance.now();
  const syncTime = endSync - startSync;
  console.log(`Synchronous write: ${syncTime.toFixed(2)} ms`);

  // Asynchronous benchmark
  const startAsync = performance.now();
  const promises = [];
  for (let i = 0; i < ITERATIONS; i++) {
    promises.push(fsPromises.writeFile('async_test.json', DATA));
  }
  await Promise.all(promises);
  const endAsync = performance.now();
  const asyncTime = endAsync - startAsync;
  console.log(`Asynchronous write: ${asyncTime.toFixed(2)} ms`);

  // Cleanup
  fs.unlinkSync('sync_test.json');
  fs.unlinkSync('async_test.json');
}

runBenchmark();
