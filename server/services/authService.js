'use strict';

const users = require('../repositories/userRepository');
const {
  hashPassword,
  verifyPassword,
  createAccessToken,
  verifyJwt,
  extractBearer,
} = require('../utils/security');

const CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  UNAUTHORIZED: 'UNAUTHORIZED',
};

class AppError extends Error {
  constructor(code, message, fields, status) {
    super(message);
    this.code = code;
    this.fields = fields;
    this.status = status;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asString(value) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function validateRegister(body = {}) {
  const fields = {};
  let firstName = asString(body.firstName).trim();
  let lastName = asString(body.lastName).trim();
  const name = asString(body.name).trim();
  const email = asString(body.email).trim().toLowerCase();
  const password = asString(body.password);

  if (!firstName && !lastName && name) {
    const parts = name.split(/\s+/).filter(Boolean);
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ') || parts[0] || '';
  }

  if (!firstName || firstName.length > 50) {
    fields.firstName = 'Informe o nome (1 a 50 caracteres).';
    fields.name = 'Informe o nome (1 a 50 caracteres).';
  }
  if (!lastName || lastName.length > 50) {
    fields.lastName = 'Informe o sobrenome (1 a 50 caracteres).';
  }
  if (!email || !EMAIL_RE.test(email)) {
    fields.email = 'Informe um e-mail válido.';
  }
  if (!password || password.length < 8) {
    fields.password = 'A senha deve ter pelo menos 8 caracteres.';
  }

  if (Object.keys(fields).length > 0) {
    throw new AppError(CODES.VALIDATION_ERROR, 'Falha na validação dos dados.', fields, 400);
  }

  return {
    firstName,
    lastName,
    name: name || `${firstName} ${lastName}`.trim(),
    email,
    password,
  };
}

function validateLogin(body = {}) {
  const fields = {};
  const email = asString(body.email).trim().toLowerCase();
  const password = asString(body.password);

  if (!email || !EMAIL_RE.test(email)) fields.email = 'Informe um e-mail válido.';
  if (!password) fields.password = 'Informe a senha de acesso.';
  else if (password.length < 8) fields.password = 'A senha deve ter pelo menos 8 caracteres.';

  if (Object.keys(fields).length > 0) {
    throw new AppError(CODES.VALIDATION_ERROR, 'Falha na validação dos dados.', fields, 400);
  }

  return { email, password };
}

function authPayload(user) {
  const { token, expiresIn } = createAccessToken(user);
  return {
    user: users.publicUser(user),
    token,
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn,
  };
}

async function register(body) {
  const input = validateRegister(body);
  const passwordHash = await hashPassword(input.password);
  const result = users.create({
    firstName: input.firstName,
    lastName: input.lastName,
    name: input.name,
    email: input.email,
    passwordHash,
  });

  if (result.conflict) {
    throw new AppError(CODES.EMAIL_TAKEN, 'Este e-mail já está cadastrado.', {
      email: 'Este e-mail já está cadastrado.',
    }, 409);
  }

  return authPayload(result.user);
}

async function login(body) {
  const input = validateLogin(body);
  const user = users.findByEmail(input.email);
  if (!user) {
    throw new AppError(CODES.INVALID_CREDENTIALS, 'E-mail ou senha incorretos.', undefined, 401);
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    throw new AppError(CODES.INVALID_CREDENTIALS, 'E-mail ou senha incorretos.', undefined, 401);
  }

  return authPayload(user);
}

function me(authorizationHeader) {
  const token = extractBearer(authorizationHeader);
  if (!token) {
    throw new AppError(CODES.UNAUTHORIZED, 'Token de autorização ausente ou inválido.', undefined, 401);
  }

  const payload = verifyJwt(token);
  if (!payload || !payload.sub) {
    throw new AppError(CODES.UNAUTHORIZED, 'Token de autorização ausente ou inválido.', undefined, 401);
  }

  const user = users.findById(payload.sub);
  if (!user) {
    throw new AppError(CODES.UNAUTHORIZED, 'Token de autorização ausente ou inválido.', undefined, 401);
  }

  return { user: users.publicUser(user) };
}

module.exports = { register, login, me, AppError, CODES };
