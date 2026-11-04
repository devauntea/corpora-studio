// Run on the Windows signing machine after importing its certificate or configuring a signing tool.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
if(process.platform!=='win32')throw new Error('Windows release packaging requires a Windows host.');
const thumb=process.env.WINDOWS_CERTIFICATE_THUMBPRINT;
const command=process.env.WINDOWS_SIGN_COMMAND;
if(!command&&!/^[0-9A-Fa-f]{40}$/.test(thumb??''))throw new Error('Set a valid certificate thumbprint or WINDOWS_SIGN_COMMAND. Keep credentials in environment variables, not command text.');
const windows=command?{signCommand:command}:{certificateThumbprint:thumb,digestAlgorithm:'sha256',timestampUrl:process.env.WINDOWS_TIMESTAMP_URL??'http://timestamp.digicert.com'};
const cli=fileURLToPath(new URL('../node_modules/@tauri-apps/cli/tauri.js',import.meta.url));
const result=spawnSync(process.execPath,[cli,'build','--bundles','nsis','--config',JSON.stringify({bundle:{windows}})],{stdio:'inherit'});
process.exitCode=result.status??1;
