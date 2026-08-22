// 访问密码校验：scrypt（node 内置，零依赖）
const crypto = require('crypto');

const PASSWORD_HASH = process.env.ACCESS_PASSWORD_HASH || '';

function verifyPassword(input) {
  if (!PASSWORD_HASH) return false; // 未配置哈希 → 一律拒绝，避免裸奔
  if (typeof input !== 'string' || input.length === 0 || input.length > 128) return false;
  const hash = crypto.scryptSync(input, 'yesplaymusic', 64).toString('hex');
  if (hash.length !== PASSWORD_HASH.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(PASSWORD_HASH));
}

module.exports = { verifyPassword };
