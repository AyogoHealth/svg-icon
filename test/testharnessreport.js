/*!
 * Copyright © web-platform-tests contributors
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *   1. Redistributions of source code must retain the above copyright notice,
 *   this list of conditions and the following disclaimer.
 *
 *   2. Redistributions in binary form must reproduce the above copyright
 *   notice, this list of conditions and the following disclaimer in the
 *   documentation and/or other materials provided with the distribution.
 *
 *   3. Neither the name of the copyright holder nor the names of its
 *   contributors may be used to endorse or promote products derived from this
 *   software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

/* global add_completion_callback */
/* global setup */

/*
 * This file is intended for vendors to implement code needed to integrate
 * testharness.js tests with their own test systems.
 *
 * Typically test system integration will attach callbacks when each test has
 * run, using add_result_callback(callback(test)), or when the whole test file
 * has completed, using
 * add_completion_callback(callback(tests, harness_status)).
 *
 * For more documentation about the callback functions and the
 * parameters they are called with see testharness.js
 */

function dump_test_results(tests, status) {
    var results_element = document.createElement("script");
    results_element.type = "text/json";
    results_element.id = "__testharness__results__";
    var test_results = tests.map(function(x) {
        return {name:x.name, status:x.status, message:x.message, stack:x.stack}
    });
    var data = {test:window.location.href,
                tests:test_results,
                status: status.status,
                message: status.message,
                stack: status.stack};
    results_element.textContent = JSON.stringify(data);

    // To avoid a HierarchyRequestError with XML documents, ensure that 'results_element'
    // is inserted at a location that results in a valid document.
    var parent = document.body
        ? document.body                 // <body> is required in XHTML documents
        : document.documentElement;     // fallback for optional <body> in HTML5, SVG, etc.

    parent.appendChild(results_element);
}

add_completion_callback(dump_test_results);

/* If the parent window has a testharness_properties object,
 * we use this to provide the test settings. This is used by the
 * default in-browser runner to configure the timeout and the
 * rendering of results
 */
try {
    if (window.opener && "testharness_properties" in window.opener) {
        /* If we pass the testharness_properties object as-is here without
         * JSON stringifying and reparsing it, IE fails & emits the message
         * "Could not complete the operation due to error 80700019".
         */
        setup(JSON.parse(JSON.stringify(window.opener.testharness_properties)));
    }
} catch (e) {
}
// vim: set expandtab shiftwidth=4 tabstop=4:
