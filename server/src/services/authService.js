const { sign } = require('../utils/jwt');

function adminLogin({ username, password }) {
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

  if (username !== adminUser || password !== adminPass) {
    throw new Error('Invalid credentials');
  }

  const token = sign(
    { sub: username, role: 'admin' },
    process.env.JWT_SECRET || 'dev-secret',
    8 * 60 * 60
  );

  return {
    token,
    role: 'admin',
  };
}

module.exports = { adminLogin };
