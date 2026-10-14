import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
export function ensurePaymentTokenKey(filename) {
 const source=readFileSync(filename,'utf8');
 const line=/^\s*PAYMENT_TOKEN_ENCRYPTION_KEY\s*=([^\r\n]*)$/m;
 const match=source.match(line);const current=match?.[1].trim().replace(/^(['"])(.*)\1$/,'$2')??'';
 if(current){if(!/^[A-Za-z0-9+/]{43}=$/.test(current)||Buffer.from(current,'base64').length!==32)throw new Error('PAYMENT_TOKEN_ENCRYPTION_KEY must be a 32-byte Base64 key. Fix .dev.vars; an existing key is never replaced automatically.');return false;}
 const replacement=`PAYMENT_TOKEN_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`;
 writeFileSync(filename,match?source.replace(line,replacement):`${source.trimEnd()}\n${replacement}\n`,{mode:0o600});return true;
}
