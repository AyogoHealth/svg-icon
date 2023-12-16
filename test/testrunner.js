/*! Copyright (c) 2023 Ayogo Health Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

import { mkdtemp } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { red, green } from 'kleur/colors';
import serve_handler from "serve-handler";
import WebDriver from "webdriver";

const ELEMENT = "element-6066-11e4-a52e-4f735466cecf";
const waitForLoad = `
var cb = arguments[0];
if (document.readyState == "complete") {
  cb();
} else {
  window.addEventListener("load", () => cb());
}
`;

async function withServer(fn) {
  const server = http.createServer((request, response) => {
    return serve_handler(request, response);
  });

  await new Promise((resolve, reject) => {
    server.listen(3000)
      .once("listening", resolve)
      .once("error", reject);
  });

  await fn();

  await new Promise((resolve, reject) => {
    server.close();
    server.once("close", resolve)
      .once("error", reject);
  });
}

async function withDriver(fn) {
  const logDir = await mkdtemp(join(tmpdir(), "wpt-tests-"));

  const client = await WebDriver.newSession({
    capabilities: {
      browserName: process.env.TEST_BROWSER ?? "chrome",
      "goog:chromeOptions": {
        args: ["--headless=new"]
      },
      "moz:firefoxOptions": {
        args: ["-headless"]
      },
      "ms:edgeOptions": {
        args: ["--headless"]
      }
    },
    logLevel: "error",
    outputDir: logDir
  });

  await fn(client);

  await client.deleteSession();
}

function printResults(results) {
  for (const testcase of results) {
    const testname = new URL(testcase.test).pathname.substring(1);

    if (testcase.status !== 0) {
      console.log(`\n${red(testname)}`);
    } else {
      console.log(`\n${testname}`);
    }

    for (const test of testcase.tests) {
      if (test.status === 0) {
        console.log(green(`    ✔ ${test.name}`));
      } else {
        console.log(red(`    ✗ ${test.name}`));
        console.log(`      ${test.message}`);
        test.stack.split('\n').forEach((line) => {
          console.log(`    ${line}`);
        });
      }
    }
  }

  console.log("");
}


withServer(async function() {
  await withDriver(async function(driver) {
    const testcases = [
      "http://localhost:3000/test/test.html"
    ];
    const results = [];

    for (const test of testcases) {
      await driver.navigateTo(test);

      await driver.executeAsyncScript(waitForLoad, []);

      try {
        const resultsEl = await driver.findElement("css selector", "#__testharness__results__");
        const resultsJSON = await driver.getElementProperty(resultsEl[ELEMENT], "textContent");
        const resultsData = JSON.parse(resultsJSON);

        results.push(resultsData);

        if (resultsData.status !== 0) {
          break;
        }
      } catch (e) {
        console.error(e);
        break;
      }
    }

    printResults(results);
  });
});
