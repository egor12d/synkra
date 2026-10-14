// This optional development shim addresses blocked os.userInfo in a Windows sandbox.
// Normal machines retain the native implementation; no production code imports it.
import os from 'node:os';
import { syncBuiltinESMExports } from 'node:module';
const nativeUserInfo=os.userInfo;
os.userInfo=function(options){
 try{return nativeUserInfo(options);}catch(error){
  if(error.code!=='ERR_SYSTEM_ERROR'||error.info?.code!=='ENOMEM')throw error;
  const profile=process.env.USERPROFILE;
  if(!profile)throw error;
  return {uid:-1,gid:-1,username:process.env.USERNAME??'local',homedir:profile,shell:null};
 }
};
syncBuiltinESMExports();
