// mock-bootstrap.js
const path = require('path');
const fs = require('fs');

Object.defineProperty(process.stdin, 'isTTY', {
  value: true,
  configurable: true
});

// Write inputs to stdin
setTimeout(() => {
  process.stdin.push("tevd-portal\n");
}, 100);
setTimeout(() => {
  process.stdin.push("teamenjoyvd/tevd-portal\n");
}, 200);
setTimeout(() => {
  process.stdin.push("https://www.teamenjoyvd.com\n");
}, 300);
setTimeout(() => {
  process.stdin.push("y\n");
}, 400);

require('../../scripts/bootstrap.js');
