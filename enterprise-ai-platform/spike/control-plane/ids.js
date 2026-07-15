'use strict';
const crypto = require('crypto');

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

module.exports = { id };
