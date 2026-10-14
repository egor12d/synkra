import './windows-os-compat.mjs';
import {fileURLToPath} from 'node:url';
process.argv=[process.execPath,fileURLToPath(new URL('./run-framework.mjs',import.meta.url)),'dev','--port',process.env.PORT??'5174'];
await import('./run-framework.mjs');
