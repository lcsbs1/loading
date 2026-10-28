'use strict';

const authService = require('../services/authService');

async function handleAuth(method, pathname, body, headers) {
  if (method === 'POST' && pathname === '/api/auth/register') {
    return { status: 201, body: await authService.register(body) };
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    return { status: 200, body: await authService.login(body) };
  }

  if (method === 'GET' && pathname === '/api/auth/me') {
    return { status: 200, body: authService.me(headers.authorization) };
  }

  const err = new authService.AppError(
    'NOT_FOUND',
    'Route not found',
    undefined,
    404
  );
  throw err;
}

module.exports = { handleAuth };
