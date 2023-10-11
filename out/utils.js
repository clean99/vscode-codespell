"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findDifferences = exports.extractAddedLines = void 0;
const Diff = require("diff");
const _ = require("lodash");
function extractAddedLines(diff) {
    // Split the diff into lines and filter for added code
    return diff
        .split('\n')
        .filter(line => line.startsWith('+'))
        .map(line => line.slice(1))
        .join('\n')
        .split('++ code')
        .filter(item => !_.isEmpty(item));
}
exports.extractAddedLines = extractAddedLines;
function findDifferences(code1, code2) {
    // Generate the diff
    const diff = Diff.createPatch('code', code1, code2);
    console.log('addedLines1', diff);
    const addedLines = extractAddedLines(diff);
    console.log('addedLines', addedLines);
    // Return the formatted diff
    return addedLines;
}
exports.findDifferences = findDifferences;
//# sourceMappingURL=utils.js.map