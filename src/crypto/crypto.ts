export const createHash = require('create-hash');
export const createHmac = require('create-hmac');
export { pbkdf2 } from 'pbkdf2';
export const createDecipheriv = (cipher: string, key: any, iv: any): any => {
  throw new Error('crypto.createDecipheriv() not implemented here');
};
