import * as fs from 'fs';
export function fileLog(msg: string) {
    fs.appendFileSync('logs/server.log', new Date().toISOString() + ' ' + msg + '\n');
    console.log(msg);
}
