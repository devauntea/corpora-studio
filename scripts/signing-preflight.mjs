// Presence checks only. Secret values are never printed or written.
const platform=process.argv[2]??process.platform;
if(platform==='darwin'){
 const certificate=!!process.env.APPLE_CERTIFICATE&&!!process.env.APPLE_CERTIFICATE_PASSWORD;
 const identity=!!process.env.APPLE_SIGNING_IDENTITY;
 const api=!!process.env.APPLE_API_KEY&&!!process.env.APPLE_API_ISSUER&&!!process.env.APPLE_API_KEY_PATH;
 const appleId=!!process.env.APPLE_ID&&!!process.env.APPLE_PASSWORD&&!!process.env.APPLE_TEAM_ID;
 console.log(JSON.stringify({platform,certificateConfigured:certificate||identity,notarizationConfigured:api||appleId,ready:(certificate||identity)&&(api||appleId)},null,2));
 if(!(certificate||identity)||!(api||appleId))process.exitCode=1;
}else if(platform==='win32'){
 const configured=!!process.env.WINDOWS_CERTIFICATE_THUMBPRINT||!!process.env.WINDOWS_SIGN_COMMAND;
 console.log(JSON.stringify({platform,signingConfigured:configured,ready:configured},null,2));if(!configured)process.exitCode=1;
}else{console.error('Specify darwin or win32.');process.exitCode=2;}
