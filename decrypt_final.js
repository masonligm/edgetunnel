function base64SecretDecode(ciphertextBase64, secret) {
  const data = Buffer.from(ciphertextBase64, 'base64').toString('binary');
  const key = Buffer.from(secret, 'utf8');
  let result = '';
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data.charCodeAt(i) ^ key[i % key.length]);
  }
  return result;
}

const encrypted = "S19UXksFXksCVVIHdkltNEEFY1k1CmBKaSM1UGEOBQoAeHVTCAcZAQ0eVVcDWgBeDRwDUgA=";
const userID = "807580dd-c0d9-4a9b-8e07-1dac365bd65a";

const result = base64SecretDecode(encrypted, userID);
console.log("解密结果:");
console.log(result);
