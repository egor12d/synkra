import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,appendFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import net from 'node:net';
import {configureLocalAdmin} from './configure-local-admin.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const runtime=path.join(root,'.sites-runtime');mkdirSync(runtime,{recursive:true});
const logPath=path.join(runtime,'startup.log');
writeFileSync(logPath,`SYNKRA startup ${new Date().toISOString()}\nNode ${process.version}\nProject ${root}\n`);
const port=Number(process.env.PORT||5174),address=`http://127.0.0.1:${port}`;
const env={...process.env,PORT:String(port),NO_COLOR:'1',CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_SEND_METRICS:'false'};delete env.FORCE_COLOR;
let activeChild,stopping=false;
function print(message){console.log(message);appendFileSync(logPath,message+'\n');}
function capture(chunk,stderr=false){const text=chunk.toString();appendFileSync(logPath,text);(stderr?process.stderr:process.stdout).write(text);}
function run(args){return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,args,{cwd:root,env,stdio:['inherit','pipe','pipe'],windowsHide:true});activeChild=child;
  child.stdout.on('data',chunk=>capture(chunk));child.stderr.on('data',chunk=>capture(chunk,true));
  child.on('error',reject);child.on('close',(code,signal)=>{if(activeChild===child)activeChild=null;resolve({code:code??(signal?1:0),signal});});
});}
process.on('SIGINT',()=>{stopping=true;activeChild?.kill('SIGINT');});
process.on('SIGTERM',()=>{stopping=true;activeChild?.kill('SIGTERM');});
async function healthy(){try{const r=await fetch(address+'/api/health',{signal:AbortSignal.timeout(1800)});const json=await r.json();return r.ok&&json.data?.status==='ok'&&json.data?.storage==='persistent-d1';}catch{return false;}}
function portOccupied(){return new Promise(resolve=>{const server=net.createServer();server.once('error',()=>resolve(true));server.listen({port,host:'127.0.0.1'},()=>server.close(()=>resolve(false)));});}
function openBrowser(){
  if(process.env.SYNKRA_SKIP_BROWSER==='true')return;
  if(process.platform==='win32'){
    const opener=spawn('explorer.exe',[address],{detached:true,stdio:'ignore',windowsHide:true});
    opener.on('error',()=>print(`Откройте адрес вручную: ${address}`));opener.unref();
  }
}
async function start(){
  print('SYNKRA — запуск сайта');
  const [major,minor]=process.versions.node.split('.').map(Number);
  if(major<22||(major===22&&minor<13))throw new Error('Нужен Node.js 22.13 или новее. Рекомендуется Node.js 24 LTS.');
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Неверный PORT: укажите число от 1024 до 65535.');
  if(await healthy()){configureLocalAdmin();print(`Сайт уже запущен: ${address}`);openBrowser();return;}
  if(await portOccupied())throw new Error(`Порт ${port} занят другим процессом. Закройте предыдущее окно запуска сайта и повторите запуск.`);
  const required=['vinext/dist/cli.js','wrangler/bin/wrangler.js','vite/bin/vite.js'];
  if(required.some(file=>!existsSync(path.join(root,'node_modules',file)))){
    print('Устанавливаем зависимости. Первый запуск может занять несколько минут.');
    const npmPaths=[process.env.npm_execpath,path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),path.join(path.dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js')].filter(Boolean);
    const npmCli=npmPaths.find(file=>existsSync(file));if(!npmCli)throw new Error('Не найден npm. Переустановите Node.js с компонентом npm.');
    const install=await run([npmCli,'ci','--workspaces=false','--include=dev','--include=optional','--no-audit','--no-fund']);
    if(install.code!==0)throw new Error(`Установка зависимостей завершилась с кодом ${install.code}. Подробности выше и в startup.log.`);
  }
  print('Подготавливаем базу данных. Не закрывайте окно — это может занять около минуты.');
  const initialization=await run(['scripts/init-local.mjs']);
  if(initialization.code!==0)throw new Error(`Подготовка базы завершилась с кодом ${initialization.code}. Подробности выше и в startup.log.`);
  if(stopping)return;
  print('Запускаем сервер. Оставьте это окно открытым, пока пользуетесь сайтом.');
  let launched=false,checking=false;
  const watcher=setInterval(async()=>{
    if(checking||launched||stopping)return;checking=true;
    try{if(await healthy()){launched=true;clearInterval(watcher);print(`САЙТ ГОТОВ: ${address}`);openBrowser();}}finally{checking=false;}
  },1200);
  const server=await run(['scripts/start-local.mjs']);clearInterval(watcher);
  if(server.code!==0&&!stopping)throw new Error(`Сервер остановился с кодом ${server.code}. Подробности выше и в startup.log.`);
}
try{await start();}catch(error){print(`\nОшибка запуска: ${error.message}\nЖурнал: ${logPath}`);process.exitCode=1;}
