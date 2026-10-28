'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

function ensureStore() {
  const dir = path.dirname(config.usersFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(config.usersFile)) {
    fs.writeFileSync(config.usersFile, '[]\n', 'utf8');
  }
}

function readAll() {
  ensureStore();
  try {
    const data = JSON.parse(fs.readFileSync(config.usersFile, 'utf8') || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeAllAtomic(users) {
  ensureStore();
  const tmp = `${config.usersFile}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(users, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, config.usersFile);
}

function publicUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name || `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    createdAt: user.createdAt,
  };
}

function findById(id) {
  return readAll().find((u) => u.id === id) || null;
}

function findByEmail(email) {
  const normalized = String(email).trim().toLowerCase();
  return readAll().find((u) => u.email === normalized) || null;
}

function create({ firstName, lastName, name, email, passwordHash }) {
  const users = readAll();
  const normalized = String(email).trim().toLowerCase();
  if (users.some((u) => u.email === normalized)) {
    return { conflict: true };
  }

  const user = {
    id: crypto.randomUUID(),
    firstName,
    lastName,
    name: name || `${firstName} ${lastName}`.trim(),
    email: normalized,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeAllAtomic(users);
  return { user };
}

module.exports = {
  ensureStore,
  findById,
  findByEmail,
  create,
  publicUser,
};
