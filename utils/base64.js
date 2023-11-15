// base64加密
function encryptBase64(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}
// base64解密
function decryptBase64(base64Str) {
  return Buffer.from(base64Str, 'base64').toString('utf8');
}

module.exports = {
  encryptBase64,
  decryptBase64
};